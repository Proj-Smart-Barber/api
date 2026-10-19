import { createHash, randomUUID } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { GeocodingCandidatesRepository } from "../../../repositories/geocoding-candidates-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { GeocodingProvider } from "../../../services/geocoding-provider";
import type { Candidate } from "../../../services/discovery-contract";
import { Role } from "../../../../enterprise/entities/membership";
import { GeocodingQuotaExceededError } from "../../_errors/geocoding-quota-exceeded-error";
import { LocationServiceUnavailableError } from "../../_errors/location-service-unavailable-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

export interface SearchGeocodingAddressDTO {
  actorId: string;
  address: string;
  shopId?: string | null;
}

export type SearchGeocodingAddressResponse = Either<
  | NotAllowedError
  | ResourceNotFoundError
  | GeocodingQuotaExceededError
  | LocationServiceUnavailableError
  | Error,
  { candidates: Candidate[] }
>;

export class SearchGeocodingAddressUseCase {
  constructor(
    private geocodingProvider: GeocodingProvider,
    private candidatesRepository: GeocodingCandidatesRepository,
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository?: MembershipsRepository,
    private usersRepository?: UsersRepository,
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

    // 1. Autorização estrita antes de consumir quota ou consultar provedor externo
    if (shopId) {
      const barbershop = await this.barbershopsRepository.findById(shopId);
      if (!barbershop) {
        return left(new ResourceNotFoundError("Barbearia não encontrada."));
      }

      if (barbershop.status && barbershop.status !== "ACTIVE") {
        return left(
          new NotAllowedError("A barbearia informada não está ativa."),
        );
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
              "Apenas o proprietário ativo da unidade pode buscar localização para o estabelecimento.",
            ),
          );
        }
      } else if (barbershop.ownerId.toString() !== actorId) {
        return left(
          new NotAllowedError(
            "Apenas o proprietário ativo da unidade pode buscar localização para o estabelecimento.",
          ),
        );
      }
    } else {
      const staffUnits =
        await this.barbershopsRepository.findManyByStaffId(actorId);
      const ownedShops =
        await this.barbershopsRepository.findManyByOwnerId(actorId);

      let hasActiveOwnerUnit = false;
      let hasInactiveAffiliation = false;

      for (const shop of ownedShops) {
        if (shop.status && shop.status !== "ACTIVE") {
          hasInactiveAffiliation = true;
          continue;
        }
        if (this.membershipsRepository) {
          const mem = await this.membershipsRepository.findByBarbershopAndUser(
            shop.id.toString(),
            actorId,
          );
          if (mem && mem.state === "INACTIVE") {
            hasInactiveAffiliation = true;
            continue;
          }
          if (
            (mem && mem.role === Role.OWNER && mem.state === "ACTIVE") ||
            mem === null
          ) {
            hasActiveOwnerUnit = true;
          }
        } else {
          hasActiveOwnerUnit = true;
        }
      }

      for (const staffEntry of staffUnits) {
        const isOwnerRole =
          staffEntry.role === Role.OWNER || staffEntry.role === "OWNER";
        if (!isOwnerRole) {
          continue;
        }
        if (
          staffEntry.barbershop.status &&
          staffEntry.barbershop.status !== "ACTIVE"
        ) {
          hasInactiveAffiliation = true;
          continue;
        }
        if (this.membershipsRepository) {
          const mem = await this.membershipsRepository.findByBarbershopAndUser(
            staffEntry.barbershop.id.toString(),
            actorId,
          );
          if (mem && mem.state === "INACTIVE") {
            hasInactiveAffiliation = true;
            continue;
          }
        }
        hasActiveOwnerUnit = true;
      }

      if (
        staffUnits.length > 0 &&
        !hasActiveOwnerUnit &&
        staffUnits.some((u) => u.role !== Role.OWNER && u.role !== "OWNER")
      ) {
        return left(
          new NotAllowedError(
            "Profissional não possui permissão para cadastrar ou gerenciar estabelecimentos.",
          ),
        );
      }

      let hasOnboardingEligibility = false;
      if (!hasActiveOwnerUnit && this.usersRepository) {
        const user = await this.usersRepository.findById(actorId);
        if (
          user &&
          user.isEmailVerified &&
          (user.onboardingIntent === "OWNER" ||
            user.accountType === "PLATFORM_ADMIN" ||
            (user.accountType === "OWNER" && !hasInactiveAffiliation))
        ) {
          hasOnboardingEligibility = true;
        }
      }

      if (!hasActiveOwnerUnit && !hasOnboardingEligibility) {
        if (hasInactiveAffiliation) {
          return left(
            new NotAllowedError(
              "Usuário com vínculo ou unidade inativa não pode buscar localização comercial.",
            ),
          );
        }
        return left(
          new NotAllowedError(
            "Apenas proprietários ativos ou usuários elegíveis em onboarding de proprietário podem buscar localização comercial.",
          ),
        );
      }
    }

    // 2. Controle de quota / taxa de uso (30 reqs/hora, 100 reqs/dia)
    const withinLimit =
      await this.candidatesRepository.checkAndIncrementUsage(actorId);
    if (!withinLimit) {
      return left(new GeocodingQuotaExceededError());
    }

    // 3. Consulta ao provedor externo com propagação tipada de indisponibilidade
    let geocodedResults: Awaited<ReturnType<GeocodingProvider["geocode"]>>;
    try {
      geocodedResults = await this.geocodingProvider.geocode(cleanAddress);
    } catch (err) {
      if (err instanceof LocationServiceUnavailableError) {
        return left(err);
      }
      throw err;
    }

    if (geocodedResults.length === 0) {
      return right({ candidates: [] });
    }

    const queryAddressHash = createHash("sha256")
      .update(cleanAddress.toLowerCase())
      .digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de validade estrita

    const candidates: Candidate[] = [];

    for (const result of geocodedResults) {
      const candidateId = randomUUID();
      const formattedAddressHash = createHash("sha256")
        .update(result.formattedAddress.trim().toLowerCase())
        .digest("hex");

      const addressHash =
        queryAddressHash === formattedAddressHash
          ? queryAddressHash
          : `${queryAddressHash}:${formattedAddressHash}`;

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
