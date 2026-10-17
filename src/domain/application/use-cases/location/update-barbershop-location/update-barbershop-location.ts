import { createHash } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { BarbershopLocationsRepository } from "../../../repositories/barbershop-locations-repository";
import type { GeocodingCandidatesRepository } from "../../../repositories/geocoding-candidates-repository";
import type { LocationState } from "../../../services/discovery-contract";
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

export class UpdateBarbershopLocationUseCase {
  constructor(
    private locationsRepository: BarbershopLocationsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private candidatesRepository: GeocodingCandidatesRepository,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async execute({
    shopId,
    actorId,
    address,
    candidateId,
    latitude,
    longitude,
    expectedVersion,
    mutationId,
  }: UpdateBarbershopLocationDTO): Promise<UpdateBarbershopLocationResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    // 1. Autorização: Proprietário ativo da unidade
    if (this.membershipsRepository) {
      const actorMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          shopId,
          actorId,
        );

      const isOwnerActive =
        actorMembership &&
        actorMembership.role === Role.OWNER &&
        actorMembership.state === "ACTIVE";

      const isLegacyOwner = barbershop.ownerId.toString() === actorId;

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

    // 3. Verificação de idempotência e versão atual
    const currentLocation =
      await this.locationsRepository.findByBarbershopId(shopId);

    if (currentLocation) {
      if (currentLocation.lastMutationId === mutationId) {
        if (currentLocation.lastMutationHash === commandHash) {
          const state =
            await this.locationsRepository.findLocationState(shopId);
          if (state) return right(state);
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
    const candidate = await this.candidatesRepository.findById(candidateId);
    if (!candidate) {
      return left(
        new ResourceNotFoundError(
          "Candidato de geocodificação não encontrado ou expirado.",
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

    const now = new Date();
    if (candidate.expiresAt.getTime() <= now.getTime()) {
      return left(
        new Error("Candidato de localização expirado. Realize uma nova busca."),
      );
    }

    // 5. Persistência
    const pinAdjusted =
      candidate.latitude !== latitude || candidate.longitude !== longitude;
    const newVersion = expectedVersion + 1;
    // Resolução S3: Expiração em 25 dias para assegurar conformidade com a política Google
    const validUntil = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000);

    await this.locationsRepository.saveLocation({
      barbershopId: shopId,
      status: "CONFIRMED",
      latitude,
      longitude,
      version: newVersion,
      confirmedAt: now,
      source: "GOOGLE",
      googlePlaceId: candidate.placeId,
      googleReference: null,
      acquiredAt: now,
      validUntil,
      pinAdjusted,
      lastMutationId: mutationId,
      lastMutationActorId: actorId,
      lastMutationHash: commandHash,
      lastMutationSavedVersion: newVersion,
    });

    // Atualizar endereço cadastral da barbearia
    barbershop.location = cleanAddress;
    await this.barbershopsRepository.save(barbershop);

    // Consumir candidato para impedir reutilização
    await this.candidatesRepository.consume(candidateId);

    const updatedState =
      await this.locationsRepository.findLocationState(shopId);

    return right(
      updatedState ?? {
        shopId,
        address: cleanAddress,
        status: "CONFIRMED",
        source: "GOOGLE",
        version: newVersion,
        point: { latitude, longitude },
        confirmedAt: now.toISOString(),
        acquiredAt: now.toISOString(),
        validUntil: validUntil.toISOString(),
        lastOwnerMutation: {
          id: mutationId,
          commandHash,
          savedVersion: newVersion,
        },
      },
    );
  }
}
