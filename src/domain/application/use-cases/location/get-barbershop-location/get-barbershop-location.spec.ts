import { beforeEach, describe, expect, it } from "vitest";
import { GetBarbershopLocationUseCase } from "./get-barbershop-location";
import { InMemoryBarbershopLocationsRepository } from "../../../../../../test/repositories/in-memory-barbershop-locations-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";

describe("GetBarbershopLocationUseCase", () => {
  let sut: GetBarbershopLocationUseCase;
  let locationsRepository: InMemoryBarbershopLocationsRepository;
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;

  beforeEach(() => {
    locationsRepository = new InMemoryBarbershopLocationsRepository();
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();

    sut = new GetBarbershopLocationUseCase(
      locationsRepository,
      barbershopsRepository,
      membershipsRepository,
    );
  });

  it("deve retornar estado UNCONFIRMED padrão para barbearia sem ponto cadastrado", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Nova",
        ownerId: new UniqueEntityId("owner-1"),
        location: "Rua Augusta, 500",
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
      shopId: "shop-1",
      actorId: "owner-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("UNCONFIRMED");
      expect(result.value.version).toBe(0);
      expect(result.value.point).toBeNull();
      expect(result.value.address).toBe("Rua Augusta, 500");
    }
  });

  it("deve retornar estado CONFIRMED quando localização já existe", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Vintage",
        ownerId: new UniqueEntityId("owner-1"),
        location: "Rua Augusta, 500",
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

    await locationsRepository.saveLocation({
      barbershopId: "shop-1",
      status: "CONFIRMED",
      latitude: -23.55052,
      longitude: -46.633308,
      version: 1,
      confirmedAt: new Date(),
      source: "GOOGLE",
      googlePlaceId: "place-123",
      googleReference: null,
      acquiredAt: new Date(),
      validUntil: new Date(),
      pinAdjusted: false,
      lastMutationId: "mut-1",
      lastMutationActorId: "owner-1",
      lastMutationHash: "hash-1",
      lastMutationSavedVersion: 1,
    });

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.status).toBe("CONFIRMED");
      expect(result.value.version).toBe(1);
      expect(result.value.point?.latitude).toBe(-23.55052);
    }
  });

  it("deve retornar ResourceNotFoundError se a barbearia não existir", async () => {
    const result = await sut.execute({
      shopId: "shop-inexistente",
      actorId: "owner-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("deve retornar NotAllowedError se o usuário não for proprietário da unidade", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Vintage",
        ownerId: new UniqueEntityId("owner-legitimo"),
        location: "Rua Augusta, 500",
      },
      new UniqueEntityId("shop-1"),
    );
    await barbershopsRepository.create(shop);

    const result = await sut.execute({
      shopId: "shop-1",
      actorId: "invasor",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("Regressão A6: deve rejeitar OWNER com vínculo INACTIVE ou barbearia INACTIVE ao consultar localização", async () => {
    const shop = Barbershop.create(
      {
        name: "Barbearia Vintage",
        ownerId: new UniqueEntityId("owner-inativo"),
        location: "Rua Augusta, 500",
      },
      new UniqueEntityId("shop-1"),
    );
    await barbershopsRepository.create(shop);

    await membershipsRepository.create(
      Membership.create({
        barbershopId: new UniqueEntityId("shop-1"),
        userId: new UniqueEntityId("owner-inativo"),
        role: Role.OWNER,
        state: "INACTIVE",
      }),
    );

    const inactiveOwnerRes = await sut.execute({
      shopId: "shop-1",
      actorId: "owner-inativo",
    });
    expect(inactiveOwnerRes.isLeft()).toBe(true);
    expect(inactiveOwnerRes.value).toBeInstanceOf(NotAllowedError);

    const inactiveShop = Barbershop.create(
      {
        name: "Barbearia Desativada",
        ownerId: new UniqueEntityId("owner-ativo"),
        location: "Rua Augusta, 500",
        status: "INACTIVE",
      },
      new UniqueEntityId("shop-desativada"),
    );
    await barbershopsRepository.create(inactiveShop);

    const inactiveShopRes = await sut.execute({
      shopId: "shop-desativada",
      actorId: "owner-ativo",
    });
    expect(inactiveShopRes.isLeft()).toBe(true);
    expect(inactiveShopRes.value).toBeInstanceOf(NotAllowedError);
  });
});
