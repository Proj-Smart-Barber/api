const ISOLATED_BENCH_DB_URL =
  "postgresql://sb_opt_bench:sb_opt_bench_local_only@127.0.0.1:55432/smartbarber_opt_bench_isolated";

function assertIsolatedBenchmarkDb(urlStr: string): void {
  const parsed = new URL(urlStr);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55432" ||
    parsed.pathname !== "/smartbarber_opt_bench_isolated"
  ) {
    throw new Error(
      `[SECURITY GUARD] Benchmark recusado fora do banco descartável isolado: ${parsed.hostname}:${parsed.port}${parsed.pathname}`,
    );
  }
}

assertIsolatedBenchmarkDb(ISOLATED_BENCH_DB_URL);

process.env.NODE_ENV = "test";
process.env.SMARTBARBER_ISOLATED_BENCH = "1";
process.env.DATABASE_URL = ISOLATED_BENCH_DB_URL;
process.env.JWT_SECRET =
  "bench-jwt-secret-isolated-only-32-chars-minimum-123456";
process.env.EMAIL_VERIFICATION_CODE_SECRET =
  "bench-email-verification-code-secret-isolated-only-12345";
process.env.APP_URL = "http://127.0.0.1:3333";
process.env.FRONTEND_URL = "http://127.0.0.1:8081";
process.env.RESEND_API_KEY = "re_bench_isolated_dummy";
process.env.EMAIL_FROM = "bench@smartbarber.local";
process.env.ENABLE_REQUEST_METRICS = "true";

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sign } from "jsonwebtoken";

function deterministicUuid(namespace: string, index: number): string {
  const hash = createHash("sha256")
    .update(`${namespace}:${index}`)
    .digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "a" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  );
  return Number(sortedValues[idx].toFixed(3));
}

export const BENCH_IDS = {
  ownerId: deterministicUuid("owner", 1),
  barber1Id: deterministicUuid("barber", 1),
  barber2Id: deterministicUuid("barber", 2),
  barber3Id: deterministicUuid("barber", 3),
  barber4Id: deterministicUuid("barber", 4),
  customerMainId: deterministicUuid("customer", 1),
  shopMainId: deterministicUuid("shop", 1),
  service1Id: deterministicUuid("service-main", 1),
  service2Id: deterministicUuid("service-main", 2),
  service3Id: deterministicUuid("service-main", 3),
  targetDate: "2026-11-20",
  singleBookingDate: "2026-11-21",
  availabilityDate: "2026-11-25",
  createBookingBaseDate: "2026-12-10",
  financeMonth: "2026-11",
};

