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
import type { ToggleServiceActivationUseCase } from "../../../../domain/application/use-cases/service/toggle-service-activation/toggle-service-activation";
import { DrizzleServiceMapper } from "../../../drizzle/mappers/drizzle-service-mapper";
import { z, ZodError } from "zod";

const toggleServiceActivationSchema = z.object({
  userId: z.string().uuid({ message: "ID de usuário inválido." }),
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  serviceId: z.string().uuid({ message: "ID do serviço inválido." }),
  isActive: z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform((v) => v === "true"),
  ]),
});

type ToggleServiceActivationControllerRequest = z.infer<
  typeof toggleServiceActivationSchema
>;

export class ToggleServiceActivationController implements Controller {
  constructor(
    private toggleServiceActivationUseCase: ToggleServiceActivationUseCase,
  ) {}

  async handle(
    request: ToggleServiceActivationControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId, shopId, serviceId, isActive } =
        toggleServiceActivationSchema.parse(request);

      const result = await this.toggleServiceActivationUseCase.execute({
        barbershopId: shopId,
        userId,
        serviceId,
        isActive,
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
