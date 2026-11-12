import {
  eq,
  and,
  gte,
  lte,
  lt,
  gt,
  ne,
  isNull,
  isNotNull,
  notInArray,
  inArray,
  or,
  asc,
  desc,
  sql,
  getTableColumns,
} from "drizzle-orm";
import { db } from "../index";
import { env } from "../../env";
import {
  bookings,
  barbershops,
  shoppingCarts,
  users,
  serviceItems,
  services,
  notifications,
  bookingServiceItems,
  bookingEvents,
} from "../schema";
import type {
  BookingsRepository,
  CreateBookingBundleParams,
  CreateBookingWithItemsParams,
  FindManyByBarbermanAndDateParams,
  FindOverlappingParams,
  FindManyByShoppingCartParams,
  FindManyByCustomerIdOptions,
} from "../../../domain/application/repositories/bookings-repository";
import type { Booking } from "../../../domain/enterprise/entities/booking";
import { BookingDetails } from "../../../domain/enterprise/entities/booking-details";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";
import { BookingDetailsMapper } from "../../../domain/enterprise/mappers/booking-details-mapper";
import { ServiceItemMapper } from "../../../domain/enterprise/mappers/service-item-mapper";
import { ShoppingCartMapper } from "../../../domain/enterprise/mappers/shopping-cart-mapper";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";

// Legacy civil times belong to the booking timezone, never the UTC hour of a new request.
const blockingStart = sql<Date>`coalesce(${bookings.startsAt}, ((${bookings.date}::date + ${bookings.startTime}::time) at time zone ${bookings.timezone}))`;
const blockingEnd = sql<Date>`coalesce(${bookings.endsAt}, ((${bookings.date}::date + ${bookings.endTime}::time) at time zone ${bookings.timezone}))`;

function getOffsetForTimezone(dateStr: string, timeZone: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(d);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tzPart) {
      const offset = tzPart.replace("GMT", "");
      if (offset === "") return "Z";
      if (offset === "+00:00") return "+00:00";
      return offset;
    }
  } catch (_e) {}
  return "-03:00";
}

