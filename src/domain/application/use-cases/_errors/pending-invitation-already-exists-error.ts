import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class PendingInvitationAlreadyExistsError
  extends Error
  implements UseCaseError
{
  public readonly code = "PENDING_INVITATION_EXISTS";

  constructor(
    message = "Já existe um convite pendente para este e-mail nesta barbearia.",
  ) {
    super(message);
    this.name = "PendingInvitationAlreadyExistsError";
  }
}
