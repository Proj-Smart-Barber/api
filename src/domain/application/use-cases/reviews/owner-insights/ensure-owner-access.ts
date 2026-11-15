import { left, right, type Either } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { Barbershop } from "../../../../enterprise/entities/barbershop";

export interface EnsureOwnerAccessResult {
  barbershop: Barbershop;
}

export async function ensureOwnerAccess(
  barbershopsRepository: BarbershopsRepository,
  membershipsRepository: MembershipsRepository,
  shopId: string,
  actorId: string,
): Promise<Either<ResourceNotFoundError | NotAllowedError, EnsureOwnerAccessResult>> {
  const barbershop = await barbershopsRepository.findById(shopId);
  if (!barbershop) {
    return left(new ResourceNotFoundError("Barbearia não encontrada."));
  }

  const actorMembership = await membershipsRepository.findByBarbershopAndUser(
    shopId,
    actorId,
  );
  const isActiveOwnerMembership =
    actorMembership?.role === "OWNER" && actorMembership?.state === "ACTIVE";

  if (!isActiveOwnerMembership) {
    return left(
      new NotAllowedError(
        "Apenas o proprietário ativo da unidade pode acessar os dados gerenciais de avaliações.",
      ),
    );
  }

  return right({ barbershop });
}