async function seedDataset(pool: any) {
  console.log(
    "[BENCH] Seeding synthetic dataset in smartbarber_opt_bench_isolated...",
  );
  await pool.query(`
    TRUNCATE TABLE
      booking_service_items,
      booking_events,
      operation_attempts,
      reviews,
      review_reports,
      review_moderation_logs,
      finance_entries,
      bookings,
      shopping_carts,
      service_items,
      notifications,
      barbershop_gallery,
      service_media,
      media,
      schedule_exceptions,
      barbershop_schedules,
      barbershop_schedule_scopes,
      services,
      membership,
      barbershop_locations,
      barbershops,
      explore_feed_snapshots,
      users
    RESTART IDENTITY CASCADE;
  `);

  const usersRows: any[] = [
    {
      id: BENCH_IDS.ownerId,
      name: "Proprietário Benchmark",
      email: "owner.bench@smartbarber.local",
      cpf: "10000000001",
      phone: "11999990001",
      accountType: "OWNER",
      onboardingIntent: "OWNER",
    },
    {
      id: BENCH_IDS.barber1Id,
      name: "Barbeiro Alpha",
      email: "barber1.bench@smartbarber.local",
      cpf: "10000000002",
      phone: "11999990002",
      accountType: "BARBER",
      onboardingIntent: "CLIENT",
    },
    {
      id: BENCH_IDS.barber2Id,
      name: "Barbeiro Beta",
      email: "barber2.bench@smartbarber.local",
      cpf: "10000000003",
      phone: "11999990003",
      accountType: "BARBER",
      onboardingIntent: "CLIENT",
    },
    {
      id: BENCH_IDS.barber3Id,
      name: "Barbeiro Gamma",
      email: "barber3.bench@smartbarber.local",
      cpf: "10000000004",
      phone: "11999990004",
      accountType: "BARBER",
      onboardingIntent: "CLIENT",
    },
    {
      id: BENCH_IDS.barber4Id,
      name: "Barbeiro Delta",
      email: "barber4.bench@smartbarber.local",
      cpf: "10000000005",
      phone: "11999990005",
      accountType: "BARBER",
      onboardingIntent: "CLIENT",
    },
    {
      id: BENCH_IDS.customerMainId,
      name: "Cliente Principal Benchmark",
      email: "customer1.bench@smartbarber.local",
      cpf: "20000000001",
      phone: "11988880001",
      accountType: "CLIENT",
      onboardingIntent: "CLIENT",
    },
  ];

  const extraCustomers: string[] = [];
  for (let i = 2; i <= 150; i++) {
    const cid = deterministicUuid("customer", i);
    extraCustomers.push(cid);
    usersRows.push({
      id: cid,
      name: `Cliente Sintético ${i}`,
      email: `customer${i}.bench@smartbarber.local`,
      cpf: String(20000000000 + i),
      phone: `1198888${String(i).padStart(4, "0")}`,
      accountType: "CLIENT",
      onboardingIntent: "CLIENT",
    });
  }

  const otherOwnerIds: string[] = [];
  for (let i = 2; i <= 120; i++) {
    const oid = deterministicUuid("owner", i);
    otherOwnerIds.push(oid);
    usersRows.push({
      id: oid,
      name: `Dono Unidade ${i}`,
      email: `owner${i}.bench@smartbarber.local`,
      cpf: String(30000000000 + i),
      phone: `1197777${String(i).padStart(4, "0")}`,
      accountType: "OWNER",
      onboardingIntent: "OWNER",
    });
  }

  for (const u of usersRows) {
    await pool.query(
      `INSERT INTO users (id, name, email, password, cpf, phone_number, account_type, onboarding_intent, credential_version, email_verified_at)
       VALUES ($1, $2, $3, 'hashed-bench-pw', $4, $5, $6, $7, 1, NOW())`,
      [
        u.id,
        u.name,
        u.email,
        u.cpf,
        u.phone,
        u.accountType,
        u.onboardingIntent,
      ],
    );
  }

  // Insert 120 Barbershops + Locations + Gallery + Featured Services
  for (let i = 1; i <= 120; i++) {
    const shopId =
      i === 1 ? BENCH_IDS.shopMainId : deterministicUuid("shop", i);
    const ownerId = i === 1 ? BENCH_IDS.ownerId : otherOwnerIds[i - 2];
    const lat = -23.5505 + (i % 25) * 0.008;
    const lon = -46.6333 + Math.floor(i / 25) * 0.008;
    const rating = (4.1 + (i % 9) * 0.1).toFixed(2);
    const reviewCount = 15 + (i % 40);
    await pool.query(
      `INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status, timezone, rating, review_count, cover_url, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'America/Sao_Paulo', $7, $8, $9, $10)`,
      [
        shopId,
        i === 1
          ? "Barbearia Obsidian Benchmark Central"
          : `Barbearia Studio Imperial ${i}`,
        ownerId,
        `barbearia-bench-${i}`,
        String(10000000000000 + i),
        `Av. Paulista, ${100 + i * 10} - Bela Vista, São Paulo - SP`,
        rating,
        reviewCount,
        `https://cdn.smartbarber.local/shops/${shopId}/cover.webp`,
        `https://cdn.smartbarber.local/shops/${shopId}/avatar.webp`,
      ],
    );

    await pool.query(
      `INSERT INTO barbershop_locations (id, barbershop_id, status, latitude, longitude, version, confirmed_at, source, acquired_at, valid_until)
       VALUES ($1, $2, 'CONFIRMED', $3, $4, 1, NOW(), 'MANUAL', NOW(), NOW() + INTERVAL '30 days')`,
      [deterministicUuid("shop-loc", i), shopId, lat, lon],
    );

    await pool.query(
      `INSERT INTO membership (id, user_id, barbershop_id, role, state)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [deterministicUuid("membership-owner", i), ownerId, shopId],
    );

    // Seed reviews matching reviewCount on first 30 shops so correlated subquery in discovery has realistic work
    if (i <= 30) {
      for (let r = 1; r <= 8; r++) {
        const revBookingId = deterministicUuid(`rev-booking-${i}`, r);
        const revId = deterministicUuid(`review-${i}`, r);
        const custId = extraCustomers[(i + r) % extraCustomers.length];
        await pool.query(
          `INSERT INTO bookings (id, barbershop_id, barberman_id, customer_id, date, start_time, end_time, starts_at, ends_at, timezone, status, total_price_in_cents, total_duration_in_minutes, version)
           VALUES ($1, $2, $3, $4, '2026-08-10T00:00:00.000Z', '10:00', '10:30', '2026-08-10T13:00:00.000Z', '2026-08-10T13:30:00.000Z', 'America/Sao_Paulo', 'COMPLETED', 5000, 30, 1)`,
          [revBookingId, shopId, ownerId, custId],
        );
        await pool.query(
          `INSERT INTO reviews (id, booking_id, barbershop_id, customer_id, rating, comment, status, version)
           VALUES ($1, $2, $3, $4, $5, 'Excelente atendimento', 'PUBLISHED', 1)`,
          [revId, revBookingId, shopId, custId, 4 + (r % 2)],
        );
      }
    }

    // Add 10 gallery photos per shop for the first 40 shops (tests bounded <= 6 SQL fetch vs unbounded)
    const photoCount = i <= 40 ? 10 : 4;
    for (let p = 1; p <= photoCount; p++) {
      const mediaId = deterministicUuid(`media-shop-${i}`, p);
      const galleryId = deterministicUuid(`gallery-shop-${i}`, p);
      await pool.query(
        `INSERT INTO media (id, owner_id, owner_type, owner_entity_id, purpose, object_key, public_url, mime_type, file_size, status, variants)
         VALUES ($1, $2, 'BARBERSHOP', $3, 'GALLERY', $4, $5, 'image/webp', 85000, 'READY', $6::jsonb)`,
        [
          mediaId,
          ownerId,
          shopId,
          `shops/${shopId}/gallery-${p}.webp`,
          `https://cdn.smartbarber.local/shops/${shopId}/gallery-${p}.webp`,
          JSON.stringify({
            thumbnail: `https://cdn.smartbarber.local/shops/${shopId}/gallery-${p}-thumb.webp`,
          }),
        ],
      );
      await pool.query(
        `INSERT INTO barbershop_gallery (id, barbershop_id, media_id, display_order, is_cover, caption)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [galleryId, shopId, mediaId, p, p === 1, `Ambiente ${p}`],
      );
    }

    // Add 8 services per shop (all featured)
    for (let s = 1; s <= 8; s++) {
      const serviceId =
        i === 1 && s === 1
          ? BENCH_IDS.service1Id
          : i === 1 && s === 2
            ? BENCH_IDS.service2Id
            : i === 1 && s === 3
              ? BENCH_IDS.service3Id
              : deterministicUuid(`service-shop-${i}`, s);
      await pool.query(
        `INSERT INTO services (id, barbershop_id, title, description, image_url, is_featured, featured_order, price_in_cents, duration_in_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, 30, true)`,
        [
          serviceId,
          shopId,
          `Corte & Acabamento Premium ${s}`,
          `Serviço completo ${s}`,
          `https://cdn.smartbarber.local/shops/${shopId}/service-${s}.webp`,
          s,
          4500 + s * 500,
        ],
      );
    }
  }

  // Add 4 active barbers to main shop
  const mainBarbers = [
    BENCH_IDS.barber1Id,
    BENCH_IDS.barber2Id,
    BENCH_IDS.barber3Id,
    BENCH_IDS.barber4Id,
  ];
  for (let idx = 0; idx < mainBarbers.length; idx++) {
    await pool.query(
      `INSERT INTO membership (id, user_id, barbershop_id, role, state)
       VALUES ($1, $2, $3, 'BARBERMAN', 'ACTIVE')`,
      [
        deterministicUuid("membership-barber", idx + 1),
        mainBarbers[idx],
        BENCH_IDS.shopMainId,
      ],
    );
  }

  // Schedules for main shop (general + 4 barbers * 7 days = 35 rows)
  const days = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  await pool.query(
    `INSERT INTO barbershop_schedule_scopes (id, barbershop_id, barberman_id, state, version)
     VALUES ($1, $2, NULL, 'CUSTOM', 1)`,
    [deterministicUuid("scope", 0), BENCH_IDS.shopMainId],
  );
  for (let bIdx = 0; bIdx < mainBarbers.length; bIdx++) {
    await pool.query(
      `INSERT INTO barbershop_schedule_scopes (id, barbershop_id, barberman_id, state, version)
       VALUES ($1, $2, $3, 'CUSTOM', 1)`,
      [
        deterministicUuid("scope", bIdx + 1),
        BENCH_IDS.shopMainId,
        mainBarbers[bIdx],
      ],
    );
  }

  let schedSeq = 1;
  for (const day of days) {
    await pool.query(
      `INSERT INTO barbershop_schedules (id, barbershop_id, barberman_id, created_by, day_of_week, open_time, close_time)
       VALUES ($1, $2, NULL, $3, $4, '08:00', '21:00')`,
      [
        deterministicUuid("sched", schedSeq++),
        BENCH_IDS.shopMainId,
        BENCH_IDS.ownerId,
        day,
      ],
    );
    for (const barberId of mainBarbers) {
      await pool.query(
        `INSERT INTO barbershop_schedules (id, barbershop_id, barberman_id, created_by, day_of_week, open_time, close_time)
         VALUES ($1, $2, $3, $4, $5, '08:00', '21:00')`,
        [
          deterministicUuid("sched", schedSeq++),
          BENCH_IDS.shopMainId,
          barberId,
          BENCH_IDS.ownerId,
          day,
        ],
      );
    }
  }

  // Insert 60 schedule exceptions across dates on main shop
  for (let e = 1; e <= 60; e++) {
    const dayNum = ((e - 1) % 28) + 1;
    const excDate = `2026-10-${String(dayNum).padStart(2, "0")}T00:00:00.000Z`;
    await pool.query(
      `INSERT INTO schedule_exceptions (id, barbershop_id, barberman_id, date, start_time, end_time, reason)
       VALUES ($1, $2, $3, $4, '12:00', '13:00', 'Intervalo almoço')`,
      [
        deterministicUuid("exc", e),
        BENCH_IDS.shopMainId,
        mainBarbers[e % mainBarbers.length],
        excDate,
      ],
    );
  }

  // Legacy service_item for shopping_carts
  const legacyServiceItemId = deterministicUuid("legacy-service-item", 1);
  await pool.query(
    `INSERT INTO service_items (id, service_id, title_snapshot, price_in_cents_snapshot, duration_in_minutes_snapshot)
     VALUES ($1, $2, 'Corte Clássico Legado', 5000, 30)`,
    [legacyServiceItemId, BENCH_IDS.service1Id],
  );

  const bookingValues: string[] = [];
  const itemValues: string[] = [];
  let bookingSeq = 1;
  let itemSeq = 1;

  const queueBooking = (params: {
    id: string;
    barbermanId: string;
    customerId: string | null;
    shoppingCartId?: string | null;
    dateIso: string;
    startTime: string;
    endTime: string;
    startsAtIso: string;
    endsAtIso: string;
    status: string;
    totalPriceInCents: number | null;
    serviceCount: number;
  }) => {
    const cid = params.customerId ? `'${params.customerId}'` : "NULL";
    const scid = params.shoppingCartId ? `'${params.shoppingCartId}'` : "NULL";
    const price =
      params.totalPriceInCents !== null
        ? String(params.totalPriceInCents)
        : "NULL";
    bookingValues.push(
      `('${params.id}', '${BENCH_IDS.shopMainId}', '${params.barbermanId}', ${cid}, ${scid}, '${params.dateIso}', '${params.startTime}', '${params.endTime}', '${params.startsAtIso}', '${params.endsAtIso}', 'America/Sao_Paulo', '${params.status}', ${price}, 30, 1, NOW(), NOW())`,
    );

    const services = [
      {
        id: BENCH_IDS.service1Id,
        title: "Corte & Acabamento Premium 1",
        price: 5000,
      },
      {
        id: BENCH_IDS.service2Id,
        title: "Corte & Acabamento Premium 2",
        price: 5500,
      },
    ];
    for (let s = 0; s < params.serviceCount; s++) {
      const svc = services[s % services.length];
      const itemId = deterministicUuid("booking-item", itemSeq++);
      const itemPrice =
        params.totalPriceInCents === null ? "NULL" : String(svc.price);
      itemValues.push(
        `('${itemId}', '${params.id}', '${svc.id}', '${svc.title}', ${itemPrice}, 30, false, NOW())`,
      );
    }
  };

  // Single booking on 2026-11-21
  queueBooking({
    id: deterministicUuid("booking", bookingSeq++),
    barbermanId: BENCH_IDS.barber1Id,
    customerId: BENCH_IDS.customerMainId,
    dateIso: "2026-11-21T00:00:00.000Z",
    startTime: "09:00",
    endTime: "09:30",
    startsAtIso: "2026-11-21T12:00:00.000Z",
    endsAtIso: "2026-11-21T12:30:00.000Z",
    status: "CONFIRMED",
    totalPriceInCents: 10500,
    serviceCount: 2,
  });

  // 105 bookings on targetDate 2026-11-20
  for (let i = 0; i < 105; i++) {
    const barberId = mainBarbers[i % mainBarbers.length];
    const custId = extraCustomers[i % extraCustomers.length];
    const hour = 8 + (Math.floor(i / 4) % 12);
    const minute = (i % 2) * 30;
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const endHour = minute === 30 ? hour + 1 : hour;
    const endMin = minute === 30 ? "00" : "30";
    const endHh = String(endHour).padStart(2, "0");
    const utcHour = hour + 3;
    const utcEndHour = endHour + 3;
    const status =
      i % 5 === 0 ? "COMPLETED" : i % 7 === 0 ? "CANCELLED" : "CONFIRMED";
    queueBooking({
      id: deterministicUuid("booking", bookingSeq++),
      barbermanId: barberId,
      customerId: custId,
      dateIso: "2026-11-20T00:00:00.000Z",
      startTime: `${hh}:${mm}`,
      endTime: `${endHh}:${endMin}`,
      startsAtIso: `2026-11-20T${String(utcHour).padStart(2, "0")}:${mm}:00.000Z`,
      endsAtIso: `2026-11-20T${String(utcEndHour).padStart(2, "0")}:${endMin}:00.000Z`,
      status,
      totalPriceInCents: i % 15 === 0 ? null : 10500,
      serviceCount: 2,
    });
  }

  // 20 legacy shopping carts for customerMainId + 40 modern bookings for customerMainId
  for (let c = 1; c <= 20; c++) {
    const cartId = deterministicUuid("legacy-cart", c);
    await pool.query(
      `INSERT INTO shopping_carts (id, service_item_id, user_id, total_price_in_cents) VALUES ($1, $2, $3, 5000)`,
      [cartId, legacyServiceItemId, BENCH_IDS.customerMainId],
    );
    const day = String((c % 25) + 1).padStart(2, "0");
    queueBooking({
      id: deterministicUuid("booking", bookingSeq++),
      barbermanId: mainBarbers[c % mainBarbers.length],
      customerId: null,
      shoppingCartId: cartId,
      dateIso: `2026-09-${day}T00:00:00.000Z`,
      startTime: "10:00",
      endTime: "10:30",
      startsAtIso: `2026-09-${day}T13:00:00.000Z`,
      endsAtIso: `2026-09-${day}T13:30:00.000Z`,
      status: "COMPLETED",
      totalPriceInCents: 5000,
      serviceCount: 1,
    });
  }

  for (let m = 1; m <= 40; m++) {
    const day = String((m % 25) + 1).padStart(2, "0");
    const month = m <= 20 ? "10" : "12";
    const status = m <= 20 ? "COMPLETED" : "CONFIRMED";
    queueBooking({
      id: deterministicUuid("booking", bookingSeq++),
      barbermanId: mainBarbers[m % mainBarbers.length],
      customerId: BENCH_IDS.customerMainId,
      dateIso: `2026-${month}-${day}T00:00:00.000Z`,
      startTime: "14:00",
      endTime: "14:30",
      startsAtIso: `2026-${month}-${day}T17:00:00.000Z`,
      endsAtIso: `2026-${month}-${day}T17:30:00.000Z`,
      status,
      totalPriceInCents: 10500,
      serviceCount: 2,
    });
  }

  // 2,400 historical + November bookings on main shop
  const novCompletedBookingIds: string[] = [];
  for (let h = 1; h <= 2400; h++) {
    const monthNum = h <= 350 ? 11 : (h % 10) + 1;
    let dayNum = ((h * 7) % 27) + 1;
    if (monthNum === 11 && (dayNum === 20 || dayNum === 21 || dayNum === 25)) {
      dayNum = 15;
    }
    const monthStr = String(monthNum).padStart(2, "0");
    const dayStr = String(dayNum).padStart(2, "0");
    const hour = 8 + (h % 10);
    const hh = String(hour).padStart(2, "0");
    const utcHh = String(hour + 3).padStart(2, "0");
    const status =
      h % 3 === 0 ? "COMPLETED" : h % 8 === 0 ? "CANCELLED" : "CONFIRMED";
    const bid = deterministicUuid("booking", bookingSeq++);
    if (monthNum === 11 && status === "COMPLETED") {
      novCompletedBookingIds.push(bid);
    }
    queueBooking({
      id: bid,
      barbermanId: mainBarbers[h % mainBarbers.length],
      customerId: extraCustomers[h % extraCustomers.length],
      dateIso: `2026-${monthStr}-${dayStr}T00:00:00.000Z`,
      startTime: `${hh}:00`,
      endTime: `${hh}:30`,
      startsAtIso: `2026-${monthStr}-${dayStr}T${utcHh}:00:00.000Z`,
      endsAtIso: `2026-${monthStr}-${dayStr}T${utcHh}:30:00.000Z`,
      status,
      totalPriceInCents: h % 25 === 0 ? null : 5000,
      serviceCount: 1,
    });
  }

  const chunkSize = 250;
  for (let i = 0; i < bookingValues.length; i += chunkSize) {
    const slice = bookingValues.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO bookings (id, barbershop_id, barberman_id, customer_id, shopping_cart_id, date, start_time, end_time, starts_at, ends_at, timezone, status, total_price_in_cents, total_duration_in_minutes, version, created_at, updated_at)
       VALUES ${slice.join(",")}`,
    );
  }
  for (let i = 0; i < itemValues.length; i += chunkSize) {
    const slice = itemValues.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO booking_service_items (id, booking_id, service_id, title, price_in_cents, duration_in_minutes, legacy_aggregate, created_at)
       VALUES ${slice.join(",")}`,
    );
  }

  // Insert 250 finance entries in November 2026 for main shop
  const financeValues: string[] = [];
  const cats = ["FIXED", "VARIABLE", "BARBER_PAYOUT", "PAYROLL", "OTHER"];
  for (let f = 1; f <= 250; f++) {
    const fid = deterministicUuid("finance-entry", f);
    const reqId = deterministicUuid("finance-req", f);
    const dayStr = String(((f - 1) % 28) + 1).padStart(2, "0");
    const isReceipt = f <= 40 && f <= novCompletedBookingIds.length;
    const kind = isReceipt ? "RECEIPT" : "EXPENSE";
    const status = isReceipt || f % 3 === 0 ? "PAID" : "PLANNED";
    const paidOn = status === "PAID" ? `'2026-11-${dayStr}'` : "NULL";
    const cat = isReceipt ? "BOOKING" : cats[f % cats.length];
    const bookingRef = isReceipt
      ? `'${novCompletedBookingIds[f - 1]}'`
      : "NULL";
    financeValues.push(
      `('${fid}', '${BENCH_IDS.shopMainId}', '${BENCH_IDS.ownerId}', '${reqId}', 'hash-${f}', '${kind}', '${cat}', 'Lançamento financeiro ${f}', ${1500 + f * 100}, '2026-11-${dayStr}', ${paidOn}, 'Fornecedor ${f}', '${status}', 1, ${bookingRef}, NOW(), NOW())`,
    );
  }
  await pool.query(
    `INSERT INTO finance_entries (id, barbershop_id, created_by, request_id, request_hash, kind, category, description, amount_in_cents, due_on, paid_on, payee, status, version, booking_id, created_at, updated_at)
     VALUES ${financeValues.join(",")}`,
  );

  // Insert 400 notifications for ownerId (250 unread, 150 read, with ties in created_at)
  const notifValues: string[] = [];
  const baseNotifTime = Date.parse("2026-11-10T10:00:00.000Z");
  for (let n = 1; n <= 400; n++) {
    const nid = deterministicUuid("notification", n);
    const ts = new Date(baseNotifTime + Math.floor(n / 2) * 1000).toISOString();
    const readAt = n > 250 ? `'${ts}'` : "NULL";
    notifValues.push(
      `('${nid}', '${BENCH_IDS.ownerId}', 'BOOKING_CREATED', 'Novo agendamento #${n}', 'Detalhes do agendamento ${n}', '${ts}', ${readAt}, '${ts}')`,
    );
  }
  await pool.query(
    `INSERT INTO notifications (id, user_id, type, title, message, scheduled_at, read_at, created_at)
     VALUES ${notifValues.join(",")}`,
  );

  // Insert 80 expired explore_feed_snapshots
  for (let s = 1; s <= 80; s++) {
    const snapId = deterministicUuid("expired-snap", s);
    await pool.query(
      `INSERT INTO explore_feed_snapshots (id, filters_hash, ordered_ids, expires_at)
       VALUES ($1, 'expired-hash', '[]'::jsonb, NOW() - INTERVAL '1 hour')`,
      [snapId],
    );
  }

  await pool.query("ANALYZE;");
  console.log("[BENCH] Dataset seeded and ANALYZE completed.");
}

