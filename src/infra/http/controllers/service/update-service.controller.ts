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
import type { UpdateServiceUseCase } from "../../../../domain/application/use-cases/service/update-service/update-service";
import { DrizzleServiceMapper } from "../../../drizzle/mappers/drizzle-service-mapper";
import { z, ZodError } from "zod";

const updateServiceSchema = z.object({
  userId: z.string().uuid({ message: "ID de usuário inválido." }),
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  serviceId: z.string().uuid({ message: "ID do serviço inválido." }),
  title: z
    .string()
    .trim()
    .min(1, "Título não pode ser vazio.")
    .max(100)
    .optional(),
  priceInCents: z.coerce
    .number()
    .int()
    .positive("Preço deve ser maior que zero.")
    .optional(),
  durationInMinutes: z.coerce
    .number()
    .int()
    .positive("Duração deve ser maior que zero.")
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

type UpdateServiceControllerRequest = z.infer<typeof updateServiceSchema>;

export class UpdateServiceController implements Controller {
  constructor(private updateServiceUseCase: UpdateServiceUseCase) {}

  async handle(request: UpdateServiceControllerRequest): Promise<HttpResponse> {
    try {
      const {
        userId,
        shopId,
        serviceId,
        title,
        priceInCents,
        durationInMinutes,
        description,
      } = updateServiceSchema.parse(request);

      const result = await this.updateServiceUseCase.execute({
        barbershopId: shopId,
        userId,
        serviceId,
        title,
        priceInCents,
        durationInMinutes,
        description: description ?? undefined,
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

      return ok({
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
