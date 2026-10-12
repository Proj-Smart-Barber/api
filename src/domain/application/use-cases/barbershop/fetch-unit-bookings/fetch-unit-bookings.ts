import { type Either, left, right } from "../../../../../core/logic/either";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { BookingDetails } from "../../../../enterprise/entities/booking-details";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface FetchUnitBookingsDTO {
  shopId: string;
  actorId: string;
  barbermanId?: string;
  date?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface FetchUnitBookingsResponseData {
  items: BookingDetails[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  serverTime: string;
  summary: {
    totalBookings: number;
    totalAmountInCents: number;
    statusCounts: Record<string, number>;
    hasIncompleteData: boolean;
  };
}

export type FetchUnitBookingsResponse = Either<
  NotAllowedError | ResourceNotFoundError | Error,
  FetchUnitBookingsResponseData
>;

export class FetchUnitBookingsUseCase {
  constructor(
    private membershipsRepository: MembershipsRepository,
    private bookingsRepository: BookingsRepository,
  ) {}

  async execute({
    shopId,
    actorId,
    barbermanId,
    date,
    status,
    page = 1,
    limit = 20,
  }: FetchUnitBookingsDTO): Promise<FetchUnitBookingsResponse> {
    const membership = await this.membershipsRepository.findByBarbershopAndUser(
      shopId,
      actorId,
    );

    if (!membership || membership.state !== "ACTIVE") {
      return left(
        new NotAllowedError(
          "Apenas profissionais com vínculo ativo podem acessar a agenda da unidade.",
        ),
      );
    }

    // Se o ator for barbeiro, restringe à própria agenda
    let targetBarbermanId = barbermanId;
    if (membership.role === "BARBERMAN") {
      targetBarbermanId = actorId;
    }

    const result = await this.bookingsRepository.findUnitBookings({
      barbershopId: shopId,
      barbermanId: targetBarbermanId,
      date,
      status,
      page,
      limit,
    });

    return right({
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasNext: result.hasNext,
      serverTime: new Date().toISOString(),
      summary: result.summary,
    });
  }
}
