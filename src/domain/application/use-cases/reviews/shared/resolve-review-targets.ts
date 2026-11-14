import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import type { BookingDetailsServiceItem } from "../../../../enterprise/entities/booking-details";
import { ReviewItem } from "../../../../enterprise/entities/review-item";
import { PlatformFeedback } from "../../../../enterprise/entities/platform-feedback";

export interface ServiceRatingInput {
  bookingServiceItemId?: string | null;
  serviceId?: string | null;
  rating: number;
}

export interface PlatformFeedbackInput {
  rating?: number | null;
  comment?: string | null;
}

export interface ResolveReviewTargetsParams {
  reviewId: UniqueEntityId;
  bookingId: UniqueEntityId;
  barbershopId: UniqueEntityId;
  barbershopName?: string | null;
  barbermanId: UniqueEntityId;
  barbermanName?: string | null;
  contractedServices: BookingDetailsServiceItem[];
  customerId: UniqueEntityId;
  barbershopRating: number;
  barberId?: string | null;
  barberRating?: number;
  serviceRatings?: ServiceRatingInput[];
  platformFeedback?: PlatformFeedbackInput | null;
  now?: Date;
}

export function resolveReviewTargetsAndFeedback(
  params: ResolveReviewTargetsParams,
):
  | { error: Error }
  | { items: ReviewItem[]; platformFeedback?: PlatformFeedback | null } {
  const now = params.now ?? new Date();

  if (
    params.barberId !== undefined &&
    params.barberId !== null &&
    params.barberId !== params.barbermanId.toString()
  ) {
    return {
      error: new Error("O barbeiro informado não pertence a este agendamento."),
    };
  }

  const items: ReviewItem[] = [];

  try {
    items.push(
      ReviewItem.create({
        reviewId: params.reviewId,
        bookingId: params.bookingId,
        targetType: "BARBERSHOP",
        targetKey: ReviewItem.buildTargetKey({
          targetType: "BARBERSHOP",
          targetId: params.barbershopId.toString(),
        }),
        targetId: params.barbershopId,
        bookingServiceItemId: null,
        targetLabel: params.barbershopName?.trim() || "Barbearia",
        rating: params.barbershopRating,
        createdAt: now,
        updatedAt: now,
      }),
    );

    if (params.barberRating !== undefined) {
      items.push(
        ReviewItem.create({
          reviewId: params.reviewId,
          bookingId: params.bookingId,
          targetType: "BARBER",
          targetKey: ReviewItem.buildTargetKey({
            targetType: "BARBER",
            targetId: params.barbermanId.toString(),
          }),
          targetId: params.barbermanId,
          bookingServiceItemId: null,
          targetLabel: params.barbermanName?.trim() || "Profissional",
          rating: params.barberRating,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    if (params.serviceRatings && params.serviceRatings.length > 0) {
      const matchedIndices = new Set<number>();

      for (const entry of params.serviceRatings) {
        let matchedIdx = -1;

        if (entry.bookingServiceItemId) {
          matchedIdx = params.contractedServices.findIndex(
            (s) => s.bookingServiceItemId === entry.bookingServiceItemId,
          );
          if (matchedIdx < 0) {
            return {
              error: new Error(
                "Serviço informado não pertence a este agendamento.",
              ),
            };
          }
          if (matchedIndices.has(matchedIdx)) {
            return {
              error: new Error(
                "Não é permitido avaliar o mesmo serviço mais de uma vez neste agendamento.",
              ),
            };
          }
        } else if (entry.serviceId) {
          const allMatching = params.contractedServices
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => s.serviceId === entry.serviceId);

          if (allMatching.length === 0) {
            return {
              error: new Error(
                "Serviço informado não pertence a este agendamento.",
              ),
            };
          }

          const firstUnmatched = allMatching.find(
            ({ idx }) => !matchedIndices.has(idx),
          );
          if (!firstUnmatched) {
            return {
              error: new Error(
                "Não é permitido avaliar o mesmo serviço mais de uma vez neste agendamento.",
              ),
            };
          }
          matchedIdx = firstUnmatched.idx;
        } else {
          return {
            error: new Error(
              "Identificação do serviço contratado é obrigatória para avaliação de serviço.",
            ),
          };
        }

        matchedIndices.add(matchedIdx);
        const contracted = params.contractedServices[matchedIdx];
        const targetKey = ReviewItem.buildTargetKey({
          targetType: "SERVICE",
          targetId: contracted.serviceId ?? null,
          bookingServiceItemId: contracted.bookingServiceItemId ?? null,
          fallbackIndex: matchedIdx,
        });

        items.push(
          ReviewItem.create({
            reviewId: params.reviewId,
            bookingId: params.bookingId,
            targetType: "SERVICE",
            targetKey,
            targetId: contracted.serviceId
              ? new UniqueEntityId(contracted.serviceId)
              : null,
            bookingServiceItemId: contracted.bookingServiceItemId
              ? new UniqueEntityId(contracted.bookingServiceItemId)
              : null,
            targetLabel: contracted.title,
            rating: entry.rating,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
    }

    let resolvedFeedback: PlatformFeedback | null | undefined;
    if (
      params.platformFeedback &&
      ((params.platformFeedback.rating !== undefined &&
        params.platformFeedback.rating !== null) ||
        Boolean(params.platformFeedback.comment?.trim()))
    ) {
      resolvedFeedback = PlatformFeedback.create({
        bookingId: params.bookingId,
        reviewId: params.reviewId,
        customerId: params.customerId,
        rating: params.platformFeedback.rating ?? null,
        comment: params.platformFeedback.comment ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { items, platformFeedback: resolvedFeedback };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
