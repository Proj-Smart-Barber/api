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
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { RevokeInvitationUseCase } from "../../../../domain/application/use-cases/invitations/revoke-invitation/revoke-invitation";

const revokeInvitationSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  invitationId: z.string().uuid({ message: "ID do convite inválido." }),
  userId: z.string().uuid({ message: "ID do usuário inválido." }),
  requestId: z.string().optional(),
});

export class RevokeInvitationController implements Controller {
  constructor(
    private revokeInvitationUseCase: RevokeInvitationUseCase,
    private operationAttemptService?: OperationAttemptService,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = revokeInvitationSchema.parse(request);
      const headers = request.headers as
        | Record<string, string | undefined>
        | undefined;
      const headerKey =
        headers?.["idempotency-key"] ?? headers?.["Idempotency-Key"];
      const rawRequestId =
        typeof headerKey === "string" && headerKey.trim() !== ""
          ? headerKey.trim()
          : parsed.requestId;

      if (rawRequestId && !isValidUuidV7(rawRequestId)) {
        return clientError({
          error:
            "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
          message:
            "Chave de idempotência inválida. Deve ser UUIDv7 com timestamp válido.",
          code: "INVALID_IDEMPOTENCY_KEY",
        });
      }

      if (rawRequestId && this.operationAttemptService) {
        const payloadHash = canonicalOperationHash({
          action: "REVOKE_INVITATION",
          shopId: parsed.shopId,
          invitationId: parsed.invitationId,
        });

        try {
          const attemptResult = await this.operationAttemptService.executeOnce(
            {
              actorId: parsed.userId,
              operation: "REVOKE_INVITATION",
              requestId: rawRequestId,
              payloadHash,
              resourceKind: "INVITATION",
              lockResources: {
                unitIds: [parsed.shopId],
              },
            },
            async (_tx, _context) => {
              const result = await this.revokeInvitationUseCase.execute({
                barbershopId: parsed.shopId,
                invitationId: parsed.invitationId,
                userId: parsed.userId,
              });

              if (result.isLeft()) {
                throw result.value;
              }

              return {
                resourceKind: "INVITATION" as const,
                resourceId: result.value.invitationId,
                resourceVersion: 1,
                data: {
                  revoked: true,
                  invitationId: result.value.invitationId,
                  status: result.value.status,
                },
              };
            },
          );

          return ok(attemptResult.resource?.data ?? attemptResult);
        } catch (execError: unknown) {
          return this.handleError(execError);
        }
      }

      const result = await this.revokeInvitationUseCase.execute({
        barbershopId: parsed.shopId,
        invitationId: parsed.invitationId,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        return this.handleError(result.value);
      }

      return ok({
        revoked: true,
        invitationId: result.value.invitationId,
        status: result.value.status,
      });
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
