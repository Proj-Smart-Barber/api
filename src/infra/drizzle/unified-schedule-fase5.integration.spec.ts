import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

// 1. Configuração do ambiente e banco isolado antes de qualquer import do Drizzle
process.env.DATABASE_URL =
  "postgresql://postgres:0gl2mrInoXN0p7yMTucjBxZPszmxoPB0@127.0.0.1:55441/sb_unified_fase5_test";

import { db } from "./index";
import {
  users,
  barbershops,
  membership,
  services,
  bookings,
  barbershopSchedules,
  barbershopScheduleScopes,
  scheduleExceptions,
} from "./schema";

import { DrizzleSchedulesRepository } from "./repositories/drizzle-schedules-repository";
import { DrizzleScheduleExceptionsRepository } from "./repositories/drizzle-schedule-exceptions-repository";
import { DrizzleBarbershopsRepository } from "./repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "./repositories/drizzle-memberships-repository";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { DrizzleServicesRepository } from "./repositories/drizzle-services-repository";
import { DrizzleOperationAttemptsRepository } from "./repositories/drizzle-operation-attempts-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "./services/drizzle-professional-membership-unit-of-work";
import { DrizzleResourceAccessValidator } from "./services/drizzle-resource-access-validator";

import { OperationAttemptService } from "../../domain/application/services/operation-attempt-service";
import { UpdateBarbershopScheduleUseCase } from "../../domain/application/use-cases/schedule/update-barbershop-schedule/update-barbershop-schedule";
import { FetchBarbershopSchedulesUseCase } from "../../domain/application/use-cases/schedule/fetch-barbershop-schedules/fetch-barbershop-schedules";
import { CreateScheduleExceptionUseCase } from "../../domain/application/use-cases/schedule/create-schedule-exception/create-schedule-exception";
import { CalculateAvailabilityUseCase } from "../../domain/application/use-cases/schedule/calculate-availability/calculate-availability";

import { generateUuidV7 } from "../../core/security/uuidv7";
import { NotAllowedError } from "../../domain/application/use-cases/_errors/not-allowed-error";
import { ScheduleBookingConflictError } from "../../domain/application/use-cases/_errors/schedule-booking-conflict-error";
import { ScheduleVersionConflictError } from "../../domain/application/use-cases/_errors/schedule-version-conflict-error";
import { EffectiveScheduleResolver } from "../../domain/application/services/effective-schedule-resolver";

