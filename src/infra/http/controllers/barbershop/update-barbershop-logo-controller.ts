import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { UpdateBarbershopLogoUseCase } from "../../../../domain/application/use-cases/media/update-barbershop-logo/update-barbershop-logo";

const updateBarbershopLogoSchema = z.object({
  userId: z.string().uuid(),
  shopId: z.string().uuid(),
  mediaId: z.string().uuid().nullable().optional(),
});

type UpdateBarbershopLogoRequest = z.infer<typeof updateBarbershopLogoSchema>;

export class UpdateBarbershopLogoController implements Controller {
  constructor(private updateBarbershopLogoUseCase: UpdateBarbershopLogoUseCase) {}

  async handle(request: UpdateBarbershopLogoRequest): Promise<HttpResponse> {
    try {
      const parsed = updateBarbershopLogoSchema.parse(request);

      const result = await this.updateBarbershopLogoUseCase.execute({
        barbershopId: parsed.shopId,
        userId: parsed.userId,
        mediaId: parsed.mediaId,
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
