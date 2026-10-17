import { createHash, randomUUID } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { GeocodingCandidatesRepository } from "../../../repositories/geocoding-candidates-repository";
import type { GeocodingProvider } from "../../../services/geocoding-provider";
import type { Candidate } from "../../../services/discovery-contract";
import { Role } from "../../../../enterprise/entities/membership";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface SearchGeocodingAddressDTO {
  actorId: string;
  address: string;
  shopId?: string | null;
}

export type SearchGeocodingAddressResponse = Either<
  NotAllowedError | ResourceNotFoundError | Error,
  { candidates: Candidate[] }
>;

export class SearchGeocodingAddressUseCase {
  constructor(
    private geocodingProvider: GeocodingProvider,
    private candidatesRepository: GeocodingCandidatesRepository,
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository?: MembershipsRepository,
  ) {}

  async execute({
    actorId,
    address,
    shopId,
  }: SearchGeocodingAddressDTO): Promise<SearchGeocodingAddressResponse> {
    const cleanAddress = address.trim();
    if (cleanAddress.length < 3 || cleanAddress.length > 255) {
      return left(
        new Error(
          "Endereço deve conter entre 3 e 255 caracteres para geocodificação.",
        ),
      );
    }

    // Se shopId for fornecido, validar autorização do proprietário ativo
    if (shopId) {
      const barbershop = await this.barbershopsRepository.findById(shopId);
      if (!barbershop) {
        return left(new ResourceNotFoundError("Barbearia não encontrada."));
      }

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
              "Apenas o proprietário ativo da unidade pode buscar localização para o estabelecimento.",
            ),
          );
        }
      } else if (barbershop.ownerId.toString() !== actorId) {
        return left(new NotAllowedError());
      }
    }

    // Controle de quota / taxa de uso (30 reqs/hora, 100 reqs/dia)
    const withinLimit =
      await this.candidatesRepository.checkAndIncrementUsage(actorId);
    if (!withinLimit) {
      return left(
        new Error(
          "Limite de buscas de localização excedido. Aguarde antes de tentar novamente.",
        ),
      );
    }

    const geocodedResults = await this.geocodingProvider.geocode(cleanAddress);
    if (geocodedResults.length === 0) {
      return right({ candidates: [] });
    }

    const addressHash = createHash("sha256")
      .update(cleanAddress.toLowerCase())
      .digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validade estrita

    const candidates: Candidate[] = [];

    for (const result of geocodedResults) {
      const candidateId = randomUUID();

      await this.candidatesRepository.create({
        id: candidateId,
        actorId,
        barbershopId: shopId ?? null,
        addressHash,
        latitude: result.latitude,
        longitude: result.longitude,
        placeId: result.placeId,
        expiresAt,
      });

      candidates.push({
        candidateId,
        displayAddress: result.formattedAddress,
        point: {
          latitude: result.latitude,
          longitude: result.longitude,
        },
        expiresAt: expiresAt.toISOString(),
        attribution: "Google Maps",
      });
    }

    return right({ candidates });
  }
}
