import { type Either, left, right } from "../../../../../core/logic/either";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { ReviewReport } from "../../../../enterprise/entities/review-report";
import type { ReviewsRepository } from "../../../repositories/reviews-repository";

export interface ReportReviewDTO {
  reporterUserId: string;
  reviewId: string;
  reason: string;
}

export class ReportReviewUseCase {
  constructor(private reviewsRepository: ReviewsRepository) {}

  async execute(dto: ReportReviewDTO): Promise<Either<Error, { success: boolean; reportId: string }>> {
    if (!dto.reason || dto.reason.trim().length === 0) {
      return left(new Error("O motivo da denúncia deve ser informado."));
    }

    if (dto.reason.length > 500) {
      return left(new Error("O motivo da denúncia não pode exceder 500 caracteres."));
    }

    const review = await this.reviewsRepository.findById(dto.reviewId);
    if (!review) {
      return left(new Error("Avaliação não encontrada."));
    }

    const report = ReviewReport.create({
      reviewId: new UniqueEntityId(dto.reviewId),
      reporterId: new UniqueEntityId(dto.reporterUserId),
      reason: dto.reason.trim(),
    });

    await this.reviewsRepository.createReport(report);

    return right({ success: true, reportId: report.id.toString() });
  }
}
