import { beforeEach, describe, expect, it } from "vitest";
import { SearchGeocodingAddressUseCase } from "./search-geocoding-address";
import { InMemoryGeocodingCandidatesRepository } from "../../../../../../test/repositories/in-memory-geocoding-candidates-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import type { GeocodingProvider } from "../../../services/geocoding-provider";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { GeocodingQuotaExceededError } from "../../_errors/geocoding-quota-exceeded-error";
import { LocationServiceUnavailableError } from "../../_errors/location-service-unavailable-error";

describe("SearchGeocodingAddressUseCase", () => {
  let sut: SearchGeocodingAddressUseCase;
  let candidatesRepository: InMemoryGeocodingCandidatesRepository;
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let usersRepository: InMemoryUsersRepository;
  let fakeGeocodingProvider: GeocodingProvider;

  beforeEach(async () => {
    candidatesRepository = new InMemoryGeocodingCandidatesRepository();
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    usersRepository = new InMemoryUsersRepository();

    await usersRepository.save(
      User.create(
        {
          name: "Onboarding Owner",
          email: "onboarding@test.com",
          password: Password.create("hash"),
          cpf: "11122233344",
          emailVerifiedAt: new Date(),
          onboardingIntent: "OWNER",
        },
        new UniqueEntityId("actor-123"),
      ),
    );

    await usersRepository.save(
      User.create(
        {
          name: "Rate Limit Owner",
          email: "ratelimit@test.com",
          password: Password.create("hash"),
          cpf: "55566677788",
          emailVerifiedAt: new Date(),
          onboardingIntent: "OWNER",
        },
        new UniqueEntityId("actor-rate-limit"),
      ),
    );

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
      usersRepository,
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

  it("Regressão R4: OWNER com vínculo INACTIVE deve ser rejeitado ao buscar candidatos para a unidade", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Inativa",
        ownerId: new UniqueEntityId("owner-inativo"),
        location: "Rua B",
      },
      new UniqueEntityId("shop-inativo"),
    );
    await barbershopsRepository.create(shop);

    const membership = Membership.create({
      barbershopId: new UniqueEntityId("shop-inativo"),
      userId: new UniqueEntityId("owner-inativo"),
      role: Role.OWNER,
      state: "INACTIVE",
    });
    await membershipsRepository.create(membership);

    const result = await sut.execute({
      actorId: "owner-inativo",
      address: "Avenida Paulista, 1000",
      shopId: "shop-inativo",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain("vínculo inativo");
    }
  });

  it("Regressão R7: Profissional BARBERMAN sem papel de OWNER não é elegível para onboarding sem shopId", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Emprego",
        ownerId: new UniqueEntityId("outro-owner"),
        location: "Rua C",
      },
      new UniqueEntityId("shop-emprego"),
    );
    await barbershopsRepository.create(shop);

    // mock staff affiliation as BARBERMAN
    barbershopsRepository.findManyByStaffId = async (_staffId: string) => [
      { barbershop: shop, role: "BARBERMAN" },
    ];

    const result = await sut.execute({
      actorId: "barbeiro-funcionario",
      address: "Avenida Paulista, 1000",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain(
        "não possui permissão para cadastrar ou gerenciar estabelecimentos",
      );
    }
  });

  it("Regressão A6: CLIENT sem barbearia e sem onboardingIntent OWNER deve ser rejeitado antes de consumir quota ou chamar provedor", async () => {
    let providerCalls = 0;
    const countingProvider: GeocodingProvider = {
      geocode: async () => {
        providerCalls++;
        return [];
      },
    };
    const strictSut = new SearchGeocodingAddressUseCase(
      countingProvider,
      candidatesRepository,
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
    );

    await usersRepository.save(
      User.create(
        {
          name: "Pure Client",
          email: "client@test.com",
          password: Password.create("hash"),
          cpf: "99988877766",
          accountType: "CLIENT",
          emailVerifiedAt: new Date(),
          onboardingIntent: "CLIENT",
        },
        new UniqueEntityId("pure-client-id"),
      ),
    );

    const result = await strictSut.execute({
      actorId: "pure-client-id",
      address: "Avenida Paulista, 1000",
    });

    expect(result.isLeft()).toBe(true);
    expect(providerCalls).toBe(0);
    expect(candidatesRepository.usageMap.get("pure-client-id") ?? 0).toBe(0);
  });

  it("Regressão A6: deve retornar GeocodingQuotaExceededError quando quota é atingida", async () => {
    candidatesRepository.usageMap.set("actor-rate-limit", 30);

    const result = await sut.execute({
      actorId: "actor-rate-limit",
      address: "Avenida Paulista, 1000",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(GeocodingQuotaExceededError);
      expect((result.value as GeocodingQuotaExceededError).code).toBe(
        "GEOCODING_QUOTA_EXCEEDED",
      );
    }
  });

  it("Regressão A6: deve propagar LocationServiceUnavailableError quando provedor Google estiver indisponível", async () => {
    const unavailableProvider: GeocodingProvider = {
      geocode: async () => {
        throw new LocationServiceUnavailableError(
          "GOOGLE_MAPS_API_KEY ausente.",
        );
      },
    };
    const unavailableSut = new SearchGeocodingAddressUseCase(
      unavailableProvider,
      candidatesRepository,
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
    );

    const result = await unavailableSut.execute({
      actorId: "actor-123",
      address: "Avenida Paulista, 1000",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(LocationServiceUnavailableError);
      expect((result.value as LocationServiceUnavailableError).code).toBe(
        "LOCATION_SERVICE_UNAVAILABLE",
      );
    }
  });
});
