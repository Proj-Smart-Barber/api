import { z, ZodError } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  forbidden,
  notFound,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import { NotAllowedError } from "../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { DeleteShoppingCartUseCase } from "../../../domain/application/use-cases/shopping-cart/delete-shopping-cart/delete-shopping-cart";
import { ShoppingCartMapper } from "../../../domain/enterprise/mappers/shopping-cart-mapper";

const deleteShoppingCartControllerRequest = z.object({
  userId: z.string().uuid(),
  cartId: z.string().uuid(),
});

type DeleteShoppingCartControllerRequest = z.infer<
  typeof deleteShoppingCartControllerRequest
>;

export class DeleteShoppingCartController implements Controller {
  constructor(private deleteShoppingCartUseCase: DeleteShoppingCartUseCase) {}

  async handle(
    request: DeleteShoppingCartControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId: customerId, cartId } =
        deleteShoppingCartControllerRequest.parse(request);

      const result = await this.deleteShoppingCartUseCase.execute({
        customerId,
        cartId,
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

      const { cart } = result.value;

      return ok({
        cart: ShoppingCartMapper.toHTTP(cart),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ error: z.prettifyError(err) });
      }

      return fail(
        new Error("Internal server error. Failed to delete shopping cart."),
      );
    }
  }
}
