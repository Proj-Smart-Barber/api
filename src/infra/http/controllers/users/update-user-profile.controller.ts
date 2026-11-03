import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { UpdateUserProfileUseCase } from "../../../../domain/application/use-cases/users/update-user-profile/update-user-profile";

const updateUserProfileSchema = z.object({
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  name: z
    .string()
    .trim()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres." })
    .max(100, { message: "Nome deve ter no máximo 100 caracteres." })
    .optional(),
  phoneNumber: z
    .string()
    .trim()
    .max(20, { message: "Telefone deve ter no máximo 20 caracteres." })
    .nullable()
    .optional(),
});

type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>;

export class UpdateUserProfileController implements Controller {
  constructor(private updateUserProfileUseCase: UpdateUserProfileUseCase) {}

  async handle(request: UpdateUserProfileRequest): Promise<HttpResponse> {
    try {
      const parsed = updateUserProfileSchema.parse(request);

      const result = await this.updateUserProfileUseCase.execute({
        userId: parsed.userId,
        name: parsed.name,
        phoneNumber: parsed.phoneNumber,
      });

      if (result.isLeft()) {
        const error = result.value;
        return notFound(error.message);
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
