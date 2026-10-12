import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class MembershipHasBookingsError extends Error implements UseCaseError {
  public readonly code = "MEMBERSHIP_HAS_BOOKINGS";
  public readonly blockingBookingIds: string[];

  constructor(
    blockingBookingIds: string[],
    message = "Membro possui agendamentos futuros ou em andamento.",
  ) {
    super(message);
    this.name = "MembershipHasBookingsError";
    this.blockingBookingIds = blockingBookingIds;
  }
}

export class MembershipVersionConflictError
  extends Error
  implements UseCaseError
{
  public readonly code = "MEMBERSHIP_VERSION_CONFLICT";

  constructor(
    message = "Versão do vínculo informada é conflitante ou desatualizada.",
  ) {
    super(message);
    this.name = "MembershipVersionConflictError";
  }
}

export class CannotDeactivateOwnerError extends Error implements UseCaseError {
  public readonly code = "CANNOT_DEACTIVATE_OWNER";

  constructor(
    message = "Não é permitido desativar a si mesmo ou ownership por esta ação.",
  ) {
    super(message);
    this.name = "CannotDeactivateOwnerError";
  }
}
