import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  notFound,
  ok,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { GetServiceUseCase } from "../../../../domain/application/use-cases/service/get-service/get-service";
import { DrizzleServiceMapper } from "../../../drizzle/mappers/drizzle-service-mapper";
import { z, ZodError } from "zod";

const getServiceSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  serviceId: z.string().uuid({ message: "ID do serviço inválido." }),
  userId: z.string().uuid().optional(),
});

type GetServiceControllerRequest = z.infer<typeof getServiceSchema>;

export class GetServiceController implements Controller {
  constructor(private getServiceUseCase: GetServiceUseCase) {}

  async handle(request: GetServiceControllerRequest): Promise<HttpResponse> {
    try {
      const { shopId, serviceId, userId } = getServiceSchema.parse(request);

      const result = await this.getServiceUseCase.execute({
        barbershopId: shopId,
        serviceId,
        userId,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message });
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
