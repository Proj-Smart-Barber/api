import { describe, expect, it, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../../core/entities/unique-entity-id";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Booking } from "../../../../enterprise/entities/booking";
import {
  Membership,
  Role,
} from "../../../../enterprise/entities/membership";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import type {
  LockResources,
  ProfessionalMembershipUnitOfWork,
  UnitOfWorkContext,
} from "../../../services/professional-membership-unit-of-work";
import { InMemoryBarbershopsRepository } from "../../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryBookingsRepository } from "../../../../../../test/repositories/in-memory-bookings-repository";
import { InMemoryMembershipsRepository } from "../../../../../../test/repositories/in-memory-memberships-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import {
  CannotDeactivateOwnerError,
  MembershipHasBookingsError,
  MembershipVersionConflictError,
} from "../../_errors/membership-errors";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { DeactivateUnitMembershipUseCase } from "./deactivate-unit-membership";

class InMemoryProfessionalMembershipUnitOfWork
  implements ProfessionalMembershipUnitOfWork
{
  async withLocks<T>(
    _resources: LockResources,
    work: (tx: any, context: UnitOfWorkContext) => Promise<T>,
  ): Promise<T> {
    return work(null, { serverTime: new Date() });
  }
}

describe("DeactivateUnitMembershipUseCase", () => {
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let bookingsRepository: InMemoryBookingsRepository;
  let usersRepository: InMemoryUsersRepository;
  let unitOfWork: InMemoryProfessionalMembershipUnitOfWork;
  let sut: DeactivateUnitMembershipUseCase;

  const ownerId = new UniqueEntityId("owner-id");
  const shopId = new UniqueEntityId("shop-id");
  const barberId = new UniqueEntityId("barber-id");

  beforeEach(async () => {
    barbershopsRepository = new InMemoryBarbershopsRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    bookingsRepository = new InMemoryBookingsRepository();
    usersRepository = new InMemoryUsersRepository();
    unitOfWork = new InMemoryProfessionalMembershipUnitOfWork();

    sut = new DeactivateUnitMembershipUseCase(
      membershipsRepository,
      barbershopsRepository,
      bookingsRepository,
      unitOfWork,
      usersRepository,
    );

    const barbershop = Barbershop.create(
      {
        name: "Barbearia Modelo",
        ownerId,
        slug: Slug.create("barbearia-modelo"),
        cnpj: "12345678000199",
        location: "Rua Teste, 123",
        status: "ACTIVE",
        timezone: "America/Sao_Paulo",
      },
      shopId,
    );
    barbershopsRepository.items.push(barbershop);

    await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: ownerId,
        role: Role.OWNER,
        state: "ACTIVE",
      }),
    );

    const ownerUser = User.create(
      {
        name: "Proprietário",
        email: "owner@modelo.com",
        cpf: "12345678909",
        password: Password.create("hash"),
        accountType: "OWNER",
      },
      ownerId,
    );
    await usersRepository.save(ownerUser);

    const barberUser = User.create(
      {
        name: "Barbeiro Silva",
        email: "barber@modelo.com",
        cpf: "11144477735",
        password: Password.create("hash"),
        accountType: "BARBER",
      },
      barberId,
    );
    await usersRepository.save(barberUser);
  });

  it("desativa com sucesso um vínculo profissional ativo sem agendamentos bloqueantes", async () => {
    const membership = await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: barberId,
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      membershipId: membership.id.toString(),
      expectedVersion: 1,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.state).toBe("INACTIVE");
      expect(result.value.endedAt).not.toBeNull();
      expect(result.value.version).toBe(2);
    }

    const updated = await membershipsRepository.findById(
      membership.id.toString(),
    );
    expect(updated?.state).toBe("INACTIVE");
    expect(updated?.version).toBe(2);
  });

  it("impede o proprietário de se desativar ou de desativar outro OWNER", async () => {
    const ownerMembership =
      await membershipsRepository.findByBarbershopAndUser(
        shopId.toString(),
        ownerId.toString(),
      );

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      membershipId: ownerMembership!.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(CannotDeactivateOwnerError);
  });

  it("rejeita desativação se o solicitante não for OWNER ativo da barbearia", async () => {
    const otherUserId = new UniqueEntityId("other-user");
    const membership = await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: barberId,
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    const result = await sut.execute({
      actorId: otherUserId.toString(),
      shopId: shopId.toString(),
      membershipId: membership.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("bloqueia desativação se o profissional possuir agendamentos futuros ou em andamento", async () => {
    const membership = await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: barberId,
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    // Criar agendamento futuro
    const booking = Booking.create({
      barbershopId: shopId,
      barbermanId: barberId,
      customerId: new UniqueEntityId("cust-1"),
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // daqui a 2 horas
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: "CONFIRMED",
    });
    await bookingsRepository.create(booking);

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      membershipId: membership.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(MembershipHasBookingsError);
    if (result.isLeft() && result.value instanceof MembershipHasBookingsError) {
      expect(result.value.blockingBookingIds).toContain(booking.id.toString());
    }

    // Garante que o vínculo permaneceu ATIVO
    const unchanged = await membershipsRepository.findById(
      membership.id.toString(),
    );
    expect(unchanged?.state).toBe("ACTIVE");
  });

  it("rejeita desativação quando expectedVersion estiver desatualizada", async () => {
    const membership = await membershipsRepository.create(
      Membership.create({
        barbershopId: shopId,
        userId: barberId,
        role: Role.BARBERMAN,
        state: "ACTIVE",
      }),
    );

    const result = await sut.execute({
      actorId: ownerId.toString(),
      shopId: shopId.toString(),
      membershipId: membership.id.toString(),
      expectedVersion: 99, // Versão desatualizada
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(MembershipVersionConflictError);
  });
});
