import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  forbidden,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { LookupBookingCustomerUseCase } from "../../../../domain/application/use-cases/barbershop/lookup-booking-customer/lookup-booking-customer";

const lookupSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  email: z.string().email().optional(),
  cpf: z.string().optional(),
});

function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[REDACTED_CPF]")
      .replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "[REDACTED_EMAIL]",
      );
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }
  if (obj && typeof obj === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (
        k.toLowerCase().includes("cpf") ||
        k.toLowerCase().includes("email")
      ) {
        redacted[k] = "[REDACTED]";
      } else {
        redacted[k] = redactSensitiveData(v);
      }
    }
    return redacted;
  }
  return obj;
}

export class LookupBookingCustomerController implements Controller {
  constructor(
    private lookupBookingCustomerUseCase: LookupBookingCustomerUseCase,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = lookupSchema.parse(request);

      const result = await this.lookupBookingCustomerUseCase.execute({
        shopId: parsed.shopId,
        actorId: parsed.userId,
        email: parsed.email,
        cpf: parsed.cpf,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error instanceof NotAllowedError) {
          return forbidden({ error: error.message, message: error.message });
        }
        if (error instanceof ResourceNotFoundError) {
          return notFound({ error: error.message, message: error.message });
        }
        return clientError({
          error: error.message,
          message: error.message,
        });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({
          errors: redactSensitiveData(err.issues),
          message: "Dados de busca inválidos.",
        });
      }

      console.error(
        "[LookupCustomerController] Erro inesperado:",
        redactSensitiveData(err instanceof Error ? err.message : String(err)),
      );

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