interface ScenarioResult {
  name: string;
  coldMs: number;
  coldSqlCount: number;
  warmSqlCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  dbDurationP50Ms: number;
  lockQueryDurationP50Ms: number;
  payloadBytes: number;
  statusCode: number;
}

async function runBenchmarks(phase: string) {
  const { default: app } = await import("../src/app");
  const { pool } = await import("../src/infra/drizzle");
  const { env } = await import("../src/infra/env");
  const { runSchemaMigrations } = await import("../src/infra/drizzle/migrator");

  await runSchemaMigrations(undefined, { force: true });

  if (process.argv.includes("--seed")) {
    await seedDataset(pool);
  } else {
    await pool.query("ANALYZE;");
  }

  // Clean up any bookings created in previous benchmark runs on createBookingBaseDate
  await pool.query(
    `DELETE FROM booking_service_items WHERE booking_id IN (SELECT id FROM bookings WHERE date >= '2026-12-10')`,
  );
  await pool.query(
    `DELETE FROM booking_events WHERE booking_id IN (SELECT id FROM bookings WHERE date >= '2026-12-10')`,
  );
  await pool.query(`DELETE FROM bookings WHERE date >= '2026-12-10'`);
  await pool.query(
    `DELETE FROM explore_feed_snapshots WHERE filters_hash != 'expired-hash'`,
  );

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const ownerToken = sign(
    { sub: BENCH_IDS.ownerId, version: 1 },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  const customerToken = sign(
    { sub: BENCH_IDS.customerMainId, version: 1 },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  async function measureHttp(
    name: string,
    makeReq: (iter: number) => {
      path: string;
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    },
    iterations = 15,
  ): Promise<ScenarioResult> {
    const timings: number[] = [];
    const dbDurations: number[] = [];
    const lockWaits: number[] = [];
    let coldMs = 0;
    let coldSqlCount = 0;
    let warmSqlCount = 0;
    let payloadBytes = 0;
    let lastStatus = 0;

    for (let i = 0; i <= iterations; i++) {
      const reqSpec = makeReq(i);
      const start = performance.now();
      const res = await fetch(`${baseUrl}${reqSpec.path}`, {
        method: reqSpec.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(reqSpec.body ? { "Content-Type": "application/json" } : {}),
          ...(reqSpec.headers ?? {}),
        },
        body: reqSpec.body ? JSON.stringify(reqSpec.body) : undefined,
      });
      const rawText = await res.text();
      const elapsed = performance.now() - start;

      const sqlCountHeader = Number(res.headers.get("x-sql-count") ?? "0");
      const sqlDurHeader = Number(res.headers.get("x-sql-duration-ms") ?? "0");
      const serverTiming = res.headers.get("server-timing") ?? "";
      const lockMatch = serverTiming.match(/lock_query;dur=([0-9.]+)/);
      const lockMs = lockMatch ? Number(lockMatch[1]) : 0;

      if (res.status >= 400)
        throw new Error(`Scenario ${name} failed with HTTP ${res.status}`);
      lastStatus = res.status;
      payloadBytes = Buffer.byteLength(rawText, "utf8");

      if (i === 0) {
        coldMs = Number(elapsed.toFixed(3));
        coldSqlCount = sqlCountHeader;
      } else {
        timings.push(elapsed);
        dbDurations.push(sqlDurHeader);
        lockWaits.push(lockMs);
        warmSqlCount = sqlCountHeader;
      }
    }

    timings.sort((a, b) => a - b);
    dbDurations.sort((a, b) => a - b);
    lockWaits.sort((a, b) => a - b);

    return {
      name,
      coldMs,
      coldSqlCount,
      warmSqlCount,
      p50Ms: percentile(timings, 50),
      p95Ms: percentile(timings, 95),
      p99Ms: percentile(timings, 99),
      dbDurationP50Ms: percentile(dbDurations, 50),
      lockQueryDurationP50Ms: percentile(lockWaits, 50),
      payloadBytes,
      statusCode: lastStatus,
    };
  }

  const results: ScenarioResult[] = [];
  results.push(
    await measureHttp("unit_bootstrap_only", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/bookings?bootstrapOnly=true&limit=1`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );
  results.push(
    await measureHttp("finance_summary_only", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/finance?month=${BENCH_IDS.financeMonth}&view=summary`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );
  results.push(
    await measureHttp("finance_bookings_page_1", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/finance?month=${BENCH_IDS.financeMonth}&view=bookings&bookingsLimit=30`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  // 1. Unit bookings: 1 item
  results.push(
    await measureHttp("unit_bookings_1_item", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/bookings?date=${BENCH_IDS.singleBookingDate}&page=1&limit=20`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  // 2. Unit bookings: 20 items
  results.push(
    await measureHttp("unit_bookings_20_items", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/bookings?date=${BENCH_IDS.targetDate}&page=1&limit=20`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  // 3. Unit bookings: 100 items
  results.push(
    await measureHttp("unit_bookings_100_items", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/bookings?date=${BENCH_IDS.targetDate}&page=1&limit=100`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  // 4. Unit bookings: page 2 (subsequent page)
  results.push(
    await measureHttp("unit_bookings_page_2", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/bookings?date=${BENCH_IDS.targetDate}&page=2&limit=20&includeSummary=false`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  // 5. My bookings (customer with modern + legacy bookings)
  results.push(
    await measureHttp("my_bookings_page_1", () => ({
      path: `/api/bookings/me?page=1&limit=20`,
      headers: { Authorization: `Bearer ${customerToken}` },
    })),
  );

  // 6. Availability calculation
  results.push(
    await measureHttp("availability_2_services", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/availability?date=${BENCH_IDS.availabilityDate}&serviceIds=${BENCH_IDS.service1Id},${BENCH_IDS.service2Id}&barbermanId=${BENCH_IDS.barber1Id}`,
    })),
  );

  // 7. Create booking (transactional write with lock)
  results.push(
    await measureHttp(
      "create_booking_write",
      (iter) => {
        const day = String(10 + (iter % 18)).padStart(2, "0");
        const hour = String(8 + Math.floor(iter / 2)).padStart(2, "0");
        const min = iter % 2 === 0 ? "00" : "30";
        return {
          path: `/api/bookings`,
          method: "POST",
          headers: { Authorization: `Bearer ${customerToken}` },
          body: {
            barbershopId: BENCH_IDS.shopMainId,
            barbermanId: BENCH_IDS.barber2Id,
            date: `2026-12-${day}`,
            startTime: `${hour}:${min}`,
            serviceIds: [BENCH_IDS.service1Id],
          },
        };
      },
      10,
    ),
  );

  // 8. Finance period
  results.push(
    await measureHttp("finance_period_month", () => ({
      path: `/api/barbershops/${BENCH_IDS.shopMainId}/finance?month=${BENCH_IDS.financeMonth}`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  // 9. Notifications feed (page 1 & cursor page 2)
  let firstPageCursor: string | null = null;
  const notifRes = await fetch(`${baseUrl}/api/notifications?limit=20`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const notifJson: any = await notifRes.json();
  firstPageCursor = notifJson?.nextCursor ?? null;

  results.push(
    await measureHttp("notifications_page_1", () => ({
      path: `/api/notifications?limit=20`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    })),
  );

  if (firstPageCursor) {
    results.push(
      await measureHttp("notifications_page_2_cursor", () => ({
        path: `/api/notifications?limit=20&cursor=${encodeURIComponent(firstPageCursor!)}`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      })),
    );
  }

  // 10. Discovery ALL
  results.push(
    await measureHttp("discovery_all_page_1", () => ({
      path: `/api/barbershops?page=1&limit=20`,
    })),
  );

  // 11. Discovery NEARBY
  results.push(
    await measureHttp("discovery_nearby_10km", () => ({
      path: `/api/barbershops/nearby`,
      method: "POST",
      body: {
        latitude: -23.5505,
        longitude: -46.6333,
        radiusKm: 10,
        page: 1,
        limit: 20,
      },
    })),
  );

  // 12. Explore Feed (page 1 snapshot creation + page 2 cursor hydration)
  let exploreCursor: string | null = null;
  const expRes = await fetch(`${baseUrl}/api/barbershops/explore-feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "ALL", limit: 10 }),
  });
  const expJson: any = await expRes.json();
  exploreCursor = expJson?.nextCursor ?? null;

  results.push(
    await measureHttp("explore_feed_page_1", () => ({
      path: `/api/barbershops/explore-feed`,
      method: "POST",
      body: { mode: "ALL", limit: 10 },
    })),
  );

  if (exploreCursor) {
    results.push(
      await measureHttp("explore_feed_page_2_cursor", () => ({
        path: `/api/barbershops/explore-feed`,
        method: "POST",
        body: { mode: "ALL", limit: 10, cursor: exploreCursor },
      })),
    );
  }

  // Capture EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) plans on key queries
  const explainPlans: Record<string, any> = {};
  const explainQueries: Record<string, { sql: string; params: any[] }> = {
    unit_bookings_day_range: {
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT id, status, total_price_in_cents, starts_at
            FROM bookings
            WHERE barbershop_id = $1
              AND starts_at >= '2026-11-20T03:00:00.000Z'
              AND starts_at < '2026-11-21T03:00:00.000Z'
            ORDER BY starts_at ASC, id ASC
            LIMIT 20`,
      params: [BENCH_IDS.shopMainId],
    },
    schedules_by_shop_and_day: {
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM barbershop_schedules
            WHERE barbershop_id = $1 AND day_of_week = 'WEDNESDAY'
              AND (barberman_id IS NULL OR barberman_id = $2)`,
      params: [BENCH_IDS.shopMainId, BENCH_IDS.barber1Id],
    },
    exceptions_by_shop_and_date: {
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM schedule_exceptions
            WHERE barbershop_id = $1
              AND date >= '2026-10-15T00:00:00.000Z'
              AND date <= '2026-10-15T23:59:59.999Z'`,
      params: [BENCH_IDS.shopMainId],
    },
    notifications_feed_cursor: {
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT id, type, title, read_at, created_at
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 21`,
      params: [BENCH_IDS.ownerId],
    },
    notifications_unread_count: {
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT COUNT(*)::int FROM notifications
            WHERE user_id = $1 AND read_at IS NULL`,
      params: [BENCH_IDS.ownerId],
    },
    customer_bookings_history: {
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT id, starts_at, status FROM bookings
            WHERE customer_id = $1
            ORDER BY starts_at DESC, id DESC
            LIMIT 20`,
      params: [BENCH_IDS.customerMainId],
    },
  };

  function findFirstIndexInfo(node: any): {
    indexName: string | null;
    scanNodeType: string | null;
  } {
    if (!node) return { indexName: null, scanNodeType: null };
    if (node["Index Name"]) {
      return {
        indexName: node["Index Name"],
        scanNodeType: node["Node Type"] ?? null,
      };
    }
    if (Array.isArray(node.Plans)) {
      for (const child of node.Plans) {
        const found = findFirstIndexInfo(child);
        if (found.indexName) return found;
      }
    }
    return {
      indexName: null,
      scanNodeType: node["Node Type"] ?? null,
    };
  }

  for (const [planKey, spec] of Object.entries(explainQueries)) {
    const res = await pool.query(spec.sql, spec.params);
    const planRoot = res.rows[0]?.["QUERY PLAN"]?.[0] ?? res.rows[0];
    const idxInfo = findFirstIndexInfo(planRoot?.Plan);
    explainPlans[planKey] = {
      executionTimeMs: planRoot?.["Execution Time"],
      planningTimeMs: planRoot?.["Planning Time"],
      nodeType: planRoot?.Plan?.["Node Type"],
      scanNodeType: idxInfo.scanNodeType,
      indexName: idxInfo.indexName,
      sharedHitBlocks: planRoot?.Plan?.["Shared Hit Blocks"],
      sharedReadBlocks: planRoot?.Plan?.["Shared Read Blocks"],
      actualRows: planRoot?.Plan?.["Actual Rows"],
    };
  }

  server.close();
  await pool.end();

  const outPath = join(process.cwd(), `benchmark-${phase}.json`);
  const payload = {
    phase,
    timestamp: new Date().toISOString(),
    database: "127.0.0.1:55432/smartbarber_opt_bench_isolated",
    warmSamplesPerReadScenario: 15,
    notes: [
      "First call is a scenario warm-up, not a serverless cold start.",
      "p95/p99 are descriptive order statistics from a small sample; no production SLA claim.",
      "lock_query measures the duration of locking statements, not isolated wait time.",
    ],
    scenarios: results,
    explainPlans,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[BENCH] Saved ${outPath}`);
  console.table(
    results.map((r) => ({
      scenario: r.name,
      status: r.statusCode,
      sqlWarm: r.warmSqlCount,
      p50Ms: r.p50Ms,
      p95Ms: r.p95Ms,
      dbP50Ms: r.dbDurationP50Ms,
      bytes: r.payloadBytes,
    })),
  );
}

const phaseArg =
  process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "before";

runBenchmarks(phaseArg).catch((err) => {
  console.error("[BENCH ERROR]", err);
  process.exit(1);
});
