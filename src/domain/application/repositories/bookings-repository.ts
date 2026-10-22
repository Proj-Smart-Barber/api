import type { Booking } from "../../enterprise/entities/booking";
import type { BookingDetails } from "../../enterprise/entities/booking-details";
import type { BookingServiceItem } from "../../enterprise/entities/booking-service-item";
import type { ServiceItem } from "../../enterprise/entities/service-item";
import type { ShoppingCart } from "../../enterprise/entities/shopping-cart";

export interface CreateBookingBundleParams {
  booking: Booking;
  serviceItem: ServiceItem;
  cart: ShoppingCart;
}

export interface CreateBookingWithItemsParams {
  booking: Booking;
  items: BookingServiceItem[];
  tx?: any;
}

export interface FindOverlappingParams {
  barbermanId: string;
  barbershopId?: string;
  startAt: Date;
  endAt: Date;
  excludeBookingId?: string;
  tx?: any;
}

export interface FindManyByBarbermanAndDateParams {
  barbermanId: string;
  date: Date;
  range?: { startAt: Date; endAt: Date };
}

export interface FindManyByShoppingCartParams {
  shoppingCartId: string;
  page?: number;
}

export interface SaveBookingOptions {
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
}

export interface FindManyByCustomerIdOptions {
  page?: number;
  view?: "all" | "upcoming";
  limit?: number;
}

export interface BookingsRepository {
  create(booking: Booking): Promise<void>;
  createWithItemAndCart(params: CreateBookingBundleParams): Promise<void>;
  createWithItems(params: CreateBookingWithItemsParams): Promise<void>;
  save(booking: Booking, tx?: any, options?: SaveBookingOptions): Promise<void>;
  delete(booking: Booking): Promise<void>;
  findById(id: string): Promise<Booking | null>;
  findOverlapping(params: FindOverlappingParams): Promise<Booking | null>;
  findManyByBarbermanAndDate(
    params: FindManyByBarbermanAndDateParams,
  ): Promise<Booking[]>;
  findManyByShoppingCart(
    params: FindManyByShoppingCartParams,
  ): Promise<Booking[]>;
  findManyWithDetailsByBarbermanAndDate(
    params: FindManyByBarbermanAndDateParams,
  ): Promise<BookingDetails[]>;
  findManyByCustomerId(
    customerId: string,
    options?: FindManyByCustomerIdOptions,
  ): Promise<BookingDetails[]>;
  findByIdWithDetails(
    bookingId: string,
    tx?: any,
  ): Promise<BookingDetails | null>;
  getDetails(bookingId: string, tx?: any): Promise<BookingDetails | null>;
  findActiveAndFutureBookingsForBarberman(
    barbershopId: string,
    barbermanId: string,
    now: Date,
    tx?: any,
  ): Promise<Booking[]>;
  findActiveAndFutureBookings(params: {
    barbershopId: string;
    barbermanId?: string | null;
    now?: Date;
    tx?: any;
  }): Promise<Booking[]>;
  findUnitBookings(
    params: FindUnitBookingsParams,
  ): Promise<FindUnitBookingsResult>;
}

export interface FindUnitBookingsParams {
  barbershopId: string;
  barbermanId?: string;
  date?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface UnitBookingsSummary {
  totalBookings: number;
  totalAmountInCents: number;
  statusCounts: Record<string, number>;
  hasIncompleteData: boolean;
}

export interface FindUnitBookingsResult {
  items: BookingDetails[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  summary: UnitBookingsSummary;
}
