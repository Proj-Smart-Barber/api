import { createHash } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { BarbershopLocationsRepository } from "../../../repositories/barbershop-locations-repository";
import type { GeocodingCandidatesRepository } from "../../../repositories/geocoding-candidates-repository";
import type { LocationState } from "../../../services/discovery-contract";
import type { ProfessionalMembershipUnitOfWork } from "../../../services/professional-membership-unit-of-work";
import { Role } from "../../../../enterprise/entities/membership";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface UpdateBarbershopLocationDTO {
  shopId: string;
  actorId: string;
  address: string;
  candidateId: string;
  latitude: number;
  longitude: number;
  expectedVersion: number;
  mutationId: string;
}

export class LocationConflictError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LocationConflictError";
    this.code = code;
  }
}

export type UpdateBarbershopLocationResponse = Either<
  NotAllowedError | ResourceNotFoundError | LocationConflictError | Error,
  LocationState
>;

class RollbackLocationMutationError extends Error {
  constructor(
    readonly failure:
      | NotAllowedError
      | ResourceNotFoundError
      | LocationConflictError
      | Error,
  ) {
    super(failure.message);
    this.name = "RollbackLocationMutationError";
  }
}

export class UpdateBarbershopLocationUseCase {
  constructor(
    private locationsRepository: BarbershopLocationsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private candidatesRepository: GeocodingCandidatesRepository,
    private membershipsRepository?: MembershipsRepository,
    private unitOfWork?: ProfessionalMembershipUnitOfWork,
  ) {}

  async execute(
    dto: UpdateBarbershopLocationDTO,
  ): Promise<UpdateBarbershopLocationResponse> {
    if (this.unitOfWork) {
      try {
        return await this.unitOfWork.withLocks(
          { unitIds: [dto.shopId] },
          async (tx, context) => {
            const result = await this.performUpdate(
              dto,
              tx,
              context.serverTime,
            );
            if (result.isLeft()) {
              throw new RollbackLocationMutationError(result.value);
            }
            return result;
          },
        );
      } catch (err) {
        if (err instanceof RollbackLocationMutationError) {
          return left(err.failure);
        }
        throw err;
      }
    }

    return this.performUpdate(dto, undefined, new Date());
  }

  private async performUpdate(
    {
      shopId,
      actorId,
      address,
      candidateId,
      latitude,
      longitude,
      expectedVersion,
      mutationId,
    }: UpdateBarbershopLocationDTO,
    tx: any,
    serverTime: Date,
  ): Promise<UpdateBarbershopLocationResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    if (barbershop.status && barbershop.status !== "ACTIVE") {
      return left(new NotAllowedError("A barbearia informada não está ativa."));
    }

