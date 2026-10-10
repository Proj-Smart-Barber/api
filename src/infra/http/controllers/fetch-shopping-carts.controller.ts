import { z, ZodError } from "zod";
import type { Controller } from "../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../core/infra/http-response";
import type { FetchShoppingCartsUseCase } from "../../../domain/application/use-cases/shopping-cart/fetch-shopping-carts/fetch-shopping-carts";
import { ShoppingCartMapper } from "../../../domain/enterprise/mappers/shopping-cart-mapper";

const fetchShoppingCartsControllerRequest = z.object({
  userId: z.string().uuid(),
});

type FetchShoppingCartsControllerRequest = z.infer<
  typeof fetchShoppingCartsControllerRequest
>;

export class FetchShoppingCartsController implements Controller {
  constructor(private fetchShoppingCartsUseCase: FetchShoppingCartsUseCase) {}

  async handle(
    request: FetchShoppingCartsControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId: customerId } =
        fetchShoppingCartsControllerRequest.parse(request);

      const result = await this.fetchShoppingCartsUseCase.execute({
        customerId,
      });

      if (result.isLeft()) {
        return clientError({
          error: "Não foi possível carregar os carrinhos.",
        });
      }

      const { carts } = result.value;

      return ok({
        carts: carts.map((cart) => ShoppingCartMapper.toHTTP(cart)),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ error: z.prettifyError(err) });
      }

      return fail(
        new Error("Internal server error. Failed to fetch shopping carts."),
      );
    }
  }
}
