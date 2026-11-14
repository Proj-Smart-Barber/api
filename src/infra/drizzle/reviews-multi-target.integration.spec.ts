import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UniqueEntityId } from "../../core/entities/unique-entity-id";
import { GetExploreFeedUseCase } from "../../domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed";
import { CreateReviewUseCase } from "../../domain/application/use-cases/reviews/create-review/create-review";
import { DeleteReviewUseCase } from "../../domain/application/use-cases/reviews/delete-review/delete-review";
import { ModerateReviewUseCase } from "../../domain/application/use-cases/reviews/moderate-review/moderate-review";
import { UpdateReviewUseCase } from "../../domain/application/use-cases/reviews/update-review/update-review";
import { db, pool } from "./index";
import { DrizzleBarbershopsRepository } from "./repositories/drizzle-barbershops-repository";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { DrizzleDiscoveryRepository } from "./repositories/drizzle-discovery-repository";
import { DrizzleMembershipsRepository } from "./repositories/drizzle-memberships-repository";
import { DrizzleReviewsRepository } from "./repositories/drizzle-reviews-repository";
import { DrizzleUsersRepository } from "./repositories/drizzle-users-repository";
import {
  barbershopGallery,
  barbershopLocations,
  barbershops,
  bookingServiceItems,
  bookings,
  media,
  membership,
  platformFeedbacks,
  reviewItems,
  reviews,
  serviceMedia,
  services,
  users,
} from "./schema";

