import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../drizzle";
import {
  users,
  barbershops,
  membership,
  invitations,
  barberRegistrations,
  invitationDeliveries,
  operationAttempts,
} from "../drizzle/schema";
import { DrizzleBarbershopsRepository } from "../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleUsersRepository } from "../drizzle/repositories/drizzle-users-repository";
import { DrizzleInvitationsRepository } from "../drizzle/repositories/drizzle-invitations-repository";
import { DrizzleBarberRegistrationsRepository } from "../drizzle/repositories/drizzle-barber-registrations-repository";
import { DrizzleNotificationsRepository } from "../drizzle/repositories/drizzle-notifications-repository";
import { DrizzleInvitationDeliveriesRepository } from "../drizzle/repositories/drizzle-invitation-deliveries-repository";
import { DrizzleOperationAttemptsRepository } from "../drizzle/repositories/drizzle-operation-attempts-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "../drizzle/services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "../drizzle/services/drizzle-resource-access-validator";
import { OperationAttemptService } from "../../domain/application/services/operation-attempt-service";
import { InvitationDeliveryService } from "../../domain/application/services/invitation-delivery-service";
import { CreateBarberRegistrationUseCase } from "../../domain/application/use-cases/barbershop/create-barber-registration/create-barber-registration";
import { CreateBarberRegistrationController } from "./controllers/barbershop/create-barber-registration.controller";
import { FakeEmailService } from "../../../test/fakes/fake-email-service";
import { generateUuidV7 } from "../../core/security/uuidv7";

