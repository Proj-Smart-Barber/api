import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  forbidden,
  notFound,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import type { CreateServiceUseCase } from "../../../../domain/application/use-cases/service/create-service/create-service";
import { DrizzleServiceMapper } from "../../../drizzle/mappers/drizzle-service-mapper";
import { z, ZodError } from "zod";

const createServiceBodySchema = z.object({
  userId: z.string().uuid({ message: "ID de usuário inválido." }),
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  title: z.string().trim().min(1, "Título é obrigatório.").max(100),
  priceInCents: z.coerce
    .number()
    .int()
    .positive("Preço deve ser maior que zero."),
  durationInMinutes: z.coerce
    .number()
    .int()
    .positive("Duração deve ser maior que zero."),
  description: z.string().trim().max(500).optional().nullable(),
});

type CreateServiceControllerRequest = z.infer<typeof createServiceBodySchema>;

export class CreateServiceController implements Controller {
  constructor(private createServiceUseCase: CreateServiceUseCase) {}

  async handle(request: CreateServiceControllerRequest): Promise<HttpResponse> {
    try {
      const {
        userId,
        shopId,
        title,
        priceInCents,
        durationInMinutes,
        description,
      } = createServiceBodySchema.parse(request);

      const result = await this.createServiceUseCase.execute({
        barbershopId: shopId,
        userId,
        title,
        priceInCents,
        durationInMinutes,
        description: description || undefined,
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

      return created({
        service: DrizzleServiceMapper.toDrizzle(result.value.service),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({ error: z.prettifyError(error) });
      }

      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
