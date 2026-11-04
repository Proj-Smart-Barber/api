import type { Request, Response } from "express";
import { adaptRoute } from "../../../../core/infra/adapters/express-route-adapter";
import { CreateBarbershopUseCase } from "../../../../domain/application/use-cases/barbershop/create-barbershop/create-barbershop";
import { Role } from "../../../../domain/enterprise/entities/membership";
import { User } from "../../../../domain/enterprise/entities/user";
import { Password } from "../../../../domain/enterprise/entities/value-objects/password";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryUsersRepository } from "../../../../../test/repositories/in-memory-users-repository";
import { CreateBarbershopController } from "./create-barbershop.controller";

let barbershopsRepository: InMemoryBarbershopsRepository;
let usersRepository: InMemoryUsersRepository;
let controller: CreateBarbershopController;
let owner: User;

describe("CreateBarbershopController", () => {
  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    usersRepository = new InMemoryUsersRepository();
    owner = await usersRepository.save(
      User.create({
        name: "Owner",
        email: "owner@example.com",
        password: Password.create("hashed-password"),
        cpf: "12345678901",
      }),
    );

    const useCase = new CreateBarbershopUseCase(
      barbershopsRepository,
      usersRepository,
    );
    controller = new CreateBarbershopController(useCase);
  });

  it("should create a barbershop for the authenticated user with envelope _body", async () => {
    const response = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12.345.678/0001-90",
        location: "Rua X, 123",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(barbershopsRepository.items).toHaveLength(1);
    expect(barbershopsRepository.memberships[0].role).toBe(Role.OWNER);
    expect(barbershopsRepository.memberships[0].userId.toString()).toBe(
      owner.id.toString(),
    );
    expect(barbershopsRepository.items[0].name).toBe("Barbearia do Zé");
  });

  it("should accept request passing through adaptRoute with internal metadata (headers, _body, _query)", async () => {
    const expressHandler = adaptRoute(controller);

    const req = {
      headers: {
        "x-smartbarber-client": "web",
        host: "api-black-theta-13.vercel.app",
      },
      user: { sub: owner.id.toString() },
      body: {
        name: "Barbearia Via Adapter",
        cnpj: "12.345.678/0001-90",
        location: "Avenida Central, 100",
      },
      params: {},
      query: {
        name: "MaliciousQueryName",
        cnpj: "00000000000000",
      },
      originalUrl: "/barbershops",
      method: "POST",
    } as unknown as Request;

    let statusCode = 0;

    const res = {
      setHeader: () => res,
      cookie: () => res,
      clearCookie: () => res,
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: () => res,
      send: () => res,
    } as unknown as Response;

    await expressHandler(req, res);

    expect(statusCode).toBe(201);
    expect(barbershopsRepository.items).toHaveLength(1);
    // Deve usar os dados do body de negócio, ignorando a query maliciosa
    expect(barbershopsRepository.items[0].name).toBe("Barbearia Via Adapter");
    expect(barbershopsRepository.items[0].cnpj).toBe("12345678000190");
    expect(barbershopsRepository.memberships[0].userId.toString()).toBe(
      owner.id.toString(),
    );
  });

  it("should reject an unknown field inside _body", async () => {
    const response = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12.345.678/0001-90",
        location: "Rua X, 123",
        unknownProperty: "malicious_payload",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);
  });

  it("should reject client-provided ownerId or role inside _body", async () => {
    const responseWithOwnerId = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12345678000190",
        location: "Rua X, 123",
        ownerId: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(responseWithOwnerId.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);

    const responseWithRole = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12345678000190",
        location: "Rua X, 123",
        role: "ADMIN",
      },
    });

    expect(responseWithRole.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);
  });

  it("should reject an invalid CNPJ", async () => {
    const response = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia do Zé",
        cnpj: "123",
        location: "Rua X, 123",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);
  });

  it("should reject an empty location", async () => {
    const response = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12.345.678/0001-90",
        location: "   ",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(barbershopsRepository.items).toHaveLength(0);
  });

  it("should reject unauthenticated request (missing or invalid userId) with 401", async () => {
    const responseWithoutUser = await controller.handle({
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12.345.678/0001-90",
        location: "Rua X, 123",
      },
    });

    expect(responseWithoutUser.statusCode).toBe(401);
    expect(barbershopsRepository.items).toHaveLength(0);

    const responseWithInvalidUser = await controller.handle({
      userId: "not-a-valid-uuid",
      _body: {
        name: "Barbearia do Zé",
        cnpj: "12.345.678/0001-90",
        location: "Rua X, 123",
      },
    });

    expect(responseWithInvalidUser.statusCode).toBe(401);
    expect(barbershopsRepository.items).toHaveLength(0);
  });

  it("should prevent duplicate barbershop creation upon retry after location failure", async () => {
    // 1ª criação: Sucesso
    const firstResponse = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia Pioneira",
        cnpj: "12.345.678/0001-90",
        location: "Rua Principal, 500",
      },
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(barbershopsRepository.items).toHaveLength(1);

    // 2ª tentativa (mesmo CNPJ ou slug após eventual erro de confirmação na UI): Retorna conflito 409
    const secondResponse = await controller.handle({
      userId: owner.id.toString(),
      _body: {
        name: "Barbearia Pioneira",
        cnpj: "12.345.678/0001-90",
        location: "Rua Principal, 500",
      },
    });

    expect(secondResponse.statusCode).toBe(409);
    // Não duplica unidades
    expect(barbershopsRepository.items).toHaveLength(1);
  });
});
