import { beforeEach, describe, expect, it } from "vitest";
import { SearchGeocodingAddressUseCase } from "./search-geocoding-address";
import { InMemoryGeocodingCandidatesRepository } from "../../../../../../test/repositories/in-memory-geocoding-candidates-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import type { GeocodingProvider } from "../../../services/geocoding-provider";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Membership, Role } from "../../../../enterprise/entities/membership";

describe("SearchGeocodingAddressUseCase", () => {
  let sut: SearchGeocodingAddressUseCase;
  let candidatesRepository: InMemoryGeocodingCandidatesRepository;
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let fakeGeocodingProvider: GeocodingProvider;

  beforeEach(() => {
    candidatesRepository = new InMemoryGeocodingCandidatesRepository();
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();

    fakeGeocodingProvider = {
      geocode: async (address: string) => [
        {
          formattedAddress: `Rua Teste, 100 - ${address}`,
          latitude: -23.55052,
          longitude: -46.633308,
          placeId: "fake_place_id_123",
        },
      ],
    };

    sut = new SearchGeocodingAddressUseCase(
      fakeGeocodingProvider,
      candidatesRepository,
      barbershopsRepository,
      membershipsRepository,
    );
  });

  it("deve buscar candidatos com sucesso e salvar registros efêmeros", async () => {
    const result = await sut.execute({
      actorId: "actor-123",
      address: "Avenida Paulista, 1000",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.candidates).toHaveLength(1);
      expect(result.value.candidates[0].displayAddress).toContain(
        "Avenida Paulista",
      );
      expect(result.value.candidates[0].candidateId).toBeDefined();
      expect(candidatesRepository.items).toHaveLength(1);
    }
  });

  it("deve rejeitar endereço menor que 3 caracteres", async () => {
    const result = await sut.execute({
      actorId: "actor-123",
      address: "ab",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain("entre 3 e 255 caracteres");
    }
  });

  it("deve rejeitar se o ator não tiver permissão de OWNER na barbearia informada", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Alheia",
        ownerId: new UniqueEntityId("outro-owner"),
        location: "Rua A",
      },
      new UniqueEntityId("shop-1"),
    );
    await barbershopsRepository.create(shop);

    const result = await sut.execute({
      actorId: "actor-sem-permissao",
      address: "Avenida Paulista, 1000",
      shopId: "shop-1",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain("Apenas o proprietário ativo");
    }
  });

  it("deve permitir busca se o ator for o OWNER ativo da unidade", async () => {
    const shop = Barbershop.create(
      {
        name: "Minha Barbearia",
        ownerId: new UniqueEntityId("owner-1"),
        location: "Rua A",
      },
      new UniqueEntityId("shop-1"),
    );
    await barbershopsRepository.create(shop);

    const membership = Membership.create({
      barbershopId: new UniqueEntityId("shop-1"),
      userId: new UniqueEntityId("owner-1"),
      role: Role.OWNER,
      state: "ACTIVE",
    });
    await membershipsRepository.create(membership);

    const result = await sut.execute({
      actorId: "owner-1",
      address: "Avenida Paulista, 1000",
      shopId: "shop-1",
    });

    expect(result.isRight()).toBe(true);
  });

  it("deve bloquear requisição quando o rate limit de 30 consultas por hora for excedido", async () => {
    candidatesRepository.usageMap.set("actor-rate-limit", 30);

    const result = await sut.execute({
      actorId: "actor-rate-limit",
      address: "Avenida Paulista, 1000",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain(
        "Limite de buscas de localização excedido",
      );
    }
  });
});
