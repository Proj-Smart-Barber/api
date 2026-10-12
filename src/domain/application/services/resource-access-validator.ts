import type { OperationResourceKind } from "./operation-attempt-service";

export interface ResourceAccessValidator {
  canAccess(
    actorId: string,
    resourceKind?: OperationResourceKind | null,
    resourceId?: string | null,
    tx?: any,
  ): Promise<boolean>;
}
