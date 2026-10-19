import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  UpdateBarbershopLocationUseCase,
  LocationConflictError,
} from "./update-barbershop-location";
import { InMemoryBarbershopLocationsRepository } from "../../../../../../test/repositories/in-memory-barbershop-locations-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryGeocodingCandidatesRepository } from "../../../../../../test/repositories/in-memory-geocoding-candidates-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { NotAllowedError } from "../../_errors/not-allowed-error";

describe("UpdateBarbershopLocationUseCase", () => {
  let sut: UpdateBarbershopLocationUseCase;
  let locationsRepository: InMemoryBarbershopLocationsRepository;
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let candidatesRepository: InMemoryGeocodingCandidatesRepository;
  let membershipsRepository: InMemoryMembershipsRepository;

  beforeEach(() => {
    locationsRepository = new InMemoryBarbershopLocationsRepository();
    barbershopsRepository = new InMemoryBarbershopsRepository();
    candidatesRepository = new InMemoryGeocodingCandidatesRepository();
    membershipsRepository = new InMemoryMembershipsRepository();

    sut = new UpdateBarbershopLocationUseCase(
      locationsRepository,
      barbershopsRepository,
      candidatesRepository,
      membershipsRepository,
    );
  });

  async function setupShopAndOwner() {
    const shop = Barbershop.create(
      {
        name: "Barbearia Teste",
        ownerId: new UniqueEntityId("owner-1"),
        location: "Endereço Antigo",
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

    const addressHash = createHash("sha256")
      .update("Avenida Paulista, 1500".toLowerCase())
      .digest("hex");

    const candidate = await candidatesRepository.create({
      id: "candidate-1",
      actorId: "owner-1",
      barbershopId: "shop-1",
      addressHash,
      latitude: -23.55052,
      longitude: -46.633308,
      placeId: "google-place-1",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return { shop, membership, candidate };
  }

  it("deve atualizar e confirmar localização com sucesso e consumir candidato", async () => {
    await setupShopAndOwner();

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-001",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("CONFIRMED");
      expect(result.value.version).toBe(1);
      expect(result.value.point?.latitude).toBe(-23.55052);
      expect(result.value.source).toBe("GOOGLE");
      // Candidato consumido tem consumedAt preenchido
      const candidateAfter = await candidatesRepository.findById("candidate-1");
      expect(candidateAfter?.consumedAt).toBeTruthy();
      // Endereço cadastral da barbearia atualizado
      const updatedShop = await barbershopsRepository.findById("shop-1");
      expect(updatedShop?.location).toBe("Avenida Paulista, 1500");
    }
  });

  it("deve retornar o mesmo resultado em caso de replay com mesma mutationId e payload idêntico", async () => {
    await setupShopAndOwner();

    await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-001",
    });

    // Replay idempotente com mesma mutationId
    const replayResult = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-001",
    });

    expect(replayResult.isRight()).toBe(true);
    if (replayResult.isRight()) {
      expect(replayResult.value.version).toBe(1);
    }
  });

  it("deve rejeitar com IDEMPOTENCY_PAYLOAD_MISMATCH se mesma mutationId for usada com payload diferente", async () => {
    await setupShopAndOwner();

    await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-001",
    });

    const conflictResult = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 9999", // Mudou o endereço!
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-001",
    });

    expect(conflictResult.isLeft()).toBe(true);
    expect(conflictResult.value).toBeInstanceOf(LocationConflictError);
    if (conflictResult.value instanceof LocationConflictError) {
      expect(conflictResult.value.code).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    }
  });

  it("deve rejeitar com LOCATION_VERSION_CONFLICT se a versão esperada divergir", async () => {
    await setupShopAndOwner();

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 5, // Errado! Esperado 0
      mutationId: "mut-001",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(LocationConflictError);
    if (result.value instanceof LocationConflictError) {
      expect(result.value.code).toBe("LOCATION_VERSION_CONFLICT");
    }
  });

  it("deve rejeitar candidato que pertença a outro usuário", async () => {
    await setupShopAndOwner();

    const addressHash = createHash("sha256")
      .update("Avenida Paulista, 1500".toLowerCase())
      .digest("hex");

    // Criar candidato emitido para outro ator
    await candidatesRepository.create({
      id: "candidate-outro-ator",
      actorId: "outro-usuario",
      barbershopId: "shop-1",
      addressHash,
      latitude: -23.55052,
      longitude: -46.633308,
      placeId: "google-place-2",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-outro-ator",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-002",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("deve rejeitar coordenadas geográficas inválidas", async () => {
    await setupShopAndOwner();

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: 105, // Inválido! > 90
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-003",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain(
        "Coordenadas geográficas inválidas",
      );
    }
  });

  it("Regressão R6: deve rejeitar candidato já consumido", async () => {
    await setupShopAndOwner();

    // Consumir o candidato previamente
    await candidatesRepository.consume("candidate-1");

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-004",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain("já foi utilizado");
    }
  });

  it("Regressão R6: deve rejeitar candidato com addressHash incompatível com o endereço", async () => {
    await setupShopAndOwner();

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: "Rua Diferente, 777", // Diferente do hash gerado para Avenida Paulista, 1500
      candidateId: "candidate-1",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-005",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.message).toContain(
        "não corresponde ao endereço validado",
      );
    }
  });

  it("Regressão R4: OWNER com vínculo INACTIVE deve ser rejeitado ao tentar atualizar localização", async () => {
    const shop = Barbershop.create(
      {
        name: "Shop Inactive Owner",
        ownerId: new UniqueEntityId("owner-inactive"),
        location: "Endereço",
      },
      new UniqueEntityId("shop-inactive-owner"),
    );
    await barbershopsRepository.create(shop);

    const membership = Membership.create({
      barbershopId: new UniqueEntityId("shop-inactive-owner"),
      userId: new UniqueEntityId("owner-inactive"),
      role: Role.OWNER,
      state: "INACTIVE",
    });
    await membershipsRepository.create(membership);

    const addressHash = createHash("sha256")
      .update("Avenida Paulista, 1500".toLowerCase())
      .digest("hex");

    await candidatesRepository.create({
      id: "candidate-inactive",
      actorId: "owner-inactive",
      barbershopId: "shop-inactive-owner",
      addressHash,
      latitude: -23.55052,
      longitude: -46.633308,
      placeId: "google-place-1",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await sut.execute({
      shopId: "shop-inactive-owner",
      actorId: "owner-inactive",
      address: "Avenida Paulista, 1500",
      candidateId: "candidate-inactive",
      latitude: -23.55052,
      longitude: -46.633308,
      expectedVersion: 0,
      mutationId: "mut-inactive",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(NotAllowedError);
      expect(result.value.message).toContain("vínculo inativo");
    }
  });

  it("Regressão A6: deve aceitar confirmação usando o displayAddress formatado retornado pelo Google", async () => {
    await setupShopAndOwner();

    const queryHash = createHash("sha256")
      .update("av paulista 1000")
      .digest("hex");
    const formattedAddress =
      "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100, Brasil";
    const formattedHash = createHash("sha256")
      .update(formattedAddress.toLowerCase())
      .digest("hex");

    await candidatesRepository.create({
      id: "candidate-formatted",
      actorId: "owner-1",
      barbershopId: "shop-1",
      addressHash: `${queryHash}:${formattedHash}`,
      latitude: -23.5648865,
      longitude: -46.651918,
      placeId: "ChIJ-formatted",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
      address: formattedAddress,
      candidateId: "candidate-formatted",
      latitude: -23.5648865,
      longitude: -46.651918,
      expectedVersion: 0,
      mutationId: "mut-formatted",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.address).toBe(formattedAddress);
      expect(result.value.version).toBe(1);
    }
  });
});
