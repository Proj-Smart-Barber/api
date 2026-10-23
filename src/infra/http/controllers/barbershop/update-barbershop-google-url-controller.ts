import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { UpdateBarbershopGoogleUrlUseCase } from "../../../../domain/application/use-cases/barbershop/update-barbershop-google-url/update-barbershop-google-url";

const updateBarbershopGoogleUrlSchema = z.object({
  userId: z.string().uuid(),
  shopId: z.string().uuid(),
  googleMapsUrl: z.string().url().nullable().optional(),
});

type UpdateBarbershopGoogleUrlRequest = z.infer<
  typeof updateBarbershopGoogleUrlSchema
>;

export class UpdateBarbershopGoogleUrlController implements Controller {
  constructor(
    private updateBarbershopGoogleUrlUseCase: UpdateBarbershopGoogleUrlUseCase,
  ) {}

  async handle(
    request: UpdateBarbershopGoogleUrlRequest,
  ): Promise<HttpResponse> {
    try {
      const parsed = updateBarbershopGoogleUrlSchema.parse(request);

      const result = await this.updateBarbershopGoogleUrlUseCase.execute({
        barbershopId: parsed.shopId,
        userId: parsed.userId,
        googleMapsUrl: parsed.googleMapsUrl ?? null,
      });

      if (result.isLeft()) {
        const error = result.value;
        return clientError({ message: error.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