function resolveCivilDayUtcRange(
  dateStr: string,
  timeZone = "America/Sao_Paulo",
): { startUtc: Date; endUtc: Date } {
  const cleanDate = dateStr.split("T")[0];
  const nextDate = new Date(Date.parse(`${cleanDate}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  const startOffset = getOffsetForTimezone(cleanDate, timeZone);
  const endOffset = getOffsetForTimezone(nextDate, timeZone);
  return {
    startUtc: new Date(`${cleanDate}T00:00:00${startOffset}`),
    endUtc: new Date(`${nextDate}T00:00:00${endOffset}`),
  };
}

export class DrizzleBookingsRepository implements BookingsRepository {
  private customDb?: any;

  constructor(customDb?: any) {
    this.customDb = customDb;
  }

  private get database(): any {
    return this.customDb ?? db;
  }

  async findManyByBarbermanAndDate({
    barbermanId,
    date,
    range,
  }: FindManyByBarbermanAndDateParams): Promise<Booking[]> {
    if (range) {
      const result = await this.database
        .select({
          ...getTableColumns(bookings),
          startsAt: blockingStart,
          endsAt: blockingEnd,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.barbermanId, barbermanId),
            or(ne(bookings.status, "CANCELLED"), isNull(bookings.status)),
            lt(blockingStart, range.endAt),
            gt(blockingEnd, range.startAt),
          ),
        );
      return result.map((row: typeof bookings.$inferSelect) =>
        BookingMapper.toDomain({
          ...row,
          startsAt: row.startsAt == null ? null : new Date(row.startsAt),
          endsAt: row.endsAt == null ? null : new Date(row.endsAt),
        }),
      );
    }
    const dateStr = new Date(date).toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const result = await this.database
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.barbermanId, barbermanId),
          gte(bookings.date, startOfDay),
          lte(bookings.date, endOfDay),
          or(ne(bookings.status, "CANCELLED"), isNull(bookings.status)),
        ),
      );

    return result.map((row: typeof bookings.$inferSelect) =>
      BookingMapper.toDomain(row),
    );
  }

  async create(booking: Booking): Promise<void> {
    const data = BookingMapper.toPersistence(booking);
    await db.insert(bookings).values(data);
  }

  async createWithItemAndCart({
    booking,
    serviceItem,
    cart,
  }: CreateBookingBundleParams): Promise<void> {
    const serviceItemData = ServiceItemMapper.toPersistence(serviceItem);
    const cartData = ShoppingCartMapper.toPersistence(cart);
    const bookingData = BookingMapper.toPersistence(booking);

    await db.transaction(async (tx) => {
      await tx.insert(serviceItems).values(serviceItemData);
      await tx.insert(shoppingCarts).values(cartData);
      await tx.insert(bookings).values(bookingData);
    });
  }

  async createWithItems({
    booking,
    items,
    tx,
  }: CreateBookingWithItemsParams): Promise<void> {
    const bookingData = BookingMapper.toPersistence(booking);

    if (items.length > 0) {
      const hasUnknownPrice = items.some((i) => i.priceInCents === null);
      if (
        bookingData.totalPriceInCents === null ||
        bookingData.totalPriceInCents === undefined
      ) {
        bookingData.totalPriceInCents = hasUnknownPrice
          ? null
          : items.reduce((acc, i) => acc + (i.priceInCents ?? 0), 0);
      }

      const hasUnknownDuration = items.some(
        (i) => i.durationInMinutes === null,
      );
      if (
        bookingData.totalDurationInMinutes === null ||
        bookingData.totalDurationInMinutes === undefined
      ) {
        bookingData.totalDurationInMinutes = hasUnknownDuration
          ? null
          : items.reduce((acc, i) => acc + (i.durationInMinutes ?? 0), 0);
      }
    }

    const runOperations = async (client: any) => {
      await client.insert(bookings).values(bookingData);

      if (items.length > 0) {
        const itemsData = items.map((item) => ({
          id: item.id.toString(),
          bookingId: booking.id.toString(),
          serviceId: item.serviceId ? item.serviceId.toString() : null,
          title: item.title,
          priceInCents: item.priceInCents,
          durationInMinutes: item.durationInMinutes,
          legacyAggregate: item.legacyAggregate,
          createdAt: item.createdAt,
        }));

        await client.insert(bookingServiceItems).values(itemsData);
      }

      await client.insert(bookingEvents).values({
        bookingId: booking.id.toString(),
        actorId: booking.createdByUserId
          ? booking.createdByUserId.toString()
          : booking.customerId
            ? booking.customerId.toString()
            : null,
        eventType: "CREATED",
        previousVersion: null,
        newVersion: booking.version,
        previousStatus: null,
        newStatus: booking.status ?? "CONFIRMED",
        reason: null,
        metadata: JSON.stringify({
          startsAt: booking.startsAt?.toISOString() ?? null,
          endsAt: booking.endsAt?.toISOString() ?? null,
          timezone: booking.timezone,
          itemsCount: items.length,
        }),
      });
    };

    if (tx) {
      await runOperations(tx);
    } else {
      await db.transaction(runOperations);
    }
  }

  async save(
    booking: Booking,
    tx?: any,
    options?: {
      event?: {
        actorId?: string | null;
        eventType: string;
        previousVersion?: number | null;
        newVersion: number;
        previousStatus?: string | null;
        newStatus?: string | null;
        reason?: string | null;
        metadata?: any;
      };
      updateItems?: boolean;
    },
  ): Promise<void> {
    const data = BookingMapper.toPersistence(booking);
    const client = tx ?? db;
    await client
      .update(bookings)
      .set(data)
      .where(eq(bookings.id, booking.id.toString()));

    if (
      options?.updateItems &&
      booking.services &&
      booking.services.length > 0
    ) {
      await client
        .delete(bookingServiceItems)
        .where(eq(bookingServiceItems.bookingId, booking.id.toString()));

      const itemsData = booking.services.map((item) => ({
        bookingId: booking.id.toString(),
        serviceId: item.serviceId ?? null,
        title: item.title,
        priceInCents: item.priceInCents,
        durationInMinutes: item.durationInMinutes,
        legacyAggregate: false,
      }));

      await client.insert(bookingServiceItems).values(itemsData);
    }

    if (options?.event) {
      await client.insert(bookingEvents).values({
        bookingId: booking.id.toString(),
        actorId: options.event.actorId ?? null,
        eventType: options.event.eventType,
        previousVersion: options.event.previousVersion ?? null,
        newVersion: options.event.newVersion,
        previousStatus: options.event.previousStatus ?? null,
        newStatus: options.event.newStatus ?? null,
        reason: options.event.reason ?? null,
        metadata: options.event.metadata
          ? JSON.stringify(options.event.metadata)
          : null,
      });
    }
  }

  async findById(id: string): Promise<Booking | null> {
    const [result] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id));

    if (!result) return null;

    return BookingMapper.toDomain(result);
  }

  async findOverlapping({
    barbermanId,
    barbershopId: _barbershopId,
    startAt,
    endAt,
    excludeBookingId,
    tx,
  }: FindOverlappingParams): Promise<Booking | null> {
    const client = tx ?? this.database;

    const filters = [
      eq(bookings.barbermanId, barbermanId),
      or(ne(bookings.status, "CANCELLED"), isNull(bookings.status)),
      lt(blockingStart, endAt),
      gt(blockingEnd, startAt),
    ];

    if (excludeBookingId) {
      filters.push(ne(bookings.id, excludeBookingId));
    }

    const [result] = await client
      .select()
      .from(bookings)
      .where(and(...filters));

    if (!result) return null;

    return BookingMapper.toDomain(result);
  }

  async findManyByShoppingCart({
    shoppingCartId,
    page = 1,
  }: FindManyByShoppingCartParams): Promise<Booking[]> {
    const result = await db
      .select()
      .from(bookings)
      .where(eq(bookings.shoppingCartId, shoppingCartId))
      .limit(20)
      .offset((page - 1) * 20);

    return result.map((row) => BookingMapper.toDomain(row));
  }

  private async hydrateBookingsDetailsBatch(
    bookingRows: Array<typeof bookings.$inferSelect>,
    tx?: any,
  ): Promise<BookingDetails[]> {
    if (bookingRows.length === 0) return [];
    const client = tx ?? this.database;

    const bookingIds = bookingRows.map((r) => r.id);
    const barbershopIds = Array.from(
      new Set(bookingRows.map((r) => r.barbershopId).filter(Boolean)),
    );
    const shoppingCartIds = Array.from(
      new Set(
        bookingRows
          .map((r) => r.shoppingCartId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const userIdsSet = new Set<string>();
    for (const r of bookingRows) {
      if (r.customerId) userIdsSet.add(r.customerId);
      if (r.barbermanId) userIdsSet.add(r.barbermanId);
    }
    const userIds = Array.from(userIdsSet);

    const fetchItems = () =>
      client
        .select()
        .from(bookingServiceItems)
        .where(inArray(bookingServiceItems.bookingId, bookingIds));

    const fetchShops = () =>
      barbershopIds.length > 0
        ? client
            .select({
              id: barbershops.id,
              name: barbershops.name,
              ownerPhone: users.phoneNumber,
            })
            .from(barbershops)
            .leftJoin(users, eq(barbershops.ownerId, users.id))
            .where(inArray(barbershops.id, barbershopIds))
        : Promise.resolve([]);

    const fetchUsers = () =>
      userIds.length > 0
        ? client
            .select({
              id: users.id,
              name: users.name,
              phoneNumber: users.phoneNumber,
            })
            .from(users)
            .where(inArray(users.id, userIds))
        : Promise.resolve([]);

    const fetchLegacyCarts = () =>
      shoppingCartIds.length > 0
        ? client
            .select({
              cartId: shoppingCarts.id,
              customer: {
                id: users.id,
                name: users.name,
                phoneNumber: users.phoneNumber,
              },
              service: {
                id: services.id,
                title: services.title,
                priceInCents: services.priceInCents,
                durationInMinutes: services.durationInMinutes,
              },
              serviceItem: {
                titleSnapshot: serviceItems.titleSnapshot,
                priceInCentsSnapshot: serviceItems.priceInCentsSnapshot,
                durationInMinutesSnapshot:
                  serviceItems.durationInMinutesSnapshot,
              },
            })
            .from(shoppingCarts)
            .innerJoin(users, eq(shoppingCarts.userId, users.id))
            .leftJoin(
              serviceItems,
              eq(shoppingCarts.serviceItemId, serviceItems.id),
            )
            .leftJoin(services, eq(serviceItems.serviceId, services.id))
            .where(inArray(shoppingCarts.id, shoppingCartIds))
        : Promise.resolve([]);

    let allItems: any[];
    let shopRows: Array<{
      id: string;
      name: string;
      ownerPhone: string | null;
    }>;
    let userRows: Array<{
      id: string;
      name: string;
      phoneNumber: string | null;
    }>;
    let legacyCartRows: any[];

    if (tx) {
      allItems = await fetchItems();
      shopRows = await fetchShops();
      userRows = await fetchUsers();
      legacyCartRows = await fetchLegacyCarts();
    } else {
      [allItems, shopRows, userRows, legacyCartRows] = await Promise.all([
        fetchItems(),
        fetchShops(),
        fetchUsers(),
        fetchLegacyCarts(),
      ]);
    }

    const itemsByBookingId = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsByBookingId.get(item.bookingId);
      if (list) {
        list.push(item);
      } else {
        itemsByBookingId.set(item.bookingId, [item]);
      }
    }

    const shopById = new Map<
      string,
      { name: string; ownerPhone: string | null }
    >();
    for (const s of shopRows) {
      shopById.set(s.id, { name: s.name, ownerPhone: s.ownerPhone });
    }

    const userById = new Map<
      string,
      { id: string; name: string; phoneNumber: string | null }
    >();
    for (const u of userRows) {
      userById.set(u.id, u);
    }

    const legacyCartById = new Map<string, any>();
    for (const c of legacyCartRows) {
      legacyCartById.set(c.cartId, c);
    }

    const result: BookingDetails[] = [];

    for (const bookingRow of bookingRows) {
      const shopInfo = bookingRow.barbershopId
        ? shopById.get(bookingRow.barbershopId)
        : undefined;
      const barbershopName = shopInfo?.name ?? null;
      const barbershopPhone = shopInfo?.ownerPhone ?? null;

      const barberRow = bookingRow.barbermanId
        ? userById.get(bookingRow.barbermanId)
        : undefined;
      const barbermanName = barberRow?.name ?? null;

      let customerRow = bookingRow.customerId
        ? (userById.get(bookingRow.customerId) ?? null)
        : null;
      const legacyCart = bookingRow.shoppingCartId
        ? legacyCartById.get(bookingRow.shoppingCartId)
        : undefined;

      if (!customerRow && legacyCart?.customer) {
        customerRow = legacyCart.customer;
      }

      const fallbackCustomer = customerRow ?? {
        id: bookingRow.customerId ?? bookingRow.barbermanId,
        name: "Cliente",
        phoneNumber: null,
      };

      const itemRows = itemsByBookingId.get(bookingRow.id) ?? [];

      if (itemRows.length > 0) {
        result.push(
          BookingDetailsMapper.toDomain({
            booking: {
              id: bookingRow.id,
              barbershopId: bookingRow.barbershopId,
              barbershopName,
              barbershopPhone,
              barbermanId: bookingRow.barbermanId,
              barbermanName,
              customerId: bookingRow.customerId ?? fallbackCustomer.id,
              shoppingCartId: bookingRow.shoppingCartId,
              startsAt: bookingRow.startsAt,
              endsAt: bookingRow.endsAt,
              timezone: bookingRow.timezone,
              status: bookingRow.status,
              version: bookingRow.version,
              createdByUserId: bookingRow.createdByUserId,
              clientRequestId: bookingRow.clientRequestId,
              totalPriceInCents: bookingRow.totalPriceInCents,
              totalDurationInMinutes: bookingRow.totalDurationInMinutes,
              date: bookingRow.date,
              startTime: bookingRow.startTime,
              endTime: bookingRow.endTime,
              createdAt: bookingRow.createdAt,
            },
            customer: fallbackCustomer,
            services: itemRows.map((item: any) => ({
              id: item.serviceId ?? undefined,
              serviceId: item.serviceId,
              title: item.title,
              priceInCents: item.priceInCents,
              durationInMinutes: item.durationInMinutes,
              legacyAggregate: item.legacyAggregate,
            })),
          }),
        );
        continue;
      }

      if (legacyCart?.service?.id) {
        result.push(
          BookingDetailsMapper.toDomain({
            booking: {
              id: bookingRow.id,
              barbershopId: bookingRow.barbershopId,
              barbershopName,
              barbershopPhone,
              barbermanId: bookingRow.barbermanId,
              barbermanName,
              customerId: bookingRow.customerId ?? legacyCart.customer.id,
              shoppingCartId: bookingRow.shoppingCartId,
              startsAt: bookingRow.startsAt,
              endsAt: bookingRow.endsAt,
              timezone: bookingRow.timezone,
              status: bookingRow.status,
              version: bookingRow.version,
              createdByUserId: bookingRow.createdByUserId,
              clientRequestId: bookingRow.clientRequestId,
              totalPriceInCents: bookingRow.totalPriceInCents,
              totalDurationInMinutes: bookingRow.totalDurationInMinutes,
              date: bookingRow.date,
              startTime: bookingRow.startTime,
              endTime: bookingRow.endTime,
              createdAt: bookingRow.createdAt,
            },
            customer: legacyCart.customer,
            service: legacyCart.service,
            serviceItem: legacyCart.serviceItem,
          }),
        );
        continue;
      }

      result.push(
        BookingDetails.create({
          bookingId: new UniqueEntityId(bookingRow.id),
          barbershopId: new UniqueEntityId(bookingRow.barbershopId),
          barbershopName,
          barbershopPhone,
          barbermanId: new UniqueEntityId(bookingRow.barbermanId),
          barbermanName,
          customerId: new UniqueEntityId(
            bookingRow.customerId ?? fallbackCustomer.id,
          ),
          shoppingCartId: bookingRow.shoppingCartId
            ? new UniqueEntityId(bookingRow.shoppingCartId)
            : null,
          customer: {
            id: new UniqueEntityId(fallbackCustomer.id),
            name: fallbackCustomer.name,
            phoneNumber: fallbackCustomer.phoneNumber ?? "",
          },
          services: [],
          startsAt: bookingRow.startsAt,
          endsAt: bookingRow.endsAt,
          timezone: bookingRow.timezone,
          status: bookingRow.status,
          version: bookingRow.version,
          createdByUserId: bookingRow.createdByUserId
            ? new UniqueEntityId(bookingRow.createdByUserId)
            : null,
          clientRequestId: bookingRow.clientRequestId,
          totalPriceInCents: bookingRow.totalPriceInCents,
          totalDurationInMinutes: bookingRow.totalDurationInMinutes,
          date: bookingRow.date,
          startTime: bookingRow.startTime,
          endTime: bookingRow.endTime,
          createdAt: bookingRow.createdAt ?? undefined,
        }),
      );
    }

    return result;
  }

  async getDetails(
    bookingId: string,
    tx?: any,
  ): Promise<BookingDetails | null> {
    const client = tx ?? this.database;
    const [bookingRow] = await client
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!bookingRow) return null;

    const [details] = await this.hydrateBookingsDetailsBatch(
      [bookingRow],
      client,
    );
    return details ?? null;
  }

  async findByIdWithDetails(
    bookingId: string,
    tx?: any,
  ): Promise<BookingDetails | null> {
    return this.getDetails(bookingId, tx);
  }

  async findManyWithDetailsByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<BookingDetails[]> {
    const dateStr = new Date(date).toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const rows = await this.database
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.barbermanId, barbermanId),
          gte(bookings.date, startOfDay),
          lte(bookings.date, endOfDay),
          or(ne(bookings.status, "CANCELLED"), isNull(bookings.status)),
        ),
      );

    return this.hydrateBookingsDetailsBatch(rows);
  }

  async findManyByCustomerId(
    customerId: string,
    options?: FindManyByCustomerIdOptions,
  ): Promise<BookingDetails[]> {
    const effectiveView = options?.filter ?? options?.view ?? "all";

    if (effectiveView === "upcoming") {
      const now = new Date();
      const limit = options?.limit ?? 1;

      return this.database.transaction(
        async (tx: any) => {
          const rows = await tx
            .select(getTableColumns(bookings))
            .from(bookings)
            .leftJoin(
              shoppingCarts,
              eq(bookings.shoppingCartId, shoppingCarts.id),
            )
            .where(
              and(
                or(
                  eq(bookings.customerId, customerId),
                  eq(shoppingCarts.userId, customerId),
                ),
                inArray(bookings.status, ["CONFIRMED", "IN_PROGRESS"]),
                isNotNull(bookings.startsAt),
                or(gte(bookings.startsAt, now), gt(bookings.endsAt, now)),
              ),
            )
            .orderBy(asc(bookings.startsAt), asc(bookings.id))
            .limit(limit);

          const detailsList = await this.hydrateBookingsDetailsBatch(rows, tx);
          return detailsList.filter(
            (details) =>
              details.status &&
              ["CONFIRMED", "IN_PROGRESS"].includes(details.status),
          );
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    }

    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(Math.max(1, options?.limit ?? 20), 50);
    const offset = (page - 1) * limit;

    const customerPredicates = [
      or(
        eq(bookings.customerId, customerId),
        eq(shoppingCarts.userId, customerId),
      )!,
    ];

    if (effectiveView === "past") {
      const now = new Date();
      customerPredicates.push(
        or(
          inArray(bookings.status, ["COMPLETED", "CANCELLED", "NO_SHOW"]),
          lt(
            sql`coalesce(${bookings.endsAt}, ${bookings.startsAt}, ${bookings.date})`,
            now,
          ),
        )!,
      );
    }

    const rows = await this.database
      .select(getTableColumns(bookings))
      .from(bookings)
      .leftJoin(shoppingCarts, eq(bookings.shoppingCartId, shoppingCarts.id))
      .where(and(...customerPredicates))
      .orderBy(
        desc(sql`coalesce(${bookings.startsAt}, ${bookings.date})`),
        desc(bookings.id),
      )
      .limit(limit)
      .offset(offset);

    if (env.FF_SQL_BOOKING_BATCH_HYDRATION === "false") {
      const detailsList: BookingDetails[] = [];
      for (const r of rows) {
        const d = await this.getDetails(r.id);
        if (d) detailsList.push(d);
      }
      return detailsList;
    }

    return this.hydrateBookingsDetailsBatch(rows);
  }

  async delete(booking: Booking): Promise<void> {
    const bookingId = booking.id.toString();
    await db.transaction(async (tx) => {
      await tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.referenceType, "BOOKING"),
            eq(notifications.referenceId, bookingId),
          ),
        );
      await tx
        .delete(bookingEvents)
        .where(eq(bookingEvents.bookingId, bookingId));
      await tx
        .delete(bookingServiceItems)
        .where(eq(bookingServiceItems.bookingId, bookingId));
      await tx.delete(bookings).where(eq(bookings.id, bookingId));
    });
  }

  async findActiveAndFutureBookingsForBarberman(
    barbershopId: string,
    barbermanId: string,
    now: Date,
    tx?: any,
  ): Promise<Booking[]> {
    const terminalStatuses = ["CANCELLED", "COMPLETED", "NO_SHOW"];
    const executor = tx ?? db;

    const rows = await executor
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.barbershopId, barbershopId),
          eq(bookings.barbermanId, barbermanId),
          or(
            isNull(bookings.status),
            notInArray(bookings.status, terminalStatuses),
          ),
          or(
            gt(bookings.endsAt, now),
            and(
              isNull(bookings.endsAt),
              gte(bookings.startsAt, new Date(now.getTime() - 60 * 60 * 1000)),
            ),
            gte(bookings.startsAt, now),
          ),
        ),
      );

    return rows.map(BookingMapper.toDomain);
  }

  async findActiveAndFutureBookings({
    barbershopId,
    barbermanId,
    now = new Date(),
    tx,
  }: {
    barbershopId: string;
    barbermanId?: string | null;
    now?: Date;
    tx?: any;
  }): Promise<Booking[]> {
    const terminalStatuses = ["CANCELLED", "COMPLETED", "NO_SHOW"];
    const executor = tx ?? db;

    const conditions = [
      eq(bookings.barbershopId, barbershopId),
      or(
        isNull(bookings.status),
        notInArray(bookings.status, terminalStatuses),
      ),
      or(
        gt(bookings.endsAt, now),
        and(
          isNull(bookings.endsAt),
          gte(bookings.startsAt, new Date(now.getTime() - 60 * 60 * 1000)),
        ),
        gte(bookings.startsAt, now),
      ),
    ];

    if (barbermanId) {
      conditions.push(eq(bookings.barbermanId, barbermanId));
    }

    const rows = await executor
      .select()
      .from(bookings)
      .where(and(...conditions));

    return rows.map(BookingMapper.toDomain);
  }

  async findUnitBookings({
    barbershopId,
    barbermanId,
    date,
    timezone = "America/Sao_Paulo",
    status,
    page = 1,
    limit = 20,
    includeSummary = true,
    bootstrapOnly = false,
  }: {
    barbershopId: string;
    barbermanId?: string;
    date?: string;
    timezone?: string;
    status?: string;
    page?: number;
    limit?: number;
    includeSummary?: boolean;
    bootstrapOnly?: boolean;
  }) {
    const pageLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);

    if (bootstrapOnly) {
      return {
        items: [],
        page: safePage,
        limit: pageLimit,
        total: 0,
        hasNext: false,
        summary: {
          totalBookings: 0,
          totalAmountInCents: 0,
          statusCounts: {},
          hasIncompleteData: false,
        },
      };
    }

    const filters = [eq(bookings.barbershopId, barbershopId)];

    if (barbermanId) {
      filters.push(eq(bookings.barbermanId, barbermanId));
    }

    if (status) {
      filters.push(eq(bookings.status, status));
    }

    if (date) {
      const [shop] = await this.database
        .select({ timezone: barbershops.timezone })
        .from(barbershops)
        .where(eq(barbershops.id, barbershopId));
      const zone = shop?.timezone ?? timezone;
      const startUtc = sql<Date>`${date}::date::timestamp AT TIME ZONE ${zone}`;
      const endUtc = sql<Date>`(${date}::date + INTERVAL '1 day')::timestamp AT TIME ZONE ${zone}`;
      filters.push(
        or(
          and(gte(bookings.startsAt, startUtc), lt(bookings.startsAt, endUtc)),
          and(
            isNull(bookings.startsAt),
            gte(bookings.date, new Date(`${date}T00:00:00Z`)),
            lt(
              bookings.date,
              new Date(Date.parse(`${date}T00:00:00Z`) + 86400000),
            ),
          ),
        )!,
      );
    }

    const whereClause = and(...filters);
    const offset = (safePage - 1) * pageLimit;

    if (!includeSummary) {
      const rawRows = await this.database
        .select()
        .from(bookings)
        .where(whereClause)
        .orderBy(asc(bookings.startsAt), asc(bookings.id))
        .limit(pageLimit + 1)
        .offset(offset);

      const hasNext = rawRows.length > pageLimit;
      const pageRows = rawRows.slice(0, pageLimit);
      const items = await this.hydrateBookingsDetailsBatch(pageRows);

      return {
        items,
        page: safePage,
        limit: pageLimit,
        total: offset + pageRows.length + (hasNext ? 1 : 0),
        hasNext,
        summary: {
          totalBookings: offset + pageRows.length + (hasNext ? 1 : 0),
          totalAmountInCents: 0,
          statusCounts: {},
          hasIncompleteData: false,
        },
      };
    }

    const [statusAggRows, pageRows] = await Promise.all([
      this.database
        .select({
          status: sql<string>`coalesce(${bookings.status}, 'UNKNOWN')`,
          count: sql<number>`count(*)::int`,
          amountInCents: sql<string>`coalesce(sum(${bookings.totalPriceInCents}), 0)::text`,
          hasIncomplete: sql<boolean>`coalesce(bool_or(${bookings.totalPriceInCents} is null), false)`,
        })
        .from(bookings)
        .where(whereClause)
        .groupBy(sql`coalesce(${bookings.status}, 'UNKNOWN')`),
      this.database
        .select()
        .from(bookings)
        .where(whereClause)
        .orderBy(asc(bookings.startsAt), asc(bookings.id))
        .limit(pageLimit)
        .offset(offset),
    ]);

    let total = 0;
    let totalAmountInCents = 0;
    let hasIncompleteData = false;
    const statusCounts: Record<string, number> = {};

    for (const r of statusAggRows) {
      const count = Number(r.count ?? 0);
      total += count;
      totalAmountInCents += Number(r.amountInCents ?? 0);
      if (!Number.isSafeInteger(totalAmountInCents))
        throw new Error("O total excedeu o limite de cálculo.");
      if (r.hasIncomplete) {
        hasIncompleteData = true;
      }
      const st = r.status ?? "UNKNOWN";
      statusCounts[st] = (statusCounts[st] ?? 0) + count;
    }

    let items: BookingDetails[];
    if (env.FF_SQL_BOOKING_BATCH_HYDRATION === "false") {
      items = [];
      for (const row of pageRows) {
        const details = await this.getDetails(row.id);
        if (details) items.push(details);
      }
    } else {
      items = await this.hydrateBookingsDetailsBatch(pageRows);
    }

    const hasNext = offset + pageRows.length < total;

    return {
      items,
      page: safePage,
      limit: pageLimit,
      total,
      hasNext,
      summary: {
        totalBookings: total,
        totalAmountInCents,
        statusCounts,
        hasIncompleteData,
      },
    };
  }
}
