import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type {
  ReviewInsightsRepository,
  ReviewSummaryMetrics,
} from "../../../repositories/review-insights-repository";
import type { NotAllowedError } from "../../_errors/not-allowed-error";
import type { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { ensureOwnerAccess } from "./ensure-owner-access";

export interface GetOwnerReviewSummaryDTO {
  shopId: string;
  actorId: string;
  startDate?: string | Date;
  endDate?: string | Date;
  source?: "CUSTOMER" | "DEMO" | "ALL";
}

export type GetOwnerReviewSummaryResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  ReviewSummaryMetrics
>;

export class GetOwnerReviewSummaryUseCase {
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
  }: GetOwnerReviewSummaryDTO): Promise<GetOwnerReviewSummaryResponse> {
    const authResult = await ensureOwnerAccess(
      this.barbershopsRepository,
      this.membershipsRepository,
      shopId,
      actorId,
    );

    if (authResult.isLeft()) {
      return left(authResult.value);
    }

    const { barbershop } = authResult.value;

    const resolvedEndDate = endDate ? new Date(endDate) : new Date();
    const resolvedStartDate = startDate
      ? new Date(startDate)
      : new Date(resolvedEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const summary = await this.reviewInsightsRepository.getSummaryMetrics({
      barbershopId: shopId,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      source,
      timezone: barbershop.timezone || "America/Sao_Paulo",
    });

    return right(summary);
  }
}
