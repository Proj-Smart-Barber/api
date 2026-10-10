import type { Booking } from "../../enterprise/entities/booking";
import type { BookingDetails } from "../../enterprise/entities/booking-details";
import type { ServiceItem } from "../../enterprise/entities/service-item";
import type { ShoppingCart } from "../../enterprise/entities/shopping-cart";

export interface CreateBookingBundleParams {
  booking: Booking;
  serviceItem: ServiceItem;
  cart: ShoppingCart;
}

export interface FindOverlappingParams {
  barbermanId: string;
  barbershopId: string;
  startAt: Date;
  endAt: Date;
  excludeBookingId?: string;
}

export interface FindManyByBarbermanAndDateParams {
  barbermanId: string;
  date: Date;
}

export interface FindManyByShoppingCartParams {
  shoppingCartId: string;
  page?: number;
}

export interface BookingsRepository {
  create(booking: Booking): Promise<void>;
  createWithItemAndCart(params: CreateBookingBundleParams): Promise<void>;
  save(booking: Booking): Promise<void>;
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
}
