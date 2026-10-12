import {
  eq,
  and,
  gte,
  lte,
  lt,
  gt,
  ne,
  isNull,
  notInArray,
  or,
  asc,
} from "drizzle-orm";
import { db } from "../index";
import {
  bookings,
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
} from "../../../domain/application/repositories/bookings-repository";
import type { Booking } from "../../../domain/enterprise/entities/booking";
import { BookingDetails } from "../../../domain/enterprise/entities/booking-details";
import { BookingMapper } from "../../../domain/enterprise/mappers/booking-mapper";
import { BookingDetailsMapper } from "../../../domain/enterprise/mappers/booking-details-mapper";
import { ServiceItemMapper } from "../../../domain/enterprise/mappers/service-item-mapper";
import { ShoppingCartMapper } from "../../../domain/enterprise/mappers/shopping-cart-mapper";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";

export class DrizzleBookingsRepository implements BookingsRepository {
  async findManyByBarbermanAndDate({
    barbermanId,
    date,
  }: FindManyByBarbermanAndDateParams): Promise<Booking[]> {
    const dateStr = new Date(date).toISOString().split("T")[0];
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const result = await db
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

    return result.map((row) => BookingMapper.toDomain(row));
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
    const client = tx ?? db;
    const targetDateStr = startAt.toISOString().split("T")[0];
    const targetStartOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);

    const startHour = String(startAt.getUTCHours()).padStart(2, "0");
    const startMin = String(startAt.getUTCMinutes()).padStart(2, "0");
    const targetStartTime = `${startHour}:${startMin}`;

    const endHour = String(endAt.getUTCHours()).padStart(2, "0");
    const endMin = String(endAt.getUTCMinutes()).padStart(2, "0");
    const targetEndTime = `${endHour}:${endMin}`;

