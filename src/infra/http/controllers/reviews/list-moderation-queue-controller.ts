import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ReviewsRepository } from "../../../../domain/application/repositories/reviews-repository";
import type { UsersRepository } from "../../../../domain/application/repositories/users-repository";

const listModerationQueueSchema = z.object({
  userId: z.string().uuid(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
});

type ListModerationQueueRequest = z.infer<typeof listModerationQueueSchema>;

export class ListModerationQueueController implements Controller {
  constructor(
    private reviewsRepository: ReviewsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async handle(request: ListModerationQueueRequest): Promise<HttpResponse> {
    try {
      const parsed = listModerationQueueSchema.parse(request);

      const adminUser = await this.usersRepository.findById(parsed.userId);
      if (!adminUser || adminUser.accountType !== "PLATFORM_ADMIN") {
        return clientError({
          message: "Apenas administradores da plataforma podem acessar a fila de moderação.",
        });
      }

      const { reviews, total } = await this.reviewsRepository.listModerationQueue({
        page: parsed.page,
        limit: parsed.limit,
      });

      return ok({
        reviews: reviews.map((r) => ({
          id: r.id.toString(),
          bookingId: r.bookingId.toString(),
          barbershopId: r.barbershopId.toString(),
          customerId: r.customerId.toString(),
          rating: r.rating,
          comment: r.comment,
          status: r.status,
          version: r.version,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        total,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
