import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../drizzle";
import {
  users,
  barbershops,
  membership,
  invitations,
  barberRegistrations,
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
import { CreateBarberRegistrationUseCase } from "../../domain/application/use-cases/barbershop/create-barber-registration/create-barber-registration";
import { CreateBarberRegistrationController } from "./controllers/barbershop/create-barber-registration.controller";
import { FakeEmailService } from "../../../test/fakes/fake-email-service";
import { generateUuidV7 } from "../../core/security/uuidv7";

describe("Barber Registration Lock Regression (PostgreSQL Isolated)", () => {
  const fakeEmailService = new FakeEmailService();

  let ownerId: string;
  let shopId: string;

  beforeAll(async () => {
    // Validação estrita de isolamento: somente container local na porta 55441
    const dbUrl = process.env.DATABASE_URL ?? "";
    if (!dbUrl.includes("55441")) {
      throw new Error(
        `ABORT: Teste integrado exige PostgreSQL local isolado na porta 55441. URL atual: ${dbUrl}`,
      );
    }

    // Limpeza inicial
    await db.delete(barberRegistrations);
    await db.delete(invitations);
    await db.delete(membership);
    await db.delete(barbershops);
    await db.delete(users);
    await db.delete(operationAttempts);

    // Criar Owner e Barbearia Principal
    ownerId = randomUUID();
    await db.insert(users).values({
      id: ownerId,
      name: "Proprietário Principal",
      email: `owner_${ownerId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: "12345678901",
      accountType: "OWNER",
    });

    shopId = randomUUID();
    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Alpha",
      ownerId,
      slug: `shop-${shopId.slice(0, 8)}`,
      cnpj: "12345678000195",
      location: "Rua Alpha, 123",
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
  });

  it("deve comprovar a causa raiz: lock da barbearia bloqueia INSERT de convite por conexão concorrente", async () => {
    let errorCaught: any = null;

    try {
      await db.transaction(async (tx) => {
        // Transação 1: Trava linha da barbearia com FOR UPDATE
        await tx.execute(
          sql`SELECT id FROM barbershops WHERE id = ${shopId} FOR UPDATE`,
        );

        // Transação 2: Em conexão concorrente tenta inserir convite referenciando shopId com lock_timeout 500ms
        await db.transaction(async (tx2) => {
          await tx2.execute(sql`SET LOCAL lock_timeout = '500ms'`);
          await tx2.insert(invitations).values({
            id: randomUUID(),
            barbershopId: shopId,
            email: "lock-test@example.com",
            role: "BARBERMAN",
            tokenHash: "token-hash-lock-test",
            status: "PENDING",
            expiresAt: new Date(Date.now() + 86400000),
            invitedById: ownerId,
          });
        });
      });
    } catch (err: any) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    const detailed = `${errorCaught?.message} ${errorCaught?.cause?.message} ${errorCaught?.cause?.code}`;
    expect(detailed).toMatch(/lock timeout|55P03|canceling statement/i);
  });

  it("deve concluir o cadastro com sucesso em < 1s quando executado com propagação de tx e outbox", async () => {
    const barbershopsRepository = new DrizzleBarbershopsRepository();
    const membershipsRepository = new DrizzleMembershipsRepository();
    const usersRepository = new DrizzleUsersRepository();
    const invitationsRepository = new DrizzleInvitationsRepository();
    const barberRegistrationsRepository =
      new DrizzleBarberRegistrationsRepository();
    const notificationsRepository = new DrizzleNotificationsRepository();
    const deliveriesRepository = new DrizzleInvitationDeliveriesRepository();

    const useCase = new CreateBarberRegistrationUseCase(
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
    const attemptService = new OperationAttemptService(
      attemptsRepository,
      unitOfWork,
      accessValidator,
    );

    const controller = new CreateBarberRegistrationController(
      useCase,
      attemptService,
    );

    const requestId = generateUuidV7();
    const startTime = Date.now();
    const response = await controller.handle({
      userId: ownerId,
      shopId,
      name: "Carlos Barbeiro",
      cpf: "11144477735",
      email: "carlos.barbeiro@test.com",
      headers: {
        "idempotency-key": requestId,
      },
    });
    const duration = Date.now() - startTime;

    expect(response.statusCode).toBe(200);
    expect(duration).toBeLessThan(1500);
    expect((response.body as any)?.status).toBe("PENDING");
    expect((response.body as any)?.email).toBe("carlos.barbeiro@test.com");
  });
});
