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
import {
  CannotDeactivateOwnerError,
  MembershipHasBookingsError,
  MembershipVersionConflictError,
} from "../../../../domain/application/use-cases/_errors/membership-errors";
import { NotAllowedError } from "../../../../domain/application/use-cases/_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../domain/application/use-cases/_errors/resource-not-found-error";
import type { DeactivateUnitMembershipUseCase } from "../../../../domain/application/use-cases/barbershop/deactivate-unit-membership/deactivate-unit-membership";
import { canonicalOperationHash } from "../../../../domain/application/services/canonical-operation-hash";
import {
  IdempotencyKeyError,
  type OperationAttemptService,
} from "../../../../domain/application/services/operation-attempt-service";
import type { MembershipsRepository } from "../../../../domain/application/repositories/memberships-repository";
import { isValidUuidV7 } from "../../../../core/security/uuidv7";

const deactivateUnitMembershipSchema = z.object({
  shopId: z.string().uuid({ message: "ID da barbearia inválido." }),
  membershipId: z.string().uuid({ message: "ID do vínculo inválido." }),
  expectedVersion: z.coerce
    .number({
      message: "expectedVersion é obrigatório para alteração de estado.",
    })
    .int({ message: "expectedVersion deve ser um número inteiro." })
    .min(1, { message: "expectedVersion deve ser maior ou igual a 1." }),
  userId: z.string().uuid({ message: "Usuário não autenticado." }),
  requestId: z.string().optional(),
});

export class DeactivateUnitMembershipController implements Controller {
  constructor(
    private deactivateUnitMembershipUseCase: DeactivateUnitMembershipUseCase,
    private operationAttemptService?: OperationAttemptService,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async handle(request: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const parsed = deactivateUnitMembershipSchema.parse(request);
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
          error:
            "Idempotency-Key é obrigatória para mutations de desligamento.",
          message:
            "Idempotency-Key é obrigatória para mutations de desligamento.",
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

      if (this.operationAttemptService) {
        let targetUserId: string | null = null;
        if (this.membershipsRepository) {
          const targetMem = await this.membershipsRepository.findById(
            parsed.membershipId,
          );
          if (
            !targetMem ||
            targetMem.barbershopId.toString() !== parsed.shopId
          ) {
            return notFound({
              error: "Vínculo não encontrado.",
              message: "Vínculo não encontrado.",
            });
          }
          targetUserId = targetMem.userId.toString();
        }

        const payloadHash = canonicalOperationHash({
          action: "DEACTIVATE_MEMBERSHIP",
          shopId: parsed.shopId,
          membershipId: parsed.membershipId,
          expectedVersion: parsed.expectedVersion,
        });

        try {
          const attemptResult = await this.operationAttemptService.executeOnce(
            {
              actorId: parsed.userId,
              operation: "DEACTIVATE_MEMBERSHIP",
              requestId,
              payloadHash,
              resourceKind: "MEMBERSHIP",
              lockResources: {
                unitIds: [parsed.shopId],
                professionalIds: targetUserId ? [targetUserId] : [],
                membershipIds: [parsed.membershipId],
              },
            },
            async (tx, context) => {
              const result = await this.deactivateUnitMembershipUseCase.execute(
                {
                  actorId: parsed.userId,
                  shopId: parsed.shopId,
                  membershipId: parsed.membershipId,
                  expectedVersion: parsed.expectedVersion,
                },
                tx,
                context,
              );

              if (result.isLeft()) {
                throw result.value;
              }

              return {
                resourceKind: "MEMBERSHIP" as const,
                resourceId: parsed.membershipId,
                resourceVersion: result.value.version,
                data: result.value,
              };
            },
          );

          return ok(attemptResult.resource?.data ?? attemptResult);
        } catch (execError: unknown) {
          return this.handleError(execError);
        }
      }

      const result = await this.deactivateUnitMembershipUseCase.execute({
        actorId: parsed.userId,
        shopId: parsed.shopId,
        membershipId: parsed.membershipId,
        expectedVersion: parsed.expectedVersion,
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
    if (error instanceof CannotDeactivateOwnerError) {
      return clientError({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof MembershipVersionConflictError) {
      return conflict({
        error: error.message,
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof MembershipHasBookingsError) {
      return conflict({
        error: error.message,
        message: error.message,
        code: error.code,
        blockingBookingIds: error.blockingBookingIds,
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
    if (
      error instanceof Error &&
      error.message === "IDEMPOTENCY_PAYLOAD_MISMATCH"
    ) {
      return conflict({
        error: "Payload incompatível com a chave de tentativa.",
        message: "Payload incompatível com a chave de tentativa.",
        code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
      });
    }
    if (
      error instanceof Error &&
      error.message === "OPERATION_ALREADY_CLOSED"
    ) {
      return conflict({
        error: "Operação já encerrada anteriormente.",
        message: "Operação já encerrada anteriormente.",
        code: "OPERATION_ALREADY_CLOSED",
      });
    }

    if (error instanceof Error) {
      return clientError({ error: error.message, message: error.message });
    }

    return fail(new Error(String(error)));
  }
}
