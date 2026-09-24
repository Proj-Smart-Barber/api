import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  notFound,
  fail,
} from "../../../../core/infra/http-response";
import type { GetBarbershopUseCase } from "../../../../domain/application/use-cases/barbershop/get-barbershop/get-barbershop";
import { DrizzleBarbershopMapper } from "../../../drizzle/mappers/drizzle-barbershop-mapper";

export class GetBarbershopController implements Controller {
  constructor(private getBarbershopUseCase: GetBarbershopUseCase) {}

  async handle(request: unknown): Promise<HttpResponse> {
    try {
      const barbershopId = (request as any).shopId; // the parameter is :shopId from the route

      const result = await this.getBarbershopUseCase.execute({
        barbershopId,
      });

      if (result.isLeft()) {
        const error = result.value;
        switch (error.constructor.name) {
          case "ResourceNotFoundError":
            return notFound(new Error(error.message));
          default:
            return clientError(error.message);
        }
      }

      const barbershop = result.value.barbershop;

      return ok({
        barbershop: DrizzleBarbershopMapper.toDrizzle(barbershop),
      });
    } catch (err: unknown) {
      return fail(err as Error);
    }
  }
}
