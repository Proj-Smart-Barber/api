import { InMemorySchedulesRepository } from "../../../../../../test/repositories/in-memory-schedules-repository";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { UpdateBarbershopScheduleUseCase } from "./update-barbershop-schedule";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { Booking } from "../../../../enterprise/entities/booking";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import { generateUuidV7 } from "../../../../../core/security/uuidv7";

let inMemorySchedulesRepository: InMemorySchedulesRepository;
let inMemoryBarbershopsRepository: InMemoryBarbershopsRepository;
let sut: UpdateBarbershopScheduleUseCase;

describe("Update Barbershop Schedule", () => {
  beforeEach(async () => {
    inMemorySchedulesRepository = new InMemorySchedulesRepository();
    inMemoryBarbershopsRepository = new InMemoryBarbershopsRepository();
    sut = new UpdateBarbershopScheduleUseCase(
      inMemorySchedulesRepository,
      inMemoryBarbershopsRepository,
    );

    const barbershop = Barbershop.create(
      {
        name: "Test Shop",
        slug: Slug.create("test-shop"),
        timezone: "America/Sao_Paulo",
        ownerId: new UniqueEntityId("staff-1"),
        status: "ACTIVE",
        cnpj: "12.345.678/0001-90",
        location: "Rua de Teste, 123",
      },
      new UniqueEntityId("shop-1"),
    );

    inMemoryBarbershopsRepository.items.push(barbershop);
  });

  it("should be able to create/update a schedule day", async () => {
    // 1. Executando a criação normal
    const result = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "18:00",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    expect(inMemorySchedulesRepository.items).toHaveLength(1);
    expect(inMemorySchedulesRepository.items[0].dayOfWeek).toBe("MONDAY");
    expect(inMemorySchedulesRepository.items[0].openTime).toBe("08:00");
    expect(inMemorySchedulesRepository.items[0].closeTime).toBe("18:00");
  });

  it("should isolate schedules between general, barber A, and barber B without cross-contamination", async () => {
    // 1. Criar jornada geral da barbearia
    const generalResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: null,
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "08:00",
          closeTime: "20:00",
        },
      ],
    });
    expect(generalResult.isRight()).toBe(true);

    // 2. Criar jornada individual para Barbeiro A
    const barberAResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: "barber-a",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "10:00",
          closeTime: "16:00",
        },
      ],
    });
    expect(barberAResult.isRight()).toBe(true);

    // 3. Criar jornada individual para Barbeiro B
    const barberBResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: "barber-b",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "12:00",
          closeTime: "20:00",
        },
      ],
    });
    expect(barberBResult.isRight()).toBe(true);

    // 4. Atualizar Barbeiro A para um novo horário
    const updateBarberAResult = await sut.execute({
      barbershopId: "shop-1",
      createdBy: "staff-1",
      barbermanId: "barber-a",
      schedules: [
        {
          dayOfWeek: "MONDAY",
          openTime: "09:00",
          closeTime: "15:00",
        },
      ],
    });
    expect(updateBarberAResult.isRight()).toBe(true);

    // 5. Garantir que a jornada geral continua intacta (08:00 - 18:00)
    const generalItems = inMemorySchedulesRepository.items.filter(
      (item) => item.barbermanId === null,
    );
    expect(generalItems).toHaveLength(1);
    expect(generalItems[0].openTime).toBe("08:00");
    expect(generalItems[0].closeTime).toBe("20:00");

    // 6. Garantir que a jornada do Barbeiro B continua intacta (12:00 - 20:00)
    const barberBItems = inMemorySchedulesRepository.items.filter(
      (item) => item.barbermanId?.toString() === "barber-b",
    );
    expect(barberBItems).toHaveLength(1);
    expect(barberBItems[0].openTime).toBe("12:00");
    expect(barberBItems[0].closeTime).toBe("20:00");

    // 7. Garantir que a jornada do Barbeiro A foi devidamente atualizada (09:00 - 15:00)
    const barberAItems = inMemorySchedulesRepository.items.filter(
      (item) => item.barbermanId?.toString() === "barber-a",
    );
    expect(barberAItems).toHaveLength(1);
    expect(barberAItems[0].openTime).toBe("09:00");
    expect(barberAItems[0].closeTime).toBe("15:00");
  });

  describe("Autorização e Regras de Negócio da Fase 1", () => {
    let inMemoryMembershipsRepository: InMemoryMembershipsRepository;
    let inMemoryBookingsRepository: InMemoryBookingsRepository;
    let authorizedSut: UpdateBarbershopScheduleUseCase;

    const ownerUserId = "owner-user";
    const barberUserId = "barber-user";
    const colleagueUserId = "colleague-user";
    const clientUserId = "client-user";
    const inactiveBarberUserId = "inactive-barber-user";
    const shopId = "shop-1";

    beforeEach(async () => {
      inMemoryMembershipsRepository = new InMemoryMembershipsRepository();
      inMemoryBookingsRepository = new InMemoryBookingsRepository();

      authorizedSut = new UpdateBarbershopScheduleUseCase(
        inMemorySchedulesRepository,
        inMemoryBarbershopsRepository,
        undefined,
        inMemoryMembershipsRepository,
        inMemoryBookingsRepository,
      );

      // Cadastrar membros
      await inMemoryMembershipsRepository.create(
        Membership.create({
          barbershopId: new UniqueEntityId(shopId),
          userId: new UniqueEntityId(ownerUserId),
          role: Role.OWNER,
          state: "ACTIVE",
        }),
      );

      await inMemoryMembershipsRepository.create(
        Membership.create({
          barbershopId: new UniqueEntityId(shopId),
          userId: new UniqueEntityId(barberUserId),
          role: Role.BARBERMAN,
          state: "ACTIVE",
        }),
      );

      await inMemoryMembershipsRepository.create(
        Membership.create({
          barbershopId: new UniqueEntityId(shopId),
          userId: new UniqueEntityId(colleagueUserId),
          role: Role.BARBERMAN,
          state: "ACTIVE",
        }),
      );

      await inMemoryMembershipsRepository.create(
        Membership.create({
          barbershopId: new UniqueEntityId(shopId),
          userId: new UniqueEntityId(inactiveBarberUserId),
          role: Role.BARBERMAN,
          state: "INACTIVE",
        }),
      );

      // Jornada geral inicial da barbearia: Seg-Sex das 08:00 às 18:00
      await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: null,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "18:00" },
          { dayOfWeek: "TUESDAY", openTime: "08:00", closeTime: "18:00" },
          { dayOfWeek: "WEDNESDAY", openTime: "08:00", closeTime: "18:00" },
          { dayOfWeek: "THURSDAY", openTime: "08:00", closeTime: "18:00" },
          { dayOfWeek: "FRIDAY", openTime: "08:00", closeTime: "18:00" },
        ],
      });
    });

    it("BARBERMAN ativo deve poder alterar exclusivamente sua própria jornada", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.state).toBe("CUSTOM");
        expect(result.value.schedules).toHaveLength(1);
        expect(result.value.effectiveSchedules).toHaveLength(1);
        expect(result.value.schedules[0].openTime).toBe("09:00");
      }
    });

    it("BARBERMAN tentando alterar jornada geral (sem barbermanId) deve ser rejeitado", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: null,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "18:00" },
        ],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.name).toBe("NotAllowedError");
      }
    });

    it("BARBERMAN tentando alterar jornada de um colega deve ser rejeitado", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: colleagueUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.name).toBe("NotAllowedError");
      }
    });

    it("CLIENT ou usuário sem vínculo ativo deve ser rejeitado", async () => {
      // Cliente sem membership
      const clientResult = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: clientUserId,
        barbermanId: clientUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });
      expect(clientResult.isLeft()).toBe(true);

      // Barbeiro inativo
      const inactiveResult = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: inactiveBarberUserId,
        barbermanId: inactiveBarberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });
      expect(inactiveResult.isLeft()).toBe(true);
    });

    it("OWNER ativo pode alterar a jornada de qualquer profissional ativo da unidade", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "16:00" },
        ],
      });

      expect(result.isRight()).toBe(true);
    });

    it("Jornada geral não pode ter estado INHERIT", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: null,
        state: "INHERIT",
        schedules: [],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toContain("não pode herdar");
      }
    });

    it("BARBERMAN com state=INHERIT deve herdar a jornada geral e ter schedules vazia persistida", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "INHERIT",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [],
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.state).toBe("INHERIT");
        expect(result.value.schedules).toHaveLength(0); // não duplica no banco
        expect(result.value.effectiveSchedules).toHaveLength(5); // reflete a geral
      }
    });

    it("BARBERMAN com state=CLOSED deve fechar a semana e ter effectiveSchedules vazia", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CLOSED",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [],
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.state).toBe("CLOSED");
        expect(result.value.schedules).toHaveLength(0);
        expect(result.value.effectiveSchedules).toHaveLength(0);
      }
    });

    it("BARBERMAN com state=CUSTOM exige pelo menos um período válido", async () => {
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toContain(
          "exige pelo menos um período válido",
        );
      }
    });

    it("Horário individual fora do funcionamento geral da unidade deve ser rejeitado", async () => {
      // Geral é 08:00 às 18:00. Barbeiro tentando 07:00 às 16:00
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "07:00", closeTime: "16:00" },
        ],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toContain(
          "fora do horário de funcionamento geral",
        );
      }
    });

    it("Conflito de agendamento futuro: rejeita alteração se houver agendamento confirmado fora do novo horário", async () => {
      const now = new Date();
      const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
      const nextMonday = new Date(
        now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000,
      );
      nextMonday.setHours(16, 0, 0, 0);

      const booking = Booking.create({
        barbershopId: new UniqueEntityId(shopId),
        barbermanId: new UniqueEntityId(barberUserId),
        customerId: new UniqueEntityId("client-1"),
        startsAt: nextMonday,
        endsAt: new Date(nextMonday.getTime() + 30 * 60 * 1000),
        status: "CONFIRMED",
        totalPriceInCents: 5000,
        totalDurationInMinutes: 30,
      });
      await inMemoryBookingsRepository.create(booking);

      // Barbeiro tenta encurtar a jornada de segunda para fechar às 15:00 (o que corta o agendamento das 16:00)
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "15:00" },
        ],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.name).toBe("ScheduleBookingConflictError");
        const conflictErr = result.value as any;
        expect(conflictErr.conflictingBookings).toHaveLength(1);
        expect(conflictErr.conflictingBookings[0].bookingId).toBe(
          booking.id.toString(),
        );
      }
    });

    it("Controle de versão otimista: expectedVersion incompatível deve ser rejeitado", async () => {
      // 1. Gravar versão inicial
      await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });

      // 2. Tentar atualizar passando expectedVersion = 999 (esperado é 2)
      const result = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 999,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "16:00" },
        ],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.name).toBe("ScheduleVersionConflictError");
      }
    });

    it("Regressão R3: BARBERMAN sem expectedVersion ou sem requestId deve ser rejeitado", async () => {
      const noVersion = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });
      expect(noVersion.isLeft()).toBe(true);
      if (noVersion.isLeft()) {
        expect(noVersion.value.message).toContain(
          "expectedVersion é obrigatório",
        );
      }

      const noRequestId = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
        ],
      });
      expect(noRequestId.isLeft()).toBe(true);
      if (noRequestId.isLeft()) {
        expect(noRequestId.value.message).toContain(
          "requestId (UUIDv7 válido) é obrigatório",
        );
      }
    });

    it("Regressão R4: OWNER com vínculo INACTIVE deve ser rejeitado mesmo com ownerId da barbearia", async () => {
      const inactiveOwnerId = "inactive-owner-user";
      const inactiveShop = Barbershop.create(
        {
          name: "Inactive Owner Shop",
          slug: Slug.create("inactive-owner-shop"),
          timezone: "America/Sao_Paulo",
          ownerId: new UniqueEntityId(inactiveOwnerId),
          status: "ACTIVE",
          cnpj: "12.345.678/0001-99",
          location: "Rua Inativa, 456",
        },
        new UniqueEntityId("shop-inactive"),
      );
      inMemoryBarbershopsRepository.items.push(inactiveShop);

      await inMemoryMembershipsRepository.create(
        Membership.create({
          barbershopId: new UniqueEntityId("shop-inactive"),
          userId: new UniqueEntityId(inactiveOwnerId),
          role: Role.OWNER,
          state: "INACTIVE",
        }),
      );

      const result = await authorizedSut.execute({
        barbershopId: "shop-inactive",
        createdBy: inactiveOwnerId,
        barbermanId: null,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "18:00" },
        ],
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.name).toBe("NotAllowedError");
        expect(result.value.message).toContain("vínculo inativo");
      }
    });

    it("Regressão A1: redução ou fechamento da jornada geral incompatível com jornada CUSTOM ativa deve ser rejeitada com ScheduleCustomConflictError", async () => {
      // Barbeiro define jornada CUSTOM 09:00 às 16:00 na segunda-feira
      const customSetup = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "16:00" },
        ],
      });
      expect(customSetup.isRight()).toBe(true);

      // OWNER tenta encurtar segunda-feira da unidade para 09:00 às 12:00
      const shrinkResult = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: null,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
        ],
      });

      expect(shrinkResult.isLeft()).toBe(true);
      if (shrinkResult.isLeft()) {
        expect(shrinkResult.value.name).toBe("ScheduleCustomConflictError");
        const conflictErr = shrinkResult.value as any;
        expect(conflictErr.code).toBe("SCHEDULE_CUSTOM_CONFLICT");
        expect(conflictErr.conflictingBarbers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              barbermanId: barberUserId,
              dayOfWeek: "MONDAY",
              openTime: "09:00",
              closeTime: "16:00",
            }),
          ]),
        );
      }

      // OWNER tenta fechar a unidade (CLOSED) enquanto barbeiro tem CUSTOM ativo
      const closeResult = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: null,
        state: "CLOSED",
        schedules: [],
      });

      expect(closeResult.isLeft()).toBe(true);
      if (closeResult.isLeft()) {
        expect(closeResult.value.name).toBe("ScheduleCustomConflictError");
      }
    });

    it("Regressão A1: intervalos gerais contíguos (09:00-10:00 e 10:00-12:00) devem permitir CUSTOM 09:00-12:00, enquanto pausa real rejeita", async () => {
      // Configurar jornada geral com dois blocos contíguos na segunda
      const generalContiguous = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: null,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "10:00" },
          { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "12:00" },
        ],
      });
      expect(generalContiguous.isRight()).toBe(true);

      // Barbeiro define 09:00-12:00 contínuo -> aceito!
      const barberContiguous = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 1,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
        ],
      });
      expect(barberContiguous.isRight()).toBe(true);

      // Agora barbeiro volta para INHERIT para permitir que a unidade crie pausa real
      await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "INHERIT",
        expectedVersion: 2,
        requestId: generateUuidV7(),
        schedules: [],
      });

      // Unidade define pausa real 09:00-10:00 e 10:30-12:00
      await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: ownerUserId,
        barbermanId: null,
        state: "CUSTOM",
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "10:00" },
          { dayOfWeek: "MONDAY", openTime: "10:30", closeTime: "12:00" },
        ],
      });

      // Barbeiro tenta 09:00-12:00 atravessando pausa -> rejeitado!
      const barberAcrossBreak = await authorizedSut.execute({
        barbershopId: shopId,
        createdBy: barberUserId,
        barbermanId: barberUserId,
        state: "CUSTOM",
        expectedVersion: 3,
        requestId: generateUuidV7(),
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
        ],
      });
      expect(barberAcrossBreak.isLeft()).toBe(true);
    });
  });
});
