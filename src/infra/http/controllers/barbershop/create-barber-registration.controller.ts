import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  conflict,
  fail,
  forbidden,
  notFound,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import { isValidUuidV7 } from "../../../../core/security/uuidv7";
import { canonicalOperationHash } from "../../../../domain/application/services/canonical-operation-hash";
import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../../domain/application/services/operation-attempt-service";
import { AlreadyAMemberError } from "../../../../domain/application/use-cases/_errors/already-a-member-error";
import { EmailSendError } from "../../../../domain/application/use-cases/_errors/email-send-error";
import { IdentityConflictError } from "../../../../domain/application/use-cases/_errors/identity-conflict-error";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { PendingInvitationAlreadyExistsError } from "../../../../domain/application/use-cases/_errors/pending-invitation-already-exists-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { CreateBarberRegistrationUseCase } from "../../../../domain/application/use-cases/barbershop/create-barber-registration/create-barber-registration";

const createBarberRegistrationSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres." }),
  cpf: z.string().min(11, { message: "CPF inválido." }),
  email: z.string().email({ message: "E-mail inválido." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  requestId: z.string().optional(),
});

export class CreateBarberRegistrationController implements Controller {
  constructor(
    private createBarberRegistrationUseCase: CreateBarberRegistrationUseCase,
    private operationAttemptService?: OperationAttemptService,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = createBarberRegistrationSchema.parse(request);
      const headers = request.headers as
        | Record<string, string | undefined>
        | undefined;
      const headerKey =
        headers?.["idempotency-key"] ?? headers?.["Idempotency-Key"];
      const rawRequestId =
        typeof headerKey === "string" && headerKey.trim() !== ""
          ? headerKey.trim()
          : parsed.requestId;

      if (!rawRequestId) {
        return clientError({
          error: "Idempotency-Key é obrigatória para cadastro profissional.",
          message: "Idempotency-Key é obrigatória para cadastro profissional.",
          code: "MISSING_IDEMPOTENCY_KEY",
        });
      }

      if (!isValidUuidV7(rawRequestId)) {
        return clientError({
          error:
            "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
          message:
            "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
          code: "INVALID_IDEMPOTENCY_KEY",
        });
      }

      const requestId = rawRequestId;
      const cleanCpf = parsed.cpf.replace(/\D/g, "");
      const normalizedEmail = parsed.email.trim().toLowerCase();

      if (this.operationAttemptService) {
        const payloadHash = canonicalOperationHash({
          action: "CREATE_BARBER_REGISTRATION",
          shopId: parsed.shopId,
          cpf: cleanCpf,
          email: normalizedEmail,
        });

        try {
          const attemptResult = await this.operationAttemptService.executeOnce(
            {
              actorId: parsed.userId,
              operation: "CREATE_BARBER_REGISTRATION",
              requestId,
              payloadHash,
              resourceKind: "REGISTRATION",
              lockResources: {
                unitIds: [parsed.shopId],
              },
            },
            async (_tx, _context) => {
              const result =
                await this.createBarberRegistrationUseCase.execute({
                  actorId: parsed.userId,
                  shopId: parsed.shopId,
                  name: parsed.name,
                  cpf: cleanCpf,
                  email: normalizedEmail,
                });

              if (result.isLeft()) {
                throw result.value;
              }

              return {
                resourceKind: "REGISTRATION" as const,
                resourceId: result.value.registrationId,
                resourceVersion: 1,
                data: result.value,
              };
            },
          );

          return ok(attemptResult.resource?.data ?? attemptResult);
        } catch (execError: unknown) {
          return this.handleError(execError);
        }
      }

      const result = await this.createBarberRegistrationUseCase.execute({
        actorId: parsed.userId,
        shopId: parsed.shopId,
        name: parsed.name,
        cpf: cleanCpf,
        email: normalizedEmail,
      });

      if (result.isLeft()) {
        return this.handleError(result.value);
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ errors: err.issues });
      }

      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private handleError(error: unknown): HttpResponse {
    if (error instanceof ResourceNotFoundError) {
      return notFound({ error: error.message, message: error.message });
    }
    if (error instanceof NotAllowedError) {
      return forbidden({ error: error.message, message: error.message });
    }
    if (error instanceof IdentityConflictError) {
      return conflict({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof AlreadyAMemberError) {
      return conflict({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof PendingInvitationAlreadyExistsError) {
      return conflict({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof EmailSendError) {
      return clientError({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof IdempotencyKeyError) {
      if (
        error.code === "INVALID_IDEMPOTENCY_KEY" ||
        error.code === "IDEMPOTENCY_KEY_FUTURE_TIMESTAMP"
      ) {
        return clientError({
          error: error.message,
          message: error.message,
          code: error.code,
        });
      }
      return conflict({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }

    if (error instanceof Error) {
      return clientError({ error: error.message, message: error.message });
    }

    return fail(new Error(String(error)));
  }
}
