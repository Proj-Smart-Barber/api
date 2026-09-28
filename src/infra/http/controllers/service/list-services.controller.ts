import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  forbidden,
  notFound,
  ok,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import type { ListServicesUseCase } from "../../../../domain/application/use-cases/service/list-services/list-services";
import { DrizzleServiceMapper } from "../../../drizzle/mappers/drizzle-service-mapper";
import { z, ZodError } from "zod";

const listServicesSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeInactive: z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((v) => v === "true"),
    ])
    .optional()
    .default(false),
});

type ListServicesControllerRequest = z.infer<typeof listServicesSchema>;

export class ListServicesController implements Controller {
  constructor(private listServicesUseCase: ListServicesUseCase) {}

  async handle(request: ListServicesControllerRequest): Promise<HttpResponse> {
    try {
      const { shopId, userId, page, limit, includeInactive } =
        listServicesSchema.parse(request);

      const result = await this.listServicesUseCase.execute({
        barbershopId: shopId,
        userId,
        page,
        limit,
        includeInactive,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message });
        }

        if (error instanceof NotAllowedError) {
          return forbidden({ error: error.message });
        }

        return clientError({ error: error.message });
      }

      const {
        items,
        total,
        page: currentPage,
        limit: currentLimit,
      } = result.value;

      return ok({
        items: items.map(DrizzleServiceMapper.toDrizzle),
        total,
        page: currentPage,
        limit: currentLimit,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({ error: z.prettifyError(error) });
      }

      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