    const filters = [
      eq(bookings.barbermanId, barbermanId),
      or(ne(bookings.status, "CANCELLED"), isNull(bookings.status)),
      or(
        and(
          bookings.startsAt ? lt(bookings.startsAt, endAt) : undefined,
          bookings.endsAt ? gt(bookings.endsAt, startAt) : undefined,
        ),
        and(
          eq(bookings.date, targetStartOfDay),
          lt(bookings.startTime, targetEndTime),
          gt(bookings.endTime, targetStartTime),
        ),
      ),
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

  async getDetails(
    bookingId: string,
    tx?: any,
  ): Promise<BookingDetails | null> {
    const client = tx ?? db;
    const [bookingRow] = await client
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!bookingRow) return null;

    // Load customer
    let customerRow: {
      id: string;
      name: string;
      phoneNumber: string | null;
    } | null = null;
    if (bookingRow.customerId) {
      const [user] = await client
        .select({
          id: users.id,
          name: users.name,
          phoneNumber: users.phoneNumber,
        })
        .from(users)
        .where(eq(users.id, bookingRow.customerId));
      customerRow = user ?? null;
    }

    if (!customerRow && bookingRow.shoppingCartId) {
      const [cartUser] = await client
        .select({
          id: users.id,
          name: users.name,
          phoneNumber: users.phoneNumber,
        })
        .from(shoppingCarts)
        .innerJoin(users, eq(shoppingCarts.userId, users.id))
        .where(eq(shoppingCarts.id, bookingRow.shoppingCartId));
      customerRow = cartUser ?? null;
    }

    const fallbackCustomer = customerRow ?? {
      id: bookingRow.customerId ?? bookingRow.barbermanId,
      name: "Cliente",
      phoneNumber: null,
    };

    // Load booking service items
    const itemRows = await client
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId));

    if (itemRows.length > 0) {
      return BookingDetailsMapper.toDomain({
        booking: {
          id: bookingRow.id,
          barbershopId: bookingRow.barbershopId,
          barbermanId: bookingRow.barbermanId,
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
      });
    }

    // Fallback: legacy shopping cart join if booking_service_items is empty
    if (bookingRow.shoppingCartId) {
      const [legacyRow] = await db
        .select({
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
            durationInMinutesSnapshot: serviceItems.durationInMinutesSnapshot,
          },
        })
        .from(shoppingCarts)
        .innerJoin(users, eq(shoppingCarts.userId, users.id))
        .innerJoin(
          serviceItems,
          eq(shoppingCarts.serviceItemId, serviceItems.id),
        )
        .innerJoin(services, eq(serviceItems.serviceId, services.id))
        .where(eq(shoppingCarts.id, bookingRow.shoppingCartId));

      if (legacyRow) {
        return BookingDetailsMapper.toDomain({
          booking: {
            id: bookingRow.id,
            barbershopId: bookingRow.barbershopId,
            barbermanId: bookingRow.barbermanId,
            customerId: bookingRow.customerId ?? legacyRow.customer.id,
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
          customer: legacyRow.customer,
          service: legacyRow.service,
          serviceItem: legacyRow.serviceItem,
        });
      }
    }

    // Bare booking without items or cart
    return BookingDetails.create({
      bookingId: new UniqueEntityId(bookingRow.id),
      barbershopId: new UniqueEntityId(bookingRow.barbershopId),
      barbermanId: new UniqueEntityId(bookingRow.barbermanId),
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
    });
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
    const bookingsList = await this.findManyByBarbermanAndDate({
      barbermanId,
      date,
    });

    const detailsList: BookingDetails[] = [];
    for (const b of bookingsList) {
      const details = await this.getDetails(b.id.toString());
      if (details) {
        detailsList.push(details);
      }
    }

    return detailsList;
  }

  async findManyByCustomerId(
    customerId: string,
    options?: { page?: number },
  ): Promise<BookingDetails[]> {
    const page = options?.page ?? 1;

    // Search by bookings.customerId OR shoppingCarts.userId
    const rows = await db
      .select({ id: bookings.id })
      .from(bookings)
      .leftJoin(shoppingCarts, eq(bookings.shoppingCartId, shoppingCarts.id))
      .where(and(eq(bookings.customerId, customerId)))
      .limit(20)
      .offset((page - 1) * 20);

    const bookingIds = rows.map((r) => r.id);
    if (bookingIds.length === 0) {
      // Fallback search by shoppingCart.userId for legacy
      const legacyRows = await db
        .select({ id: bookings.id })
        .from(bookings)
        .innerJoin(shoppingCarts, eq(bookings.shoppingCartId, shoppingCarts.id))
        .where(eq(shoppingCarts.userId, customerId))
        .limit(20)
        .offset((page - 1) * 20);
      bookingIds.push(...legacyRows.map((r) => r.id));
    }

    const detailsList: BookingDetails[] = [];
    for (const id of bookingIds) {
      const details = await this.getDetails(id);
      if (details) {
        detailsList.push(details);
      }
    }

    return detailsList;
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

  async findUnitBookings({
    barbershopId,
    barbermanId,
    date,
    status,
    page = 1,
    limit = 20,
  }: {
    barbershopId: string;
    barbermanId?: string;
    date?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const filters = [eq(bookings.barbershopId, barbershopId)];

    if (barbermanId) {
      filters.push(eq(bookings.barbermanId, barbermanId));
    }

    if (status) {
      filters.push(eq(bookings.status, status));
    }

    if (date) {
      const dateStr = date.split("T")[0];
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      filters.push(
        or(
          and(
            gte(bookings.startsAt, startOfDay),
            lte(bookings.startsAt, endOfDay),
          ),
          and(gte(bookings.date, startOfDay), lte(bookings.date, endOfDay)),
        )!,
      );
    }

    const whereClause = and(...filters);

    const summaryRows = await db
      .select({
        id: bookings.id,
        totalPriceInCents: bookings.totalPriceInCents,
        status: bookings.status,
      })
      .from(bookings)
      .where(whereClause);

    const total = summaryRows.length;
    let totalAmountInCents = 0;
    let hasIncompleteData = false;
    const statusCounts: Record<string, number> = {};

    for (const r of summaryRows) {
      if (r.totalPriceInCents === null || r.totalPriceInCents === undefined) {
        hasIncompleteData = true;
      } else {
        totalAmountInCents += r.totalPriceInCents;
      }

      const st = r.status ?? "UNKNOWN";
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    }

    const pageLimit = Math.min(Math.max(1, limit), 100);
    const offset = (Math.max(1, page) - 1) * pageLimit;

    const pageRows = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(whereClause)
      .orderBy(asc(bookings.startsAt), asc(bookings.id))
      .limit(pageLimit)
      .offset(offset);

    const items: BookingDetails[] = [];
    for (const row of pageRows) {
      const details = await this.getDetails(row.id);
      if (details) {
        items.push(details);
      }
    }

    const hasNext = offset + pageRows.length < total;

    return {
      items,
      page: Math.max(1, page),
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