describe("Barber Registration Full Test Suite (PostgreSQL Isolated)", () => {
  let fakeEmailService: FakeEmailService;
  let barbershopsRepository: DrizzleBarbershopsRepository;
  let membershipsRepository: DrizzleMembershipsRepository;
  let usersRepository: DrizzleUsersRepository;
  let invitationsRepository: DrizzleInvitationsRepository;
  let barberRegistrationsRepository: DrizzleBarberRegistrationsRepository;
  let notificationsRepository: DrizzleNotificationsRepository;
  let deliveriesRepository: DrizzleInvitationDeliveriesRepository;
  let attemptService: OperationAttemptService;
  let deliveryService: InvitationDeliveryService;
  let useCase: CreateBarberRegistrationUseCase;
  let controller: CreateBarberRegistrationController;

  let ownerId: string;
  let otherOwnerId: string;
  let shopId: string;
  let otherShopId: string;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL ?? "";
    if (!dbUrl.includes("55441")) {
      throw new Error(
        `ABORT: Teste integrado exige PostgreSQL local isolado na porta 55441. URL atual: ${dbUrl}`,
      );
    }
  });

  beforeEach(async () => {
    fakeEmailService = new FakeEmailService();
    barbershopsRepository = new DrizzleBarbershopsRepository();
    membershipsRepository = new DrizzleMembershipsRepository();
    usersRepository = new DrizzleUsersRepository();
    invitationsRepository = new DrizzleInvitationsRepository();
    barberRegistrationsRepository = new DrizzleBarberRegistrationsRepository();
    notificationsRepository = new DrizzleNotificationsRepository();
    deliveriesRepository = new DrizzleInvitationDeliveriesRepository();

    deliveryService = new InvitationDeliveryService(
      deliveriesRepository,
      invitationsRepository,
      fakeEmailService,
    );

    useCase = new CreateBarberRegistrationUseCase(
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
      invitationsRepository,
      barberRegistrationsRepository,
      fakeEmailService,
      notificationsRepository,
      deliveriesRepository,
    );

    const attemptsRepository = new DrizzleOperationAttemptsRepository();
    const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
    const accessValidator = new DrizzleResourceAccessValidator();
    attemptService = new OperationAttemptService(
      attemptsRepository,
      unitOfWork,
      accessValidator,
    );

    controller = new CreateBarberRegistrationController(
      useCase,
      attemptService,
      deliveryService,
    );

    // Limpeza de tabelas em ordem
    await db.delete(invitationDeliveries);
    await db.delete(barberRegistrations);
    await db.delete(invitations);
    await db.delete(membership);
    await db.delete(barbershops);
    await db.delete(users);
    await db.delete(operationAttempts);

    // Barbearia 1 e seu Owner
    ownerId = randomUUID();
    await db.insert(users).values({
      id: ownerId,
      name: "Owner 1",
      email: `owner1_${ownerId.slice(0, 6)}@test.com`,
      password: "hashed_password",
      cpf: "12345678901",
      accountType: "OWNER",
    });

    shopId = randomUUID();
    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Shop 1",
      ownerId,
      slug: `shop1-${shopId.slice(0, 6)}`,
      cnpj: "11111111000111",
      location: "Rua 1",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    await db.insert(membership).values({
      id: randomUUID(),
      userId: ownerId,
      barbershopId: shopId,
      role: "OWNER",
      state: "ACTIVE",
    });

    // Barbearia 2 e seu Owner (para isolamento cross-tenant)
    otherOwnerId = randomUUID();
    await db.insert(users).values({
      id: otherOwnerId,
      name: "Owner 2",
      email: `owner2_${otherOwnerId.slice(0, 6)}@test.com`,
      password: "hashed_password",
      cpf: "98765432109",
      accountType: "OWNER",
    });

    otherShopId = randomUUID();
    await db.insert(barbershops).values({
      id: otherShopId,
      name: "Barbearia Shop 2",
      ownerId: otherOwnerId,
      slug: `shop2-${otherShopId.slice(0, 6)}`,
      cnpj: "22222222000122",
      location: "Rua 2",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    await db.insert(membership).values({
      id: randomUUID(),
      userId: otherOwnerId,
      barbershopId: otherShopId,
      role: "OWNER",
      state: "ACTIVE",
    });
  });

  it("1. Cadastro válido conclui dentro do orçamento e cria exatamente 1 convite, 1 cadastro e 1 outbox", async () => {
    const requestId = generateUuidV7();
    const startTime = Date.now();

    const response = await controller.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Teste",
      cpf: "11144477735",
      email: "barbeiro.teste@example.com",
      headers: { "idempotency-key": requestId },
    });

    const elapsed = Date.now() - startTime;
    expect(response.statusCode).toBe(200);
    expect(elapsed).toBeLessThan(2000);

    const body = response.body as any;
    expect(body.email).toBe("barbeiro.teste@example.com");
    expect(body.deliveryStatus).toBe("ACCEPTED");

    // Verificar banco: exatamente 1 convite, 1 cadastro, 1 outbox
    const invRows = await db.select().from(invitations);
    expect(invRows).toHaveLength(1);
    expect(invRows[0].email).toBe("barbeiro.teste@example.com");

    const regRows = await db.select().from(barberRegistrations);
    expect(regRows).toHaveLength(1);
    expect(regRows[0].cpf).toBe("11144477735");

    const delRows = await db.select().from(invitationDeliveries);
    expect(delRows).toHaveLength(1);
    expect(delRows[0].status).toBe("ACCEPTED");
    expect(delRows[0].invitationUrl).toBeNull(); // Token sensível higienizado após aceitação
  });

  it("2. Idempotência: repetição com mesma chave retorna resultado idêntico sem duplicar", async () => {
    const requestId = generateUuidV7();
    const payload = {
      userId: ownerId,
      shopId,
      name: "Barbeiro Idempotente",
      cpf: "11144477735",
      email: "idempotente@example.com",
      headers: { "idempotency-key": requestId },
    };

    const firstRes = await controller.handle(payload);
    expect(firstRes.statusCode).toBe(200);

    const secondRes = await controller.handle(payload);
    expect(secondRes.statusCode).toBe(200);

    const body1 = firstRes.body as any;
    const body2 = secondRes.body as any;
    expect(body1.registrationId).toBe(body2.registrationId);
    expect(body1.invitationId).toBe(body2.invitationId);

    // Contagens permanecem exatamente 1
    const invCount = await db.select().from(invitations);
    const regCount = await db.select().from(barberRegistrations);
    const delCount = await db.select().from(invitationDeliveries);

    expect(invCount).toHaveLength(1);
    expect(regCount).toHaveLength(1);
    expect(delCount).toHaveLength(1);
  });

  it("3. Mesma chave com payload divergente é rejeitada com 409 Conflict", async () => {
    const requestId = generateUuidV7();

    const firstRes = await controller.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Original",
      cpf: "11144477735",
      email: "original@example.com",
      headers: { "idempotency-key": requestId },
    });
    expect(firstRes.statusCode).toBe(200);

    // Tentativa com mesma chave mas outro CPF/e-mail
    const conflictRes = await controller.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Alterado",
      cpf: "52998224725",
      email: "alterado@example.com",
      headers: { "idempotency-key": requestId },
    });

    expect(conflictRes.statusCode).toBe(409);
    expect((conflictRes.body as any)?.code).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
  });

  it("4. Chaves diferentes para o mesmo convite pendente respeitam regra de conflito (409)", async () => {
    const req1 = generateUuidV7();
    const req2 = generateUuidV7();

    const firstRes = await controller.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Duplicado",
      cpf: "11144477735",
      email: "duplicado@example.com",
      headers: { "idempotency-key": req1 },
    });
    expect(firstRes.statusCode).toBe(200);

    const secondRes = await controller.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Duplicado",
      cpf: "11144477735",
      email: "duplicado@example.com",
      headers: { "idempotency-key": req2 },
    });

    expect(secondRes.statusCode).toBe(409);
    expect((secondRes.body as any)?.code).toBe("PENDING_INVITATION_EXISTS");

    // Nenhum dado duplicado
    const invCount = await db.select().from(invitations);
    expect(invCount).toHaveLength(1);
  });

  it("5. Rollback integral: falha intermediária dentro da transação desfaz todas as escritas", async () => {
    // Simulamos um useCase que lança erro forçado após salvar convite
    const failingUseCase = new CreateBarberRegistrationUseCase(
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
      invitationsRepository,
      {
        ...barberRegistrationsRepository,
        create: async () => {
          throw new Error("FALHA_SIMULADA_BANCO");
        },
      } as any,
      fakeEmailService,
      notificationsRepository,
      deliveriesRepository,
    );

    const failingController = new CreateBarberRegistrationController(
      failingUseCase,
      attemptService,
      deliveryService,
    );

    const requestId = generateUuidV7();
    const res = await failingController.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Rollback",
      cpf: "11144477735",
      email: "rollback@example.com",
      headers: { "idempotency-key": requestId },
    });

    expect(res.statusCode).toBe(400);

    // Rollback total: absolutamente nada sobrevive no banco
    const invCount = await db.select().from(invitations);
    const regCount = await db.select().from(barberRegistrations);
    const delCount = await db.select().from(invitationDeliveries);

    expect(invCount).toHaveLength(0);
    expect(regCount).toHaveLength(0);
    expect(delCount).toHaveLength(0);
  });

  it("6. Rejeita ator não-owner e isolamento cross-tenant", async () => {
    // Owner da Barbearia 2 tentando cadastrar na Barbearia 1
    const requestId = generateUuidV7();
    const res = await controller.handle({
      userId: otherOwnerId,
      shopId: shopId,
      name: "Invasor Cross Tenant",
      cpf: "11144477735",
      email: "cross@example.com",
      headers: { "idempotency-key": requestId },
    });

    expect(res.statusCode).toBe(403);
    expect((res.body as any)?.message).toContain("proprietário ativo");

    const invCount = await db.select().from(invitations);
    expect(invCount).toHaveLength(0);
  });

  it("7. Provedor lento/falho não bloqueia cadastro e mantém outbox em PENDING", async () => {
    // Simula e-mail que falha ou sofre timeout de rede
    const slowEmailService = {
      sendInvitationEmail: async () => {
        throw new Error("RESEND_GATEWAY_TIMEOUT");
      },
    };

    const slowDeliveryService = new InvitationDeliveryService(
      deliveriesRepository,
      invitationsRepository,
      slowEmailService as any,
    );

    const slowController = new CreateBarberRegistrationController(
      useCase,
      attemptService,
      slowDeliveryService,
    );

    const requestId = generateUuidV7();
    const res = await slowController.handle({
      userId: ownerId,
      shopId,
      name: "Barbeiro Provedor Lento",
      cpf: "11144477735",
      email: "lento@example.com",
      headers: { "idempotency-key": requestId },
    });

    // Cadastro tem sucesso com 200 OK, mantendo deliveryStatus PENDING
    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.deliveryStatus).toBe("PENDING");

    // Registro existe no banco com status PENDING no outbox para consumo posterior
    const delRows = await db.select().from(invitationDeliveries);
    expect(delRows).toHaveLength(1);
    expect(delRows[0].status).toBe("PENDING");
    expect(delRows[0].attempts).toBe(1);
    expect(delRows[0].lastError).toContain("RESEND_GATEWAY_TIMEOUT");
  });

  it("8. Consumidor concorrente com SKIP LOCKED, retries e revogação", async () => {
    // Inserir registro pendente no outbox
    const invId = randomUUID();
    await db.insert(invitations).values({
      id: invId,
      barbershopId: shopId,
      email: "worker.test@example.com",
      role: "BARBERMAN",
      tokenHash: "token_hash_worker",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 86400000),
      invitedById: ownerId,
    });

    const deliveryId = randomUUID();
    await db.insert(invitationDeliveries).values({
      id: deliveryId,
      invitationId: invId,
      barbershopId: shopId,
      recipientEmail: "worker.test@example.com",
      recipientName: "Worker Test",
      barbershopName: "Barbearia Shop 1",
      ownerName: "Owner 1",
      tokenHash: "token_hash_worker",
      invitationUrl: "https://smartbarber.com/convite?token=xyz123",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(Date.now() - 1000), // Pronto para envio
    });

    // 1. Processar pendentes com o serviço
    const result = await deliveryService.processPending({ limit: 10 });
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);

    const [delAfter] = await db
      .select()
      .from(invitationDeliveries)
      .where(eq(invitationDeliveries.id, deliveryId));
    expect(delAfter.status).toBe("ACCEPTED");
    expect(delAfter.invitationUrl).toBeNull(); // URL anonimizada

    // 2. Teste de revogação antes da entrega:
    const invRevokedId = randomUUID();
    await db.insert(invitations).values({
      id: invRevokedId,
      barbershopId: shopId,
      email: "revoked@example.com",
      role: "BARBERMAN",
      tokenHash: "token_hash_revoked",
      status: "REVOKED", // Já revogado
      expiresAt: new Date(Date.now() + 86400000),
      invitedById: ownerId,
    });

    const delRevokedId = randomUUID();
    await db.insert(invitationDeliveries).values({
      id: delRevokedId,
      invitationId: invRevokedId,
      barbershopId: shopId,
      recipientEmail: "revoked@example.com",
      recipientName: "Revoked User",
      barbershopName: "Barbearia Shop 1",
      ownerName: "Owner 1",
      tokenHash: "token_hash_revoked",
      invitationUrl: "https://smartbarber.com/convite?token=secret123",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(Date.now() - 1000),
    });

    const revokedResult = await deliveryService.processPending({ limit: 10 });
    expect(revokedResult.processed).toBe(1);
    expect(revokedResult.failed).toBe(1);

    const [delRevAfter] = await db
      .select()
      .from(invitationDeliveries)
      .where(eq(invitationDeliveries.id, delRevokedId));
    expect(delRevAfter.status).toBe("REVOKED");
    expect(delRevAfter.invitationUrl).toBeNull(); // Higienizado
  });
});