describe("Fase 5 — Validação Integrada em PostgreSQL Local (Isolamento e Regras de Negócio)", () => {
  let schedulesRepo: DrizzleSchedulesRepository;
  let exceptionsRepo: DrizzleScheduleExceptionsRepository;
  let shopsRepo: DrizzleBarbershopsRepository;
  let membershipsRepo: DrizzleMembershipsRepository;
  let bookingsRepo: DrizzleBookingsRepository;
  let servicesRepo: DrizzleServicesRepository;
  let operationAttemptService: OperationAttemptService;

  let updateScheduleUseCase: UpdateBarbershopScheduleUseCase;
  let fetchSchedulesUseCase: FetchBarbershopSchedulesUseCase;
  let createExceptionUseCase: CreateScheduleExceptionUseCase;
  let calculateAvailabilityUseCase: CalculateAvailabilityUseCase;

  const shopId = randomUUID();
  const ownerId = randomUUID();
  const barberAId = randomUUID();
  const barberBId = randomUUID();
  const barberCId = randomUUID();
  const customerId = randomUUID();
  const serviceId = randomUUID();

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();

  beforeAll(async () => {
    // Validação estrita de isolamento loopback
    expect(process.env.DATABASE_URL).toContain("127.0.0.1");
    expect(process.env.DATABASE_URL).toContain("sb_unified_fase5_test");

    // Instancia repositórios e serviços reais
    schedulesRepo = new DrizzleSchedulesRepository();
    exceptionsRepo = new DrizzleScheduleExceptionsRepository();
    shopsRepo = new DrizzleBarbershopsRepository();
    membershipsRepo = new DrizzleMembershipsRepository();
    bookingsRepo = new DrizzleBookingsRepository();
    servicesRepo = new DrizzleServicesRepository();

    const attemptsRepo = new DrizzleOperationAttemptsRepository();
    const unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();
    const accessValidator = new DrizzleResourceAccessValidator();

    operationAttemptService = new OperationAttemptService(
      attemptsRepo,
      unitOfWork,
      accessValidator,
    );

    updateScheduleUseCase = new UpdateBarbershopScheduleUseCase(
      schedulesRepo,
      shopsRepo,
      unitOfWork,
      membershipsRepo,
      bookingsRepo,
      operationAttemptService,
    );

    fetchSchedulesUseCase = new FetchBarbershopSchedulesUseCase(schedulesRepo);

    createExceptionUseCase = new CreateScheduleExceptionUseCase(
      exceptionsRepo,
      shopsRepo,
      unitOfWork,
      membershipsRepo,
      bookingsRepo,
    );

    calculateAvailabilityUseCase = new CalculateAvailabilityUseCase(
      schedulesRepo,
      exceptionsRepo,
      servicesRepo,
      bookingsRepo,
      shopsRepo,
      () => new Date("2026-11-01T00:00:00Z"),
    );

    // Setup de Entidades em PostgreSQL
    await db.insert(users).values([
      {
        id: ownerId,
        name: "Proprietário Silva",
        email: `owner_${ownerId.slice(0, 8)}@test.com`,
        password: "hashed_password",
        cpf: randomCpf(),
        accountType: "OWNER",
      },
      {
        id: barberAId,
        name: "Carlos Barbeiro A",
        email: `barber_a_${barberAId.slice(0, 8)}@test.com`,
        password: "hashed_password",
        cpf: randomCpf(),
        accountType: "BARBER",
      },
      {
        id: barberBId,
        name: "Marcos Barbeiro B",
        email: `barber_b_${barberBId.slice(0, 8)}@test.com`,
        password: "hashed_password",
        cpf: randomCpf(),
        accountType: "BARBER",
      },
      {
        id: barberCId,
        name: "João Barbeiro C",
        email: `barber_c_${barberCId.slice(0, 8)}@test.com`,
        password: "hashed_password",
        cpf: randomCpf(),
        accountType: "BARBER",
      },
      {
        id: customerId,
        name: "Cliente Teste",
        email: `client_${customerId.slice(0, 8)}@test.com`,
        password: "hashed_password",
        cpf: randomCpf(),
        accountType: "CLIENT",
      },
    ]);

    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Canônica Teste",
      ownerId,
      slug: `barbearia-teste-${shopId.slice(0, 8)}`,
      cnpj: randomCpf() + "0001",
      location: "Avenida Principal, 1000",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    await db.insert(membership).values([
      {
        barbershopId: shopId,
        userId: ownerId,
        role: "OWNER",
        state: "ACTIVE",
      },
      {
        barbershopId: shopId,
        userId: barberAId,
        role: "BARBERMAN",
        state: "ACTIVE",
      },
      {
        barbershopId: shopId,
        userId: barberBId,
        role: "BARBERMAN",
        state: "ACTIVE",
      },
      {
        barbershopId: shopId,
        userId: barberCId,
        role: "BARBERMAN",
        state: "ACTIVE",
      },
    ]);

    await db.insert(services).values({
      id: serviceId,
      barbershopId: shopId,
      title: "Corte Tradicional",
      priceInCents: 5000,
      durationInMinutes: 30,
      isActive: true,
    });
  });

  afterAll(async () => {
    // Limpeza de recursos descartáveis criados no PostgreSQL
    await db.delete(bookings).where(eq(bookings.barbershopId, shopId));
    await db.delete(scheduleExceptions).where(eq(scheduleExceptions.barbershopId, shopId));
    await db.delete(barbershopSchedules).where(eq(barbershopSchedules.barbershopId, shopId));
    await db.delete(barbershopScheduleScopes).where(eq(barbershopScheduleScopes.barbershopId, shopId));
    await db.delete(services).where(eq(services.barbershopId, shopId));
    await db.delete(membership).where(eq(membership.barbershopId, shopId));
    await db.delete(barbershops).where(eq(barbershops.id, shopId));
  });

  describe("Cenários Integrados 1 e 2: Configuração, Gravação e Releitura de Horários", () => {
    it("1. Configura geral da unidade e grade CUSTOM diferente para dois profissionais", async () => {
      // 1.1 Owner configura horário geral da unidade: Segunda das 09:00 às 18:00
      const generalRes = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: null,
        createdBy: ownerId,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "18:00" },
        ],
      });
      expect(generalRes.isRight()).toBe(true);

      // 1.2 Barbeiro A configura CUSTOM próprio: Segunda das 07:00 às 14:00 (abre antes do geral)
      const barberARes = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberAId,
        createdBy: barberAId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "07:00", closeTime: "14:00" },
        ],
      });
      expect(barberARes.isRight()).toBe(true);

      // 1.3 Barbeiro B configura CUSTOM próprio: Segunda das 12:00 às 21:00 (estende além do geral)
      const barberBRes = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberBId,
        createdBy: barberBId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "12:00", closeTime: "21:00" },
        ],
      });
      expect(barberBRes.isRight()).toBe(true);
    });

    it("2. Salva e relê horários pelo Owner e pelos respectivos profissionais com integridade", async () => {
      // Releitura direta do repositório Drizzle (PostgreSQL)
      const allSchedules = await schedulesRepo.findManyByBarbershopId(shopId);

      const persistedGeneral = allSchedules.filter((s) => s.barbermanId === null);
      expect(persistedGeneral).toHaveLength(1);
      expect(persistedGeneral[0].openTime).toBe("09:00");
      expect(persistedGeneral[0].closeTime).toBe("18:00");

      const persistedA = allSchedules.filter((s) => s.barbermanId?.toString() === barberAId);
      expect(persistedA).toHaveLength(1);
      expect(persistedA[0].openTime).toBe("07:00");
      expect(persistedA[0].closeTime).toBe("14:00");

      const persistedB = allSchedules.filter((s) => s.barbermanId?.toString() === barberBId);
      expect(persistedB).toHaveLength(1);
      expect(persistedB[0].openTime).toBe("12:00");
      expect(persistedB[0].closeTime).toBe("21:00");

      // Consulta de escopo persistido
      const scopeA = await schedulesRepo.findScope(shopId, barberAId);
      expect(scopeA).not.toBeNull();
      expect(scopeA?.state).toBe("CUSTOM");
      expect(scopeA?.version).toBeGreaterThanOrEqual(1);

      const scopeB = await schedulesRepo.findScope(shopId, barberBId);
      expect(scopeB).not.toBeNull();
      expect(scopeB?.state).toBe("CUSTOM");
    });
  });

  describe("Cenário 3: Consulta de Slots e Reserva em Horário CUSTOM Fora do Geral", () => {
    it("permite agendamento para Barbeiro A às 07:30 (fora do horário geral da loja 09:00-18:00)", async () => {
      // Data de teste: Segunda-feira 2026-11-16
      const testDate = "2026-11-16";

      // 3.1 Consulta de slots disponíveis para o Barbeiro A
      const availabilityBefore = await calculateAvailabilityUseCase.execute({
        barbershopId: shopId,
        date: testDate,
        serviceIds: [serviceId],
        barbermanId: barberAId,
      });

      expect(availabilityBefore.isRight()).toBe(true);
      if (availabilityBefore.isRight()) {
        const slots = availabilityBefore.value.availableSlots.map((s) => s.start);
        // Deve ofertar horários antes das 09:00 devido à grade CUSTOM (07:00 às 14:00)
        expect(slots.some((s) => s.includes("07:00:00"))).toBe(true);
        expect(slots.some((s) => s.includes("07:30:00"))).toBe(true);
        expect(slots.some((s) => s.includes("08:00:00"))).toBe(true);
        expect(slots.some((s) => s.includes("08:30:00"))).toBe(true);
        // Não deve ofertar horários após as 14:00
        expect(slots.some((s) => s.includes("15:00:00"))).toBe(false);
      }

      // 3.2 Criação de reserva real no PostgreSQL no slot 07:30 - 08:00
      const bookingId = randomUUID();
      await db.insert(bookings).values({
        id: bookingId,
        barbershopId: shopId,
        barbermanId: barberAId,
        customerId,
        date: new Date("2026-11-16T10:30:00Z"), // 07:30 BRT
        startsAt: new Date("2026-11-16T10:30:00Z"),
        endsAt: new Date("2026-11-16T11:00:00Z"),
        startTime: "07:30",
        endTime: "08:00",
        timezone: "America/Sao_Paulo",
        status: "CONFIRMED",
        totalPriceInCents: 5000,
        totalDurationInMinutes: 30,
      });

      // 3.3 Recalcula disponibilidade: slot 07:30 deve ter sido consumido
      const availabilityAfter = await calculateAvailabilityUseCase.execute({
        barbershopId: shopId,
        date: testDate,
        serviceIds: [serviceId],
        barbermanId: barberAId,
      });

      expect(availabilityAfter.isRight()).toBe(true);
      if (availabilityAfter.isRight()) {
        const slots = availabilityAfter.value.availableSlots.map((s) => s.start);
        expect(slots.some((s) => s.includes("07:30:00"))).toBe(false);
        expect(slots.some((s) => s.includes("07:00:00"))).toBe(true);
        expect(slots.some((s) => s.includes("08:00:00"))).toBe(true);
      }
    });
  });

  describe("Cenário 4: Reatividade de INHERIT vs Preservação Estrita de CUSTOM", () => {
    it("alteração da regra geral da unidade reage em INHERIT e não afeta CUSTOM", async () => {
      // 4.1 Barbeiro C está configurado com INHERIT
      await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberCId,
        createdBy: ownerId,
        state: "INHERIT",
        schedules: [],
      });

      // 4.2 Owner altera o expediente geral da barbearia para 10:00 às 17:00
      const updateGeneralRes = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: null,
        createdBy: ownerId,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "17:00" },
        ],
      });
      expect(updateGeneralRes.isRight()).toBe(true);

      // 4.3 Consulta e resolução de escala para Barbeiro C (INHERIT): reflete imediatamente 10:00 - 17:00
      const allSchedules = await schedulesRepo.findManyByBarbershopId(shopId);
      const effectiveC = EffectiveScheduleResolver.resolveEffectiveDayIntervals({
        dayOfWeek: "MONDAY",
        allSchedules,
        barbermanId: barberCId,
        scopeState: "INHERIT",
        generalScopeState: "CUSTOM",
      });
      expect(effectiveC.intervals).toEqual([
        { openTime: "10:00", closeTime: "17:00" },
      ]);

      // 4.4 Barbeiro A e B (CUSTOM): permanecem rigorosamente inalterados
      const effectiveA = EffectiveScheduleResolver.resolveEffectiveDayIntervals({
        dayOfWeek: "MONDAY",
        allSchedules,
        barbermanId: barberAId,
        scopeState: "CUSTOM",
        generalScopeState: "CUSTOM",
      });
      expect(effectiveA.intervals).toEqual([
        { openTime: "07:00", closeTime: "14:00" },
      ]);

      const effectiveB = EffectiveScheduleResolver.resolveEffectiveDayIntervals({
        dayOfWeek: "MONDAY",
        allSchedules,
        barbermanId: barberBId,
        scopeState: "CUSTOM",
        generalScopeState: "CUSTOM",
      });
      expect(effectiveB.intervals).toEqual([
        { openTime: "12:00", closeTime: "21:00" },
      ]);
    });
  });

  describe("Cenário 5: Folga Individual, Bloqueio Parcial e Fechamento Excepcional Geral", () => {
    it("bloqueio parcial remove apenas intervalo atingido e folga de dia inteiro bloqueia o dia", async () => {
      // 5.1 Barbeiro A cria bloqueio parcial das 10:00 às 12:00 em 2026-11-23
      const partialBlockRes = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        barbermanId: barberAId,
        date: "2026-11-23",
        startTime: "10:00",
        endTime: "12:00",
        reason: "Consulta Odontológica",
      });
      expect(partialBlockRes.isRight()).toBe(true);

      // Consulta slots do Barbeiro A: 07:00-10:00 e 12:00-14:00 disponíveis; 10:00-12:00 bloqueados
      const slotsA = await calculateAvailabilityUseCase.execute({
        barbershopId: shopId,
        date: "2026-11-23",
        serviceIds: [serviceId],
        barbermanId: barberAId,
      });
      expect(slotsA.isRight()).toBe(true);
      if (slotsA.isRight()) {
        const slots = slotsA.value.availableSlots.map((s) => s.start);
        expect(slots.some((s) => s.includes("07:00:00"))).toBe(true);
        expect(slots.some((s) => s.includes("09:30:00"))).toBe(true);
        expect(slots.some((s) => s.includes("10:00:00"))).toBe(false);
        expect(slots.some((s) => s.includes("11:30:00"))).toBe(false);
        expect(slots.some((s) => s.includes("12:00:00"))).toBe(true);
      }

      // 5.2 Barbeiro B registra folga de dia inteiro em 2026-11-23
      const fullDayOffRes = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberBId,
        barbermanId: barberBId,
        date: "2026-11-23",
        startTime: null,
        endTime: null,
        reason: "Folga Pessoal",
      });
      expect(fullDayOffRes.isRight()).toBe(true);

      const slotsB = await calculateAvailabilityUseCase.execute({
        barbershopId: shopId,
        date: "2026-11-23",
        serviceIds: [serviceId],
        barbermanId: barberBId,
      });
      expect(slotsB.isRight()).toBe(true);
      if (slotsB.isRight()) {
        expect(slotsB.value.availableSlots).toEqual([]);
      }

      // 5.3 Owner cria fechamento excepcional geral da unidade em 2026-11-30 (feriado local)
      const holidayRes = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: ownerId,
        barbermanId: null,
        date: "2026-11-30",
        startTime: null,
        endTime: null,
        reason: "Feriado Municipal",
      });
      expect(holidayRes.isRight()).toBe(true);

      // Barbeiro C (INHERIT) não tem slots no dia do fechamento geral
      const slotsC = await calculateAvailabilityUseCase.execute({
        barbershopId: shopId,
        date: "2026-11-30",
        serviceIds: [serviceId],
        barbermanId: barberCId,
      });
      expect(slotsC.isRight()).toBe(true);
      if (slotsC.isRight()) {
        expect(slotsC.value.availableSlots).toEqual([]);
      }
    });
  });

  describe("Cenário 6: Isolamento, Conflito com Reserva, Versão, Idempotência e Rollback", () => {
    it("impede barbeiro de alterar colega (isolamento de autoridade)", async () => {
      const res = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberBId,
        createdBy: barberAId,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "12:00" },
        ],
      });
      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(NotAllowedError);
      }
    });

    it("bloqueia folga quando existe reserva confirmada no dia (conflito com reservas)", async () => {
      // Barbeiro A tem reserva em 2026-11-16 às 07:30
      const activeBookings = await bookingsRepo.findActiveAndFutureBookings({
        barbershopId: shopId,
        barbermanId: barberAId,
      });

      const conflictRes = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        barbermanId: barberAId,
        date: "2026-11-16",
        startTime: null,
        endTime: null,
        reason: "Tentativa de folga sobre agendamento",
      });

      if (conflictRes.isRight()) {
        process.stderr.write(`\n>>> DEBUG activeBookings count: ${activeBookings.length}\n`);
        if (activeBookings.length > 0) {
          process.stderr.write(`>>> booking startsAt: ${activeBookings[0].startsAt?.toISOString()}, status: ${activeBookings[0].status}\n`);
        }
        process.stderr.write(`>>> exception created: ${JSON.stringify(conflictRes.value)}\n`);
      }

      expect(conflictRes.isLeft()).toBe(true);
      if (conflictRes.isLeft()) {
        expect(conflictRes.value).toBeInstanceOf(ScheduleBookingConflictError);
      }
    });

    it("detecta concorrência e rejeita expectedVersion desatualizado", async () => {
      const currentScope = await schedulesRepo.findScope(shopId, barberAId);
      expect(currentScope).not.toBeNull();
      const wrongVersion = (currentScope?.version ?? 1) + 99;

      const res = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberAId,
        createdBy: barberAId,
        state: "CUSTOM",
        expectedVersion: wrongVersion,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "07:00", closeTime: "14:00" },
        ],
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(ScheduleVersionConflictError);
      }
    });

    it("garante idempotência em requisição com mesmo requestId e payload", async () => {
      const currentScope = await schedulesRepo.findScope(shopId, barberAId);
      const version = currentScope?.version ?? 1;
      const idempotencyKey = generateUuidV7();

      const payload = {
        barbershopId: shopId,
        barbermanId: barberAId,
        createdBy: barberAId,
        state: "CUSTOM" as const,
        expectedVersion: version,
        requestId: idempotencyKey,
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "07:00", closeTime: "15:00" },
        ],
      };

      // 1ª execução
      const firstRun = await updateScheduleUseCase.execute(payload);
      expect(firstRun.isRight()).toBe(true);

      // 2ª execução com exatamente o mesmo requestId e payload
      const secondRun = await updateScheduleUseCase.execute(payload);
      expect(secondRun.isRight()).toBe(true);

      // Não deve ter duplicado linhas na tabela barbershop_schedules
      const allSchedules = await schedulesRepo.findManyByBarbershopId(shopId);
      const totalSchedules = allSchedules.filter((s) => s.barbermanId?.toString() === barberAId);
      expect(totalSchedules).toHaveLength(1);
      expect(totalSchedules[0].openTime).toBe("07:00");
      expect(totalSchedules[0].closeTime).toBe("15:00");
    });
  });
});
