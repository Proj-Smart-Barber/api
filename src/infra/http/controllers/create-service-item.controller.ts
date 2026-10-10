import { z, ZodError } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  notFound,
  type HttpResponse,
} from "../../../core/infra/http-response";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { CreateServiceItemUseCase } from "../../../domain/application/use-cases/service-item/create-service-item/create-service-item";
import { ServiceItemMapper } from "../../../domain/enterprise/mappers/service-item-mapper";

const createServiceItemControllerRequest = z.object({
  serviceId: z.string().uuid(),
});

type CreateServiceItemControllerRequest = z.infer<
  typeof createServiceItemControllerRequest
>;

export class CreateServiceItemController implements Controller {
  constructor(private createServiceItemUseCase: CreateServiceItemUseCase) {}

  async handle(
    request: CreateServiceItemControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { serviceId } = createServiceItemControllerRequest.parse(request);

      const result = await this.createServiceItemUseCase.execute({ serviceId });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message });
        }

        return clientError({ error: error.message });
      }

      const { serviceItem } = result.value;

      return created({
        serviceItem: ServiceItemMapper.toHTTP(serviceItem),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ error: z.prettifyError(err) });
      }

      return fail(
        new Error("Internal server error. Failed to create service item."),
      );
    }
  }
}