describe("Reviews Multi-Target & Explore PostgreSQL Integration", () => {
  let reviewsRepository: DrizzleReviewsRepository;
  let bookingsRepository: DrizzleBookingsRepository;
  let barbershopsRepository: DrizzleBarbershopsRepository;
  let membershipsRepository: DrizzleMembershipsRepository;
  let usersRepository: DrizzleUsersRepository;
  let discoveryRepository: DrizzleDiscoveryRepository;

  let createReviewUseCase: CreateReviewUseCase;
  let updateReviewUseCase: UpdateReviewUseCase;
  let deleteReviewUseCase: DeleteReviewUseCase;
  let moderateReviewUseCase: ModerateReviewUseCase;
  let getExploreFeedUseCase: GetExploreFeedUseCase;

  const ownerId = randomUUID();
  const barberId = randomUUID();
  const clientId = randomUUID();
  const client2Id = randomUUID();
  const adminId = randomUUID();
  const shopRatedId = randomUUID();
  const shopUnratedId = randomUUID();
  const serviceCorteId = randomUUID();
  const serviceBarbaId = randomUUID();
  const serviceUnratedId = randomUUID();
  const booking1Id = randomUUID();
  const booking2Id = randomUUID();
  const snapshotBookingId = randomUUID();
  const snapshotItemId = randomUUID();
  const media1Id = randomUUID();
  const media2Id = randomUUID();

  async function truncateTestData() {
    await db.execute(
      sql`TRUNCATE TABLE platform_feedbacks, review_items, review_reports, review_moderation_logs, reviews, booking_service_items, bookings, service_media, barbershop_gallery, media, services, barbershop_locations, membership, barbershops, users CASCADE`,
    );
  }

  beforeAll(async () => {
    reviewsRepository = new DrizzleReviewsRepository(db);
    bookingsRepository = new DrizzleBookingsRepository(db);
    barbershopsRepository = new DrizzleBarbershopsRepository(db);
    membershipsRepository = new DrizzleMembershipsRepository();
    usersRepository = new DrizzleUsersRepository();
    discoveryRepository = new DrizzleDiscoveryRepository(db);

    createReviewUseCase = new CreateReviewUseCase(
      reviewsRepository,
      bookingsRepository,
      barbershopsRepository,
      membershipsRepository,
    );
    updateReviewUseCase = new UpdateReviewUseCase(
      reviewsRepository,
      barbershopsRepository,
      bookingsRepository,
    );
    deleteReviewUseCase = new DeleteReviewUseCase(
      reviewsRepository,
      barbershopsRepository,
    );
    moderateReviewUseCase = new ModerateReviewUseCase(
      reviewsRepository,
      usersRepository,
      barbershopsRepository,
    );
    getExploreFeedUseCase = new GetExploreFeedUseCase(discoveryRepository);
  });

  beforeEach(async () => {
    await truncateTestData();

    await db.insert(users).values([
      {
        id: ownerId,
        name: "Owner Integration",
        email: "owner@test.local",
        password: "hash",
        cpf: "10000000001",
        accountType: "OWNER",
      },
      {
        id: barberId,
        name: "Barber Integration",
        email: "barber@test.local",
        password: "hash",
        cpf: "10000000002",
        accountType: "CLIENT",
      },
      {
        id: clientId,
        name: "Client One",
        email: "client1@test.local",
        password: "hash",
        cpf: "10000000003",
        accountType: "CLIENT",
      },
      {
        id: client2Id,
        name: "Client Two",
        email: "client2@test.local",
        password: "hash",
        cpf: "10000000004",
        accountType: "CLIENT",
      },
      {
        id: adminId,
        name: "Admin Platform",
        email: "admin@test.local",
        password: "hash",
        cpf: "10000000005",
        accountType: "PLATFORM_ADMIN",
      },
    ]);

    await db.insert(barbershops).values([
      {
        id: shopRatedId,
        name: "Barbearia Avaliada",
        ownerId,
        slug: `barbearia-avaliada-${shopRatedId.slice(0, 8)}`,
        cnpj: "11111111000111",
        location: "Rua das Flores, 100",
        status: "ACTIVE",
      },
      {
        id: shopUnratedId,
        name: "Barbearia Sem Avaliacao",
        ownerId,
        slug: `barbearia-vazia-${shopUnratedId.slice(0, 8)}`,
        cnpj: "22222222000122",
        location: "Rua Vazia, 200",
        // Intentional stale column values to verify discovery queries ignore unbacked columns
        rating: "4.90",
        reviewCount: 99,
        status: "ACTIVE",
      },
    ]);

    await db.insert(barbershopLocations).values([
      {
        barbershopId: shopRatedId,
        latitude: -23.55052,
        longitude: -46.633308,
        status: "CONFIRMED",
      },
      {
        barbershopId: shopUnratedId,
        latitude: -23.55152,
        longitude: -46.634308,
        status: "CONFIRMED",
      },
    ]);

    await db.insert(membership).values({
      barbershopId: shopRatedId,
      userId: barberId,
      role: "BARBERMAN",
      state: "ACTIVE",
    });

    await db.insert(services).values([
      {
        id: serviceCorteId,
        barbershopId: shopRatedId,
        title: "Corte Clássico",
        priceInCents: 6000,
        durationInMinutes: 40,
        isFeatured: true,
        featuredOrder: 1,
        isActive: true,
      },
      {
        id: serviceBarbaId,
        barbershopId: shopRatedId,
        title: "Barba Completa",
        priceInCents: 4500,
        durationInMinutes: 30,
        isFeatured: true,
        featuredOrder: 2,
        isActive: true,
      },
      {
        id: serviceUnratedId,
        barbershopId: shopUnratedId,
        title: "Corte Simples",
        priceInCents: 3500,
        durationInMinutes: 30,
        isFeatured: true,
        featuredOrder: 1,
        isActive: true,
      },
    ]);

    const now = new Date();
    await db.insert(bookings).values([
      {
        id: booking1Id,
        barbershopId: shopRatedId,
        barbermanId: barberId,
        customerId: clientId,
        date: now,
        startTime: "10:00",
        endTime: "11:10",
        status: "COMPLETED",
      },
      {
        id: booking2Id,
        barbershopId: shopRatedId,
        barbermanId: barberId,
        customerId: client2Id,
        date: now,
        startTime: "11:30",
        endTime: "12:10",
        status: "COMPLETED",
      },
      {
        id: snapshotBookingId,
        barbershopId: shopRatedId,
        barbermanId: barberId,
        customerId: clientId,
        date: now,
        startTime: "14:00",
        endTime: "14:30",
        status: "COMPLETED",
      },
    ]);

    await db.insert(bookingServiceItems).values([
      {
        bookingId: booking1Id,
        serviceId: serviceCorteId,
        title: "Corte Clássico",
        priceInCents: 6000,
        durationInMinutes: 40,
      },
      {
        bookingId: booking1Id,
        serviceId: serviceBarbaId,
        title: "Barba Completa",
        priceInCents: 4500,
        durationInMinutes: 30,
      },
      {
        bookingId: booking2Id,
        serviceId: serviceCorteId,
        title: "Corte Clássico",
        priceInCents: 6000,
        durationInMinutes: 40,
      },
      {
        id: snapshotItemId,
        bookingId: snapshotBookingId,
        serviceId: null,
        title: "Combo Legado Sem ServiceId",
        priceInCents: 9000,
        durationInMinutes: 60,
        legacyAggregate: true,
      },
    ]);
  });

  afterAll(async () => {
    await truncateTestData();
    await pool.end();
  });

  it("persiste avaliação multi-alvo, recalcula barbearia/serviços/barbeiro de forma independente e isola platform_feedbacks", async () => {
    const res1 = await createReviewUseCase.execute({
      userId: clientId,
      bookingId: booking1Id,
      rating: 5,
      barberId,
      barberRating: 4,
      serviceRatings: [
        { serviceId: serviceCorteId, rating: 3 },
        { serviceId: serviceBarbaId, rating: 2 },
      ],
      comment: "Ótima barbearia.",
      platformFeedback: {
        rating: 1,
        comment: "Melhorar busca do app.",
      },
    });
    expect(res1.isRight()).toBe(true);

    const res2 = await createReviewUseCase.execute({
      userId: client2Id,
      bookingId: booking2Id,
      rating: 3,
      barberId,
      barberRating: 2,
      serviceRatings: [{ serviceId: serviceCorteId, rating: 5 }],
      comment: "Bom corte.",
    });
    expect(res2.isRight()).toBe(true);

    const [shopRow] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, shopRatedId));
    expect(Number(shopRow.rating)).toBe(4); // (5 + 3) / 2
    expect(shopRow.reviewCount).toBe(2);

    const [corteRow] = await db
      .select()
      .from(services)
      .where(eq(services.id, serviceCorteId));
    expect(Number(corteRow.rating)).toBe(4); // (3 + 5) / 2
    expect(corteRow.reviewCount).toBe(2);

    const [barbaRow] = await db
      .select()
      .from(services)
      .where(eq(services.id, serviceBarbaId));
    expect(Number(barbaRow.rating)).toBe(2);
    expect(barbaRow.reviewCount).toBe(1);

    const barberMetrics = await reviewsRepository.getTargetRatingMetrics(
      "BARBER",
      barberId,
    );
    expect(barberMetrics.averageRating).toBe(3); // (4 + 2) / 2
    expect(barberMetrics.reviewCount).toBe(2);

    const feedbacks = await db.select().from(platformFeedbacks);
    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0].rating).toBe(1);
    expect(feedbacks[0].comment).toBe("Melhorar busca do app.");
  });

  it("rejeita duplicação por alvo no banco de dados e suporta snapshot sem service_id", async () => {
    const snapRes = await createReviewUseCase.execute({
      userId: clientId,
      bookingId: snapshotBookingId,
      rating: 4,
      serviceRatings: [{ bookingServiceItemId: snapshotItemId, rating: 5 }],
    });
    expect(snapRes.isRight()).toBe(true);
    if (!snapRes.isRight()) return;

    const reviewId = snapRes.value.review.id.toString();
    const persistedItems = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.reviewId, reviewId));
    expect(persistedItems).toHaveLength(2);
    const snapItem = persistedItems.find((i) => i.targetType === "SERVICE");
    expect(snapItem?.targetId).toBeNull();
    expect(snapItem?.bookingServiceItemId).toBe(snapshotItemId);
    expect(snapItem?.targetLabel).toBe("Combo Legado Sem ServiceId");

    // Partial/unique constraint enforcement at PG level
    await expect(
      db.insert(reviewItems).values({
        reviewId,
        bookingId: snapshotBookingId,
        targetType: "BARBERSHOP",
        targetId: shopRatedId,
        targetKey: `BARBERSHOP:${shopRatedId}`,
        targetLabel: "Dup",
        rating: 1,
      }),
    ).rejects.toThrow();
  });

  it("garante controle de concorrência otimista em atualizações simultâneas e consistência na moderação e exclusão", async () => {
    const created = await createReviewUseCase.execute({
      userId: clientId,
      bookingId: booking1Id,
      rating: 5,
      barberRating: 5,
      serviceRatings: [{ serviceId: serviceCorteId, rating: 4 }],
    });
    expect(created.isRight()).toBe(true);
    if (!created.isRight()) return;

    const reviewId = created.value.review.id.toString();

    const [attemptA, attemptB] = await Promise.all([
      updateReviewUseCase.execute({
        userId: clientId,
        reviewId,
        rating: 2,
        serviceRatings: [{ serviceId: serviceBarbaId, rating: 1 }],
        expectedVersion: 1,
      }),
      updateReviewUseCase.execute({
        userId: clientId,
        reviewId,
        rating: 3,
        serviceRatings: [{ serviceId: serviceCorteId, rating: 5 }],
        expectedVersion: 1,
      }),
    ]);

    const successes = [attemptA, attemptB].filter((r) => r.isRight());
    const conflicts = [attemptA, attemptB].filter((r) => r.isLeft());
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    // Moderate HIDE -> barbershop, barber and service counts drop to 0
    const modHide = await moderateReviewUseCase.execute({
      adminUserId: adminId,
      reviewId,
      action: "HIDE",
      note: "Teste de moderação",
      expectedVersion: 2,
    });
    expect(modHide.isRight()).toBe(true);

    const [shopAfterHide] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, shopRatedId));
    expect(shopAfterHide.reviewCount).toBe(0);
    expect(Number(shopAfterHide.rating)).toBe(0);

    const corteAfterHide = await reviewsRepository.getTargetRatingMetrics(
      "SERVICE",
      serviceCorteId,
    );
    expect(corteAfterHide.reviewCount).toBe(0);
    expect(corteAfterHide.averageRating).toBeNull();

    // RESTORE -> metrics come back
    const modRestore = await moderateReviewUseCase.execute({
      adminUserId: adminId,
      reviewId,
      action: "RESTORE",
      note: "Restaurada",
      expectedVersion: 3,
    });
    expect(modRestore.isRight()).toBe(true);

    const [shopAfterRestore] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, shopRatedId));
    expect(shopAfterRestore.reviewCount).toBe(1);

    // Delete -> drops to 0 cleanly
    const deleted = await deleteReviewUseCase.execute({
      userId: clientId,
      reviewId,
      expectedVersion: 4,
    });
    expect(deleted.isRight()).toBe(true);

    const [shopAfterDelete] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, shopRatedId));
    expect(shopAfterDelete.reviewCount).toBe(0);
  });

  it("propaga rating e reviewCount reais por alvo no Explore e searchAll mantendo estado honesto sem avaliações", async () => {
    await createReviewUseCase.execute({
      userId: clientId,
      bookingId: booking1Id,
      rating: 5,
      barberRating: 1, // Deve ficar isolado e NÃO contaminar a nota da barbearia nem do serviço
      serviceRatings: [{ serviceId: serviceCorteId, rating: 3 }],
      platformFeedback: { rating: 1, comment: "Privado" },
    });

    const servicePhoto1Id = randomUUID();
    const servicePhoto2Id = randomUUID();

    await db.insert(media).values([
      {
        id: media1Id,
        ownerId,
        ownerType: "BARBERSHOP",
        ownerEntityId: shopRatedId,
        purpose: "BARBERSHOP_GALLERY",
        objectKey: `test/${media1Id}.jpg`,
        publicUrl: "https://cdn.example.com/rated.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        width: 1080,
        height: 1350,
        status: "READY",
      },
      {
        id: servicePhoto1Id,
        ownerId,
        ownerType: "BARBERSHOP",
        ownerEntityId: shopRatedId,
        purpose: "SERVICE_PHOTO",
        objectKey: `test/${servicePhoto1Id}.jpg`,
        publicUrl: "https://cdn.example.com/service-corte.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        width: 1080,
        height: 1350,
        status: "READY",
      },
      {
        id: servicePhoto2Id,
        ownerId,
        ownerType: "BARBERSHOP",
        ownerEntityId: shopRatedId,
        purpose: "SERVICE_PHOTO",
        objectKey: `test/${servicePhoto2Id}.jpg`,
        publicUrl: "https://cdn.example.com/service-barba.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        width: 1080,
        height: 1350,
        status: "READY",
      },
      {
        id: media2Id,
        ownerId,
        ownerType: "BARBERSHOP",
        ownerEntityId: shopUnratedId,
        purpose: "BARBERSHOP_GALLERY",
        objectKey: `test/${media2Id}.jpg`,
        publicUrl: "https://cdn.example.com/unrated.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        width: 1080,
        height: 1350,
        status: "READY",
      },
    ]);

    await db.insert(barbershopGallery).values([
      {
        barbershopId: shopRatedId,
        mediaId: media1Id,
        displayOrder: 0,
        isCover: true,
      },
      {
        barbershopId: shopUnratedId,
        mediaId: media2Id,
        displayOrder: 0,
        isCover: true,
      },
    ]);

    await db.insert(serviceMedia).values([
      {
        serviceId: serviceCorteId,
        mediaId: servicePhoto1Id,
        displayOrder: 0,
      },
      {
        serviceId: serviceBarbaId,
        mediaId: servicePhoto2Id,
        displayOrder: 0,
      },
    ]);

    const discoveryPage = await discoveryRepository.search({
      mode: "ALL",
      page: 1,
      limit: 10,
    });
    const ratedShop = discoveryPage.items.find((s) => s.id === shopRatedId);
    const unratedShop = discoveryPage.items.find((s) => s.id === shopUnratedId);

    expect(ratedShop?.rating).toBe(5);
    expect(ratedShop?.reviewCount).toBe(1);
    const ratedCorte = ratedShop?.featuredServices?.find(
      (s) => s.id === serviceCorteId,
    );
    const ratedBarba = ratedShop?.featuredServices?.find(
      (s) => s.id === serviceBarbaId,
    );
    expect(ratedCorte?.rating).toBe(3);
    expect(ratedCorte?.reviewCount).toBe(1);
    expect(ratedBarba?.rating).toBeNull();
    expect(ratedBarba?.reviewCount).toBe(0);

    // Even with fake stale columns on barbershops table, discovery query strictly aggregates PUBLISHED reviews
    expect(unratedShop?.rating).toBeNull();
    expect(unratedShop?.reviewCount).toBe(0);

    const exploreRes = await getExploreFeedUseCase.execute({
      mode: "ALL",
      limit: 10,
    });
    expect(exploreRes.isRight()).toBe(true);
    if (exploreRes.isRight()) {
      const exploreRated = exploreRes.value.items.find(
        (i) => i.barbershop.id === shopRatedId,
      );
      const exploreUnrated = exploreRes.value.items.find(
        (i) => i.barbershop.id === shopUnratedId,
      );
      expect(exploreRated?.barbershop.rating).toBe(5);
      expect(exploreRated?.barbershop.reviewCount).toBe(1);
      expect(exploreRated?.media[0]?.service?.id).toBe(serviceCorteId);
      expect(exploreRated?.media[0]?.service?.rating).toBe(3);
      expect(exploreRated?.media[0]?.service?.reviewCount).toBe(1);

      expect(exploreUnrated?.barbershop.rating).toBeNull();
      expect(exploreUnrated?.barbershop.reviewCount).toBe(0);
    }
  });

  it("executa backfill da migration em avaliações legadas de forma idempotente", async () => {
    const legacyReviewId = randomUUID();
    await db.insert(reviews).values({
      id: legacyReviewId,
      bookingId: booking1Id,
      barbershopId: shopRatedId,
      customerId: clientId,
      rating: 4,
      comment: "Avaliação legada pré-migração",
      status: "PUBLISHED",
      version: 1,
    });

    const migrationSql = readFileSync(
      resolve(
        process.cwd(),
        "drizzle/20261113140000_reviews_multi_target/migration.sql",
      ),
      "utf-8",
    );

    // Run twice to guarantee full idempotency
    await db.execute(sql.raw(migrationSql));
    await db.execute(sql.raw(migrationSql));

    const items = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.reviewId, legacyReviewId));
    expect(items).toHaveLength(1);
    expect(items[0].targetType).toBe("BARBERSHOP");
    expect(items[0].targetId).toBe(shopRatedId);
    expect(items[0].rating).toBe(4);

    const [shop] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.id, shopRatedId));
    expect(Number(shop.rating)).toBe(4);
    expect(shop.reviewCount).toBe(1);
  });
});
