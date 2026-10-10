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
import type { CreateShoppingCartUseCase } from "../../../domain/application/use-cases/shopping-cart/create-shopping-cart/create-shopping-cart";
import { ShoppingCartMapper } from "../../../domain/enterprise/mappers/shopping-cart-mapper";

const createShoppingCartControllerRequest = z.object({
  userId: z.string().uuid(),
  serviceItemId: z.string().uuid(),
});

type CreateShoppingCartControllerRequest = z.infer<
  typeof createShoppingCartControllerRequest
>;

export class CreateShoppingCartController implements Controller {
  constructor(private createShoppingCartUseCase: CreateShoppingCartUseCase) {}

  async handle(
    request: CreateShoppingCartControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId: customerId, serviceItemId } =
        createShoppingCartControllerRequest.parse(request);

      const result = await this.createShoppingCartUseCase.execute({
        customerId,
        serviceItemId,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message });
        }

        return clientError({ error: error.message });
      }

      const { cart } = result.value;

      return created({
        cart: ShoppingCartMapper.toHTTP(cart),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ error: z.prettifyError(err) });
      }

      return fail(
        new Error("Internal server error. Failed to create shopping cart."),
      );
    }
  }
}
