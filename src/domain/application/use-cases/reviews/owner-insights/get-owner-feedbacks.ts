import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  FeedbacksResponse,
  ReviewInsightsRepository,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { ensureOwnerAccess } from "./ensure-owner-access";

export interface GetOwnerFeedbacksDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: "CUSTOMER" | "DEMO" | "ALL";
  targetType?: "ALL" | "BARBERSHOP" | "BARBER" | "SERVICE";
  targetId?: string;
  rating?: number;
  hasComment?: boolean;
  page?: number;
  limit?: number;
}

export type GetOwnerFeedbacksResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  FeedbacksResponse
>;

export class GetOwnerFeedbacksUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository,
    private reviewInsightsRepository: ReviewInsightsRepository,
  ) {}

  async execute({
    shopId,
    actorId,
    startDate,
    endDate,
    source = "CUSTOMER",
    targetType = "ALL",
    targetId,
    rating,
    hasComment,
    page = 1,
    limit = 20,
  }: GetOwnerFeedbacksDTO): Promise<GetOwnerFeedbacksResponse> {
    const authResult = await ensureOwnerAccess(
      this.barbershopsRepository,
      this.membershipsRepository,
      shopId,
      actorId,
    );

    if (authResult.isLeft()) {
      return left(authResult.value);
    }

    const resolvedStartDate = startDate ? new Date(startDate) : undefined;
    const resolvedEndDate = endDate ? new Date(endDate) : undefined;

    const result = await this.reviewInsightsRepository.getFeedbacks({
      barbershopId: shopId,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      source,
      targetType,
      targetId,
      rating,
      hasComment,
      page,
      limit,
    });

    return right(result);
  }
}
