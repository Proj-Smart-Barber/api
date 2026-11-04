import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryScheduleExceptionsRepository } from "../../../../../../test/repositories/in-memory-schedule-exceptions-repository";
import { UpdateBarbershopScheduleUseCase } from "./update-barbershop-schedule";
import { CreateScheduleExceptionUseCase } from "../create-schedule-exception/create-schedule-exception";
import { UpdateScheduleExceptionUseCase } from "../update-schedule-exception/update-schedule-exception";
import { DeleteScheduleExceptionUseCase } from "../delete-schedule-exception/delete-schedule-exception";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { BarbershopSchedule } from "../../../../enterprise/entities/barbershop-schedule";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { Booking } from "../../../../enterprise/entities/booking";
import { ScheduleException } from "../../../../enterprise/entities/schedule-exception";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { generateUuidV7 } from "../../../../../core/security/uuidv7";
import { EffectiveScheduleResolver } from "../../../services/effective-schedule-resolver";
import { ScheduleBookingConflictError } from "../../_errors/schedule-booking-conflict-error";
import { NotAllowedError } from "../../_errors/not-allowed-error";

describe("Auditoria de Autonomia da Grade e Folgas do Barbeiro", () => {
  let schedulesRepo: InMemorySchedulesRepository;
  let shopsRepo: InMemoryBarbershopsRepository;
  let membershipsRepo: InMemoryMembershipsRepository;
  let bookingsRepo: InMemoryBookingsRepository;
  let exceptionsRepo: InMemoryScheduleExceptionsRepository;

  let updateScheduleUseCase: UpdateBarbershopScheduleUseCase;
  let createExceptionUseCase: CreateScheduleExceptionUseCase;
  let updateExceptionUseCase: UpdateScheduleExceptionUseCase;
  let deleteExceptionUseCase: DeleteScheduleExceptionUseCase;

  const shopId = "shop-test";
  const ownerId = "owner-id";
  const barberAId = "barber-a";
  const barberBId = "barber-b";

  beforeEach(async () => {
    schedulesRepo = new InMemorySchedulesRepository();
    shopsRepo = new InMemoryBarbershopsRepository();
    membershipsRepo = new InMemoryMembershipsRepository();
    bookingsRepo = new InMemoryBookingsRepository();
    exceptionsRepo = new InMemoryScheduleExceptionsRepository();

    shopsRepo.items.push(
      Barbershop.create(
        {
          name: "Barbearia Autônoma",
          slug: Slug.create("barbearia-autonoma"),
          timezone: "America/Sao_Paulo",
          ownerId: new UniqueEntityId(ownerId),
          status: "ACTIVE",
          cnpj: "12345678000190",
          location: "Rua Teste, 100",
        },
        new UniqueEntityId(shopId),
      ),
    );

    await membershipsRepo.create(
      Membership.create({
        barbershopId: new UniqueEntityId(shopId),
        userId: new UniqueEntityId(ownerId),
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    await membershipsRepo.create(
      Membership.create({
        barbershopId: new UniqueEntityId(shopId),
        userId: new UniqueEntityId(barberAId),
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    await membershipsRepo.create(
      Membership.create({
        barbershopId: new UniqueEntityId(shopId),
        userId: new UniqueEntityId(barberBId),
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    updateScheduleUseCase = new UpdateBarbershopScheduleUseCase(
      schedulesRepo,
      shopsRepo,
      undefined,
      membershipsRepo,
      bookingsRepo,
    );

    createExceptionUseCase = new CreateScheduleExceptionUseCase(
      exceptionsRepo,
      shopsRepo,
      undefined,
      membershipsRepo,
      bookingsRepo,
    );

    updateExceptionUseCase = new UpdateScheduleExceptionUseCase(
      exceptionsRepo,
      shopsRepo,
      undefined,
      membershipsRepo,
      bookingsRepo,
    );

    deleteExceptionUseCase = new DeleteScheduleExceptionUseCase(
      exceptionsRepo,
      shopsRepo,
      undefined,
      membershipsRepo,
    );
  });

  describe("1. Grade Semanal Individual", () => {
    it("barbeiro ativo edita exclusivamente sua própria grade", async () => {
      const res = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberAId,
        createdBy: barberAId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "18:00" },
        ],
      });

      expect(res.isRight()).toBe(true);
      if (res.isRight()) {
        expect(res.value.schedules).toHaveLength(1);
        expect(res.value.schedules[0].openTime).toBe("09:00");
      }
    });

    it("barbeiro ativo não pode alterar grade do colega", async () => {
      const res = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberBId,
        createdBy: barberAId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "18:00" },
        ],
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(NotAllowedError);
      }
    });

    it("grade própria independe dos limites de funcionamento geral do owner (antes ou depois)", async () => {
      // Owner define 09:00 as 17:00
      await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: null,
        createdBy: ownerId,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });

      // Barbeiro define 07:00 as 21:00
      const res = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberAId,
        createdBy: barberAId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "07:00", closeTime: "21:00" },
        ],
      });

      expect(res.isRight()).toBe(true);
      if (res.isRight()) {
        expect(res.value.schedules[0].openTime).toBe("07:00");
        expect(res.value.schedules[0].closeTime).toBe("21:00");
      }
    });

    it("grade individual pode ser criada sem horário geral configurado na barbearia", async () => {
      const res = await updateScheduleUseCase.execute({
        barbershopId: shopId,
        barbermanId: barberAId,
        createdBy: barberAId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "TUESDAY", openTime: "08:00", closeTime: "12:00" },
        ],
      });

      expect(res.isRight()).toBe(true);
    });

    it("CUSTOM continua integralmente efetivo mesmo quando a unidade geral está CLOSED", () => {
      const barberShift = BarbershopSchedule.create({
        barbershopId: new UniqueEntityId(shopId),
        barbermanId: new UniqueEntityId(barberAId),
        createdBy: new UniqueEntityId(barberAId),
        dayOfWeek: "WEDNESDAY",
        openTime: "10:00",
        closeTime: "19:00",
      });

      const effective = EffectiveScheduleResolver.resolveEffectiveDayIntervals({
        dayOfWeek: "WEDNESDAY",
        allSchedules: [barberShift],
        barbermanId: barberAId,
        scopeState: "CUSTOM",
        generalScopeState: "CLOSED",
      });

      expect(effective.intervals).toEqual([
        { openTime: "10:00", closeTime: "19:00" },
      ]);
    });
  });

  describe("2. Gerenciamento das Próprias Folgas e Exceções (Create / Update / Delete)", () => {
    it("barbeiro ativo cadastra sua própria folga de dia inteiro", async () => {
      const res = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        barbermanId: barberAId,
        date: "2026-11-20",
        startTime: null,
        endTime: null,
        reason: "Folga pessoal planejada",
      });

      expect(res.isRight()).toBe(true);
      if (res.isRight()) {
        expect(res.value.exception.barbermanId?.toString()).toBe(barberAId);
        expect(res.value.exception.startTime).toBeNull();
        expect(res.value.exception.endTime).toBeNull();
        expect(res.value.exception.reason).toBe("Folga pessoal planejada");
      }
    });

    it("barbeiro ativo cadastra exceção parcial (intervalo de horário próprio)", async () => {
      const res = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        barbermanId: barberAId,
        date: "2026-11-21",
        startTime: "14:00",
        endTime: "16:00",
        reason: "Consulta médica",
      });

      expect(res.isRight()).toBe(true);
      if (res.isRight()) {
        expect(res.value.exception.startTime).toBe("14:00");
        expect(res.value.exception.endTime).toBe("16:00");
      }
    });

    it("barbeiro não pode criar exceção para outro profissional", async () => {
      const res = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        barbermanId: barberBId,
        date: "2026-11-22",
        reason: "Tentativa indevida",
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(NotAllowedError);
      }
    });

    it("omissão de barbermanId por barbeiro é automaticamente encapsulada para o próprio staffId", async () => {
      const res = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        date: "2026-11-23",
        reason: "Folga sem barbermanId explícito",
      });

      expect(res.isRight()).toBe(true);
      if (res.isRight()) {
        expect(res.value.exception.barbermanId?.toString()).toBe(barberAId);
      }
    });

    it("bloqueia criação de folga se houver agendamento confirmado no período", async () => {
      // Cria reserva confirmada no dia 2026-11-25 das 10:00 as 10:30 (-03:00)
      const booking = Booking.create({
        barbershopId: new UniqueEntityId(shopId),
        barbermanId: new UniqueEntityId(barberAId),
        customerId: new UniqueEntityId("client-1"),
        startsAt: new Date("2026-11-25T13:00:00Z"), // 10:00 em SP
        endsAt: new Date("2026-11-25T13:30:00Z"), // 10:30 em SP
        status: "CONFIRMED",
        totalPriceInCents: 5000,
        totalDurationInMinutes: 30,
      });
      await bookingsRepo.create(booking);

      // Barbeiro tenta criar folga no dia inteiro 2026-11-25
      const res = await createExceptionUseCase.execute({
        barbershopId: shopId,
        staffId: barberAId,
        barbermanId: barberAId,
        date: "2026-11-25",
        startTime: null,
        endTime: null,
        reason: "Folga de dia com agendamento",
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(ScheduleBookingConflictError);
      }
    });

    it("barbeiro atualiza com sucesso sua própria exceção", async () => {
      const exception = ScheduleException.create(
        {
          barbershopId: new UniqueEntityId(shopId),
          barbermanId: new UniqueEntityId(barberAId),
          date: new Date("2026-11-26"),
          startTime: "13:00",
          endTime: "15:00",
          reason: "Dentista",
        },
        new UniqueEntityId("exc-a"),
      );
      exceptionsRepo.items.push(exception);

      const res = await updateExceptionUseCase.execute({
        barbershopId: shopId,
        exceptionId: "exc-a",
        staffId: barberAId,
        startTime: "14:00",
        endTime: "16:00",
        reason: "Dentista remarcado",
      });

      expect(res.isRight()).toBe(true);
      if (res.isRight()) {
        expect(res.value.scheduleException.startTime).toBe("14:00");
        expect(res.value.scheduleException.endTime).toBe("16:00");
        expect(res.value.scheduleException.reason).toBe("Dentista remarcado");
      }
    });

    it("barbeiro é impedido de atualizar exceção de colega ou exceção geral", async () => {
      const excColleague = ScheduleException.create(
        {
          barbershopId: new UniqueEntityId(shopId),
          barbermanId: new UniqueEntityId(barberBId),
          date: new Date("2026-11-27"),
          reason: "Folga do colega B",
        },
        new UniqueEntityId("exc-b"),
      );
      exceptionsRepo.items.push(excColleague);

      const res = await updateExceptionUseCase.execute({
        barbershopId: shopId,
        exceptionId: "exc-b",
        staffId: barberAId,
        reason: "Alterando colega",
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(NotAllowedError);
      }
    });

    it("barbeiro exclui com sucesso sua própria exceção", async () => {
      const exception = ScheduleException.create(
        {
          barbershopId: new UniqueEntityId(shopId),
          barbermanId: new UniqueEntityId(barberAId),
          date: new Date("2026-11-28"),
          reason: "Folga a remover",
        },
        new UniqueEntityId("exc-del-a"),
      );
      exceptionsRepo.items.push(exception);

      const res = await deleteExceptionUseCase.execute({
        barbershopId: shopId,
        exceptionId: "exc-del-a",
        staffId: barberAId,
      });

      expect(res.isRight()).toBe(true);
      expect(exceptionsRepo.items).toHaveLength(0);
    });

    it("barbeiro é impedido de excluir exceção de colega ou da unidade", async () => {
      const exception = ScheduleException.create(
        {
          barbershopId: new UniqueEntityId(shopId),
          barbermanId: new UniqueEntityId(barberBId),
          date: new Date("2026-11-29"),
          reason: "Folga do colega",
        },
        new UniqueEntityId("exc-del-b"),
      );
      exceptionsRepo.items.push(exception);

      const res = await deleteExceptionUseCase.execute({
        barbershopId: shopId,
        exceptionId: "exc-del-b",
        staffId: barberAId,
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value).toBeInstanceOf(NotAllowedError);
      }
      expect(exceptionsRepo.items).toHaveLength(1);
    });
  });
});
