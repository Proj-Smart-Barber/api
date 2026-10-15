import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  conflict,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { AccountAlreadyExistsError } from "../../../../domain/application/use-cases/_errors/account-already-exists-error";
import { InvalidInvitationError } from "../../../../domain/application/use-cases/_errors/invalid-invitation-error";
import type { ActivateBarberRegistrationUseCase } from "../../../../domain/application/use-cases/barbershop/activate-barber-registration/activate-barber-registration";

const activateBarberSchema = z.object({
  token: z.string().min(1, { message: "Token de ativação é obrigatório." }),
  password: z
    .string()
    .min(8, {
      message:
        "A senha deve ter pelo menos 8 caracteres. Uma frase fácil de lembrar funciona.",
    })
    .max(72, {
      message: "Essa senha é longa demais. Use uma frase mais curta.",
    }),
});

export class ActivateBarberController implements Controller {
  constructor(
    private activateBarberRegistrationUseCase: ActivateBarberRegistrationUseCase,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = activateBarberSchema.parse(request);

      const result = await this.activateBarberRegistrationUseCase.execute({
        token: parsed.token,
        password: parsed.password,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof AccountAlreadyExistsError) {
          return conflict({
            code: "account_already_exists",
            message: error.message,
            error: error.message,
          });
        }

        if (error instanceof InvalidInvitationError) {
          return clientError({
            code: "INVALID_OR_EXPIRED_TOKEN",
            message: error.message,
            error: error.message,
          });
        }

        return clientError({
          code: "ACTIVATION_FAILED",
          message: error.message,
          error: error.message,
        });
      }

      return ok({
        success: true,
        userId: result.value.userId,
        email: result.value.email,
        status: result.value.status,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
