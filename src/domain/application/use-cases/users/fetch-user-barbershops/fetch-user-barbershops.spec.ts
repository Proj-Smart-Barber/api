import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { FetchUserBarbershopsUseCase } from "./fetch-user-barbershops";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";

let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: FetchUserBarbershopsUseCase;

describe("Fetch User Barbershops Use Case", () => {
  beforeEach(() => {
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    sut = new FetchUserBarbershopsUseCase(inMemoryBarbershopsRepository);

    const barbershop1 = Barbershop.create(
      {
        name: "Barbearia Matriz",
        ownerId: new UniqueEntityId("user-1"),
        timezone: "America/Sao_Paulo",
        slug: Slug.create("barbearia-matriz"),
        cnpj: "12345678901234",
        location: "Av Paulista, 1000",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-1"),
    );

    const barbershop2 = Barbershop.create(
      {
        name: "Barbearia Filial",
        ownerId: new UniqueEntityId("owner-other"),
        timezone: "America/Sao_Paulo",
        slug: Slug.create("barbearia-filial"),
        cnpj: "98765432109876",
        location: "Av Faria Lima, 500",
        status: "ACTIVE",
      },
      new UniqueEntityId("shop-2"),
    );

    inMemoryBarbershopsRepository.items.push(barbershop1, barbershop2);

    inMemoryBarbershopsRepository.memberships.push(
      Membership.create({
        barbershopId: new UniqueEntityId("shop-1"),
        userId: new UniqueEntityId("user-1"),
        role: Role.OWNER,
      }),
      Membership.create({
        barbershopId: new UniqueEntityId("shop-2"),
        userId: new UniqueEntityId("user-1"),
        role: Role.BARBERMAN,
      }),
      Membership.create({
        barbershopId: new UniqueEntityId("shop-2"),
        userId: new UniqueEntityId("user-2"),
        role: Role.OWNER,
      }),
    );
  });

  it("should return all barbershops associated with the authenticated user", async () => {
    const result = await sut.execute({
      userId: "user-1",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.barbershops).toHaveLength(2);
      expect(result.value.barbershops).toEqual([
        {
          id: "shop-1",
          name: "Barbearia Matriz",
          role: "OWNER",
          status: "ACTIVE",
          timezone: "America/Sao_Paulo",
        },
        {
          id: "shop-2",
          name: "Barbearia Filial",
          role: "BARBERMAN",
          status: "ACTIVE",
          timezone: "America/Sao_Paulo",
        },
      ]);
    }
  });

  it("should return empty list when user has no associated barbershops", async () => {
    const result = await sut.execute({
      userId: "user-without-shops",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.barbershops).toHaveLength(0);
    }
  });
});