    // 1. Autorização: Proprietário ativo da unidade
    if (this.membershipsRepository) {
      const actorMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          shopId,
          actorId,
          tx,
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
            "Apenas o proprietário ativo da unidade pode alterar a localização comercial.",
          ),
        );
      }
    } else if (barbershop.ownerId.toString() !== actorId) {
      return left(new NotAllowedError());
    }

    const cleanAddress = address.trim();
    if (cleanAddress.length < 3 || cleanAddress.length > 255) {
      return left(new Error("Endereço comercial inválido."));
    }

    // 2. Validação geográfica
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return left(
        new Error(
          "Coordenadas geográficas inválidas. Latitude deve estar entre -90 e 90, e longitude entre -180 e 180.",
        ),
      );
    }

    const commandHash = createHash("sha256")
      .update(
        JSON.stringify({
          shopId,
          address: cleanAddress,
          candidateId,
          latitude,
          longitude,
          expectedVersion,
          mutationId,
        }),
      )
      .digest("hex");

    // 3. Verificação de idempotência e versão atual (atômica na transação)
    const currentLocation = await this.locationsRepository.findByBarbershopId(
      shopId,
      tx,
    );

    if (currentLocation) {
      if (currentLocation.lastMutationId === mutationId) {
        if (currentLocation.lastMutationHash === commandHash) {
          const state = await this.locationsRepository.findLocationState(
            shopId,
            tx,
          );
          if (state) {
            return right({
              ...state,
              address: state.address || barbershop.location,
            });
          }
        }
        return left(
          new LocationConflictError(
            "IDEMPOTENCY_PAYLOAD_MISMATCH",
            "Tentativa com a mesma chave e payload diferente já realizada.",
          ),
        );
      }

      if (currentLocation.version !== expectedVersion) {
        return left(
          new LocationConflictError(
            "LOCATION_VERSION_CONFLICT",
            "A versão informada não coincide com a versão atual da localização. Recarregue os dados e tente novamente.",
          ),
        );
      }
    } else if (expectedVersion !== 0) {
      return left(
        new LocationConflictError(
          "LOCATION_VERSION_CONFLICT",
          "A versão inicial esperada para unidade sem localização deve ser 0.",
        ),
      );
    }

    // 4. Validação estrita do candidato Google
    const candidate = await this.candidatesRepository.findById(candidateId, tx);
    if (!candidate) {
      return left(
        new ResourceNotFoundError(
          "Candidato de geocodificação não encontrado ou expirado.",
        ),
      );
    }

    if (candidate.consumedAt) {
      return left(
        new Error(
          "Candidato de localização já foi utilizado. Realize uma nova busca.",
        ),
      );
    }

    if (candidate.actorId !== actorId) {
      return left(
        new NotAllowedError(
          "Candidato de localização pertence a outro usuário.",
        ),
      );
    }

    if (candidate.barbershopId && candidate.barbershopId !== shopId) {
      return left(
        new NotAllowedError(
          "Candidato de localização emitido para outra unidade.",
        ),
      );
    }

    if (candidate.expiresAt.getTime() <= serverTime.getTime()) {
      return left(
        new Error("Candidato de localização expirado. Realize uma nova busca."),
      );
    }

    const expectedAddressHash = createHash("sha256")
      .update(cleanAddress.toLowerCase())
      .digest("hex");

    const allowedAddressHashes = candidate.addressHash
      .split(":")
      .filter((h) => h.length > 0);

    if (!allowedAddressHashes.includes(expectedAddressHash)) {
      return left(
        new Error(
          "O endereço informado não corresponde ao endereço validado pelo candidato de geocodificação.",
        ),
      );
    }

    // 5. Consumir candidato condicionalmente ANTES de gravar estado para impedir corrida
    const consumed = await this.candidatesRepository.consume(candidateId, tx);
    if (consumed === false) {
      return left(
        new Error(
          "Candidato de localização já foi utilizado por outra requisição.",
        ),
      );
    }

    // 6. Persistência atômica
    const pinAdjusted =
      candidate.latitude !== latitude || candidate.longitude !== longitude;
    const newVersion = expectedVersion + 1;
    // Resolução S3: Expiração em 25 dias para assegurar conformidade com a política Google
    const validUntil = new Date(
      serverTime.getTime() + 25 * 24 * 60 * 60 * 1000,
    );

    try {
      await this.locationsRepository.saveLocation(
        {
          barbershopId: shopId,
          status: "CONFIRMED",
          latitude,
          longitude,
          version: newVersion,
          confirmedAt: serverTime,
          source: "GOOGLE",
          googlePlaceId: candidate.placeId,
          googleReference: null,
          acquiredAt: serverTime,
          validUntil,
          pinAdjusted,
          lastMutationId: mutationId,
          lastMutationActorId: actorId,
          lastMutationHash: commandHash,
          lastMutationSavedVersion: newVersion,
        },
        tx,
        expectedVersion,
      );
    } catch (err: any) {
      if (err?.message === "LOCATION_VERSION_CONFLICT") {
        return left(
          new LocationConflictError(
            "LOCATION_VERSION_CONFLICT",
            "A versão informada não coincide com a versão atual da localização.",
          ),
        );
      }
      throw err;
    }

    // Atualizar endereço cadastral da barbearia dentro da mesma transação
    barbershop.location = cleanAddress;
    await this.barbershopsRepository.save(barbershop, tx);

    const updatedState = await this.locationsRepository.findLocationState(
      shopId,
      tx,
    );

    if (updatedState) {
      return right({
        ...updatedState,
        address: updatedState.address || cleanAddress,
      });
    }

    return right({
      shopId,
      address: cleanAddress,
      status: "CONFIRMED",
      source: "GOOGLE",
      version: newVersion,
      point: { latitude, longitude },
      confirmedAt: serverTime.toISOString(),
      acquiredAt: serverTime.toISOString(),
      validUntil: validUntil.toISOString(),
      lastOwnerMutation: {
        id: mutationId,
        commandHash,
        savedVersion: newVersion,
      },
    });
  }
}
