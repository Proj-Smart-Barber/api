/** biome-ignore-all lint/complexity/noStaticOnlyClass: mapper class */
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import {
  BookingDetails,
  type BookingDetailsServiceItem,
} from "../entities/booking-details";

export interface PersistenceBookingDetails {
  booking: {
    id: string;
    barbershopId: string;
    barbermanId: string;
    customerId?: string | null;
    shoppingCartId?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    timezone?: string | null;
    status?: string | null;
    version?: number | null;
    createdByUserId?: string | null;
    clientRequestId?: string | null;
    totalPriceInCents?: number | null;
    totalDurationInMinutes?: number | null;
    date: Date;
    startTime: string;
    endTime: string;
    createdAt: Date | null;
  };
  customer: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  };
  services?: Array<{
    id?: string;
    serviceId: string | null;
    title: string;
    priceInCents: number | null;
    durationInMinutes: number | null;
    legacyAggregate: boolean;
  }>;
  service?: {
    id: string;
    title: string;
    priceInCents: number;
    durationInMinutes: number;
  };
  serviceItem?: {
    titleSnapshot?: string | null;
    priceInCentsSnapshot?: number | null;
    durationInMinutesSnapshot?: number | null;
  };
}

import {
  BookingPolicy,
  type BookingScope,
} from "../../application/services/booking-policy";

export class BookingDetailsMapper {
  static toDomain(raw: PersistenceBookingDetails): BookingDetails {
    let resolvedServices: BookingDetailsServiceItem[] = [];

    if (raw.services && raw.services.length > 0) {
      resolvedServices = raw.services.map((item) => ({
        id: item.serviceId ? new UniqueEntityId(item.serviceId) : undefined,
        serviceId: item.serviceId,
        title: item.title,
        priceInCents: item.priceInCents,
        durationInMinutes: item.durationInMinutes,
        legacyAggregate: item.legacyAggregate,
      }));
    } else if (raw.service) {
      const isAggregate = (raw.serviceItem?.titleSnapshot ?? "").includes(
        " + ",
      );
      resolvedServices = [
        {
          id: new UniqueEntityId(raw.service.id),
          serviceId: isAggregate ? null : raw.service.id,
          title: raw.serviceItem?.titleSnapshot ?? raw.service.title,
          priceInCents:
            raw.serviceItem?.priceInCentsSnapshot ?? raw.service.priceInCents,
          durationInMinutes:
            raw.serviceItem?.durationInMinutesSnapshot ??
            raw.service.durationInMinutes,
          legacyAggregate: isAggregate,
        },
      ];
    }

    const customerIdStr = raw.booking.customerId ?? raw.customer.id;

    return BookingDetails.create({
      bookingId: new UniqueEntityId(raw.booking.id),
      barbershopId: new UniqueEntityId(raw.booking.barbershopId),
      barbermanId: new UniqueEntityId(raw.booking.barbermanId),
      customerId: new UniqueEntityId(customerIdStr),
      shoppingCartId: raw.booking.shoppingCartId
        ? new UniqueEntityId(raw.booking.shoppingCartId)
        : null,
      customer: {
        id: new UniqueEntityId(raw.customer.id),
        name: raw.customer.name,
        phoneNumber: raw.customer.phoneNumber ?? "",
      },
      services: resolvedServices,
      startsAt: raw.booking.startsAt ?? null,
      endsAt: raw.booking.endsAt ?? null,
      timezone: raw.booking.timezone ?? "America/Sao_Paulo",
      status: raw.booking.status ?? null,
      version: raw.booking.version ?? 1,
      createdByUserId: raw.booking.createdByUserId
        ? new UniqueEntityId(raw.booking.createdByUserId)
        : null,
      clientRequestId: raw.booking.clientRequestId ?? null,
      totalPriceInCents: raw.booking.totalPriceInCents ?? null,
      totalDurationInMinutes: raw.booking.totalDurationInMinutes ?? null,
      date: raw.booking.date,
      startTime: raw.booking.startTime,
      endTime: raw.booking.endTime,
      createdAt: raw.booking.createdAt ?? undefined,
    });
  }

  static toHTTP(
    bookingDetails: BookingDetails,
    options?: {
      actorId?: string;
      barbershopOwnerId?: string;
      serverTime?: Date;
      scope?: BookingScope;
    },
  ) {
    const serverTime = options?.serverTime ?? new Date();
    const startsAt =
      bookingDetails.startsAt ??
      new Date(
        `${bookingDetails.date.toISOString().split("T")[0]}T${bookingDetails.startTime}:00.000Z`,
      );

    const capabilities = BookingPolicy.evaluateCapabilities({
      status: bookingDetails.status,
      startsAt,
      endsAt: bookingDetails.endsAt,
      customerId: bookingDetails.customerId.toString(),
      barbermanId: bookingDetails.barbermanId.toString(),
      barbershopOwnerId: options?.barbershopOwnerId,
      actorId: options?.actorId,
      serverTime,
      scope: options?.scope,
    });

    return {
      id: bookingDetails.bookingId.toString(),
      barbershopId: bookingDetails.barbershopId.toString(),
      barbermanId: bookingDetails.barbermanId.toString(),
      customerId: bookingDetails.customerId.toString(),
      shoppingCartId: bookingDetails.shoppingCartId?.toString() ?? null,
      customer: {
        id: bookingDetails.customer.id.toString(),
        name: bookingDetails.customer.name,
        phoneNumber: bookingDetails.customer.phoneNumber,
      },
      services: bookingDetails.services.map((service) => ({
        id: service.serviceId ?? service.id?.toString() ?? null,
        serviceId: service.serviceId,
        title: service.title,
        priceInCents: service.priceInCents,
        durationInMinutes: service.durationInMinutes,
        legacyAggregate: service.legacyAggregate,
      })),
      startsAt: bookingDetails.startsAt?.toISOString() ?? null,
      endsAt: bookingDetails.endsAt?.toISOString() ?? null,
      timezone: bookingDetails.timezone,
      status: bookingDetails.status,
      version: bookingDetails.version,
      createdByUserId: bookingDetails.createdByUserId?.toString() ?? null,
      clientRequestId: bookingDetails.clientRequestId,
      totalPriceInCents: bookingDetails.totalPriceInCents,
      totalDurationInMinutes: bookingDetails.totalDurationInMinutes,
      date: bookingDetails.date,
      startTime: bookingDetails.startTime,
      endTime: bookingDetails.endTime,
      createdAt: bookingDetails.createdAt,
      canCancel: capabilities.canCancel,
      canReschedule: capabilities.canReschedule,
      canComplete: capabilities.canComplete,
      canMarkNoShow: capabilities.canMarkNoShow,
      capabilities: {
        cancel: {
          allowed: capabilities.cancel.allowed,
          reasonCode: capabilities.cancel.reasonCode,
          deadlineAt: capabilities.cancel.deadlineAt?.toISOString() ?? null,
        },
        reschedule: {
          allowed: capabilities.reschedule.allowed,
          reasonCode: capabilities.reschedule.reasonCode,
          deadlineAt: capabilities.reschedule.deadlineAt?.toISOString() ?? null,
        },
        complete: {
          allowed: capabilities.complete.allowed,
          reasonCode: capabilities.complete.reasonCode,
          deadlineAt: capabilities.complete.deadlineAt?.toISOString() ?? null,
        },
        noShow: {
          allowed: capabilities.noShow.allowed,
          reasonCode: capabilities.noShow.reasonCode,
          deadlineAt: capabilities.noShow.deadlineAt?.toISOString() ?? null,
        },
      },
      serverTime: serverTime.toISOString(),
    };
  }
}
