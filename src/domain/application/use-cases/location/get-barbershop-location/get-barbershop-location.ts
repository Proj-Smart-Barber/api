import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { BarbershopLocationsRepository } from "../../../repositories/barbershop-locations-repository";
import type { LocationState } from "../../../services/discovery-contract";
import { Role } from "../../../../enterprise/entities/membership";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface GetBarbershopLocationDTO {
  shopId: string;
  actorId: string;
}

export type GetBarbershopLocationResponse = Either<
  NotAllowedError | ResourceNotFoundError | Error,
  LocationState
>;

export class GetBarbershopLocationUseCase {
  constructor(
    private locationsRepository: BarbershopLocationsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async execute({
    shopId,
    actorId,
  }: GetBarbershopLocationDTO): Promise<GetBarbershopLocationResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.status && barbershop.status !== "ACTIVE") {
      return left(new NotAllowedError("A barbearia informada não está ativa."));
    }

    if (this.membershipsRepository) {
      const actorMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          shopId,
          actorId,
        );

      if (actorMembership && actorMembership.state === "INACTIVE") {
        return left(
          new NotAllowedError("Usuário com vínculo inativo nesta unidade."),
        );
      }

      const isOwnerActive =
        actorMembership &&
        actorMembership.role === Role.OWNER &&
        actorMembership.state === "ACTIVE";

      const isLegacyOwner =
        actorMembership === null && barbershop.ownerId.toString() === actorId;

      if (!isOwnerActive && !isLegacyOwner) {
        return left(
          new NotAllowedError(
            "Apenas o proprietário ativo da unidade pode consultar a localização comercial.",
          ),
        );
      }
    } else if (barbershop.ownerId.toString() !== actorId) {
      return left(new NotAllowedError());
    }

    const state = await this.locationsRepository.findLocationState(shopId);
    if (!state) {
      return right({
        shopId: barbershop.id.toString(),
        address: barbershop.location,
        status: "UNCONFIRMED",
        source: "MANUAL",
        version: 0,
        point: null,
        confirmedAt: null,
        acquiredAt: null,
        validUntil: null,
        lastOwnerMutation: null,
      });
    }

    return right(state);
  }
}
