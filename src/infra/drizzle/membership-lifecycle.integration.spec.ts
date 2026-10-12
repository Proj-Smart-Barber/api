import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, barbershops, membership, bookings } from "./schema";
import { DrizzleMembershipsRepository } from "./repositories/drizzle-memberships-repository";
import { DrizzleBarbershopsRepository } from "./repositories/drizzle-barbershops-repository";
import { DrizzleUsersRepository } from "./repositories/drizzle-users-repository";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { DrizzleProfessionalMembershipUnitOfWork } from "./services/drizzle-professional-membership-unit-of-work";
import { ListUnitTeamUseCase } from "../../domain/application/use-cases/barbershop/list-unit-team/list-unit-team";
import { DeactivateUnitMembershipUseCase } from "../../domain/application/use-cases/barbershop/deactivate-unit-membership/deactivate-unit-membership";
import { ListBarbershopProfessionalsUseCase } from "../../domain/application/use-cases/barbershop/list-barbershop-professionals/list-barbershop-professionals";

describe("Membership Lifecycle & Unit Team Management (Task E1)", () => {
  let membershipsRepository: DrizzleMembershipsRepository;
  let barbershopsRepository: DrizzleBarbershopsRepository;
  let usersRepository: DrizzleUsersRepository;
  let bookingsRepository: DrizzleBookingsRepository;
  let unitOfWork: DrizzleProfessionalMembershipUnitOfWork;

  let listUnitTeamUseCase: ListUnitTeamUseCase;
  let deactivateUnitMembershipUseCase: DeactivateUnitMembershipUseCase;
  let listProfessionalsUseCase: ListBarbershopProfessionalsUseCase;

  let ownerAId: string;
  let ownerBId: string;
  let shopAId: string;
  let shopBId: string;
  let barber1Id: string;
  let barber2Id: string;
  let customerId: string;

  let membershipOwnerAId: string;
  let membershipBarber1ShopAId: string;
  let membershipBarber1ShopBId: string;
  let membershipBarber2ShopAId: string;

  const randomCpf = () =>
    Math.floor(10000000000 + Math.random() * 90000000000).toString();

  beforeAll(async () => {
    membershipsRepository = new DrizzleMembershipsRepository();
    barbershopsRepository = new DrizzleBarbershopsRepository();
    usersRepository = new DrizzleUsersRepository();
    bookingsRepository = new DrizzleBookingsRepository();
    unitOfWork = new DrizzleProfessionalMembershipUnitOfWork();

    listUnitTeamUseCase = new ListUnitTeamUseCase(
      membershipsRepository,
      barbershopsRepository,
    );
    deactivateUnitMembershipUseCase = new DeactivateUnitMembershipUseCase(
      membershipsRepository,
      barbershopsRepository,
      bookingsRepository,
      unitOfWork,
    );
    listProfessionalsUseCase = new ListBarbershopProfessionalsUseCase(
      barbershopsRepository,
      membershipsRepository,
      usersRepository,
    );

    // Create Owner A & Shop A
    ownerAId = randomUUID();
    await db.insert(users).values({
      id: ownerAId,
      name: "Owner A",
      email: `owner_a_${ownerAId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "OWNER",
    });

    shopAId = randomUUID();
    await db.insert(barbershops).values({
      id: shopAId,
      name: "Barbershop A",
      ownerId: ownerAId,
      slug: `shop-a-${shopAId.slice(0, 8)}`,
      cnpj: `${shopAId.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}`,
      location: "Rua A, 100",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    // Create Owner B & Shop B
    ownerBId = randomUUID();
    await db.insert(users).values({
      id: ownerBId,
      name: "Owner B",
      email: `owner_b_${ownerBId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "OWNER",
    });

    shopBId = randomUUID();
    await db.insert(barbershops).values({
      id: shopBId,
      name: "Barbershop B",
      ownerId: ownerBId,
      slug: `shop-b-${shopBId.slice(0, 8)}`,
      cnpj: `${shopBId.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}`,
      location: "Rua B, 200",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
    });

    // Create Barbers & Customer
    barber1Id = randomUUID();
    await db.insert(users).values({
      id: barber1Id,
      name: "Barber One",
      email: `barber1_${barber1Id.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "BARBER",
    });

    barber2Id = randomUUID();
    await db.insert(users).values({
      id: barber2Id,
      name: "Barber Two",
      email: `barber2_${barber2Id.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "BARBER",
    });

    customerId = randomUUID();
    await db.insert(users).values({
      id: customerId,
      name: "Customer Client",
      email: `customer_${customerId.slice(0, 8)}@test.com`,
      password: "hashed_password",
      cpf: randomCpf(),
      accountType: "CLIENT",
    });

    // Memberships
    membershipOwnerAId = randomUUID();
    await db.insert(membership).values({
      id: membershipOwnerAId,
      barbershopId: shopAId,
      userId: ownerAId,
      role: "OWNER",
      state: "ACTIVE",
      version: 1,
    });

    const membershipOwnerBId = randomUUID();
    await db.insert(membership).values({
      id: membershipOwnerBId,
      barbershopId: shopBId,
      userId: ownerBId,
      role: "OWNER",
      state: "ACTIVE",
      version: 1,
    });

    membershipBarber1ShopAId = randomUUID();
    await db.insert(membership).values({
      id: membershipBarber1ShopAId,
      barbershopId: shopAId,
      userId: barber1Id,
      role: "BARBERMAN",
      state: "ACTIVE",
      version: 1,
    });

    membershipBarber1ShopBId = randomUUID();
    await db.insert(membership).values({
      id: membershipBarber1ShopBId,
      barbershopId: shopBId,
      userId: barber1Id,
      role: "BARBERMAN",
      state: "ACTIVE",
      version: 1,
    });

    membershipBarber2ShopAId = randomUUID();
    await db.insert(membership).values({
      id: membershipBarber2ShopAId,
      barbershopId: shopAId,
      userId: barber2Id,
      role: "BARBERMAN",
      state: "ACTIVE",
      version: 1,
    });
  });

  afterAll(async () => {
    // cleanup test entities
    try {
      await db.delete(bookings).where(eq(bookings.customerId, customerId));
      await db.delete(membership).where(eq(membership.userId, barber1Id));
      await db.delete(membership).where(eq(membership.userId, barber2Id));
      await db.delete(membership).where(eq(membership.userId, ownerAId));
      await db.delete(membership).where(eq(membership.userId, ownerBId));
      await db.delete(barbershops).where(eq(barbershops.id, shopAId));
      await db.delete(barbershops).where(eq(barbershops.id, shopBId));
      await db.delete(users).where(eq(users.id, barber1Id));
      await db.delete(users).where(eq(users.id, barber2Id));
      await db.delete(users).where(eq(users.id, ownerAId));
      await db.delete(users).where(eq(users.id, ownerBId));
      await db.delete(users).where(eq(users.id, customerId));
    } catch {
      // ignore
    }
  });

  it("lists unit team with TeamMemberDto, pagination, and serverTime", async () => {
    const result = await listUnitTeamUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      page: 1,
      limit: 20,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      const response = result.value;
      expect(response.items.length).toBeGreaterThanOrEqual(3);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(20);
      expect(response.serverTime).toBeDefined();

      const member = response.items.find(
        (m) => m.membershipId === membershipBarber1ShopAId,
      );
      expect(member).toBeDefined();
      expect(member?.name).toBe("Barber One");
      expect(member?.role).toBe("BARBERMAN");
      expect(member?.state).toBe("ACTIVE");
      expect(member?.version).toBe(1);
      expect(member?.joinedAt).toBeDefined();
    }
  });

  it("denies owner of other unit from listing team (403 / NotAllowed)", async () => {
    const result = await listUnitTeamUseCase.execute({
      actorId: ownerBId,
      shopId: shopAId,
      page: 1,
      limit: 20,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.name).toBe("NotAllowedError");
    }
  });

  it("denies owner of other unit from deactivating membership (403 / NotAllowed)", async () => {
    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerBId,
      shopId: shopAId,
      membershipId: membershipBarber1ShopAId,
      expectedVersion: 1,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value.name).toBe("NotAllowedError");
    }
  });

  it("blocks owner from deactivating own membership (owner cannot deactivate self)", async () => {
    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      membershipId: membershipOwnerAId,
      expectedVersion: 1,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect((result.value as any).code).toBe("CANNOT_DEACTIVATE_OWNER");
    }
  });

  it("blocks deactivation when member has future bookings (MEMBERSHIP_HAS_BOOKINGS)", async () => {
    const futureBookingId = randomUUID();
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000); // +30m

    await db.insert(bookings).values({
      id: futureBookingId,
      barbershopId: shopAId,
      barbermanId: barber1Id,
      customerId,
      startsAt,
      endsAt,
      date: new Date("2026-10-15"),
      startTime: "10:00",
      endTime: "10:30",
      status: "CONFIRMED",
      version: 1,
    });

    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      membershipId: membershipBarber1ShopAId,
      expectedVersion: 1,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      const error = result.value as any;
      expect(error.code).toBe("MEMBERSHIP_HAS_BOOKINGS");
      expect(error.blockingBookingIds).toContain(futureBookingId);
    }

    // Clean up future booking
    await db.delete(bookings).where(eq(bookings.id, futureBookingId));
  });

  it("blocks deactivation when member has in-progress booking (startsAt <= now && endsAt > now)", async () => {
    const inProgressBookingId = randomUUID();
    const startsAt = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const endsAt = new Date(Date.now() + 20 * 60 * 1000); // in 20 min

    await db.insert(bookings).values({
      id: inProgressBookingId,
      barbershopId: shopAId,
      barbermanId: barber1Id,
      customerId,
      startsAt,
      endsAt,
      date: new Date("2026-10-11"),
      startTime: "20:00",
      endTime: "20:30",
      status: "CONFIRMED",
      version: 1,
    });

    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      membershipId: membershipBarber1ShopAId,
      expectedVersion: 1,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      const error = result.value as any;
      expect(error.code).toBe("MEMBERSHIP_HAS_BOOKINGS");
      expect(error.blockingBookingIds).toContain(inProgressBookingId);
    }

    // Clean up
    await db.delete(bookings).where(eq(bookings.id, inProgressBookingId));
  });

  it("blocks deactivation when member has legacy booking with null status in the future", async () => {
    const legacyBookingId = randomUUID();
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // in 48h
    const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);

    await db.insert(bookings).values({
      id: legacyBookingId,
      barbershopId: shopAId,
      barbermanId: barber1Id,
      customerId,
      startsAt,
      endsAt,
      date: new Date("2026-10-16"),
      startTime: "14:00",
      endTime: "14:45",
      status: null, // Legacy null status
      version: 1,
    });

    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      membershipId: membershipBarber1ShopAId,
      expectedVersion: 1,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      const error = result.value as any;
      expect(error.code).toBe("MEMBERSHIP_HAS_BOOKINGS");
      expect(error.blockingBookingIds).toContain(legacyBookingId);
    }

    // Clean up
    await db.delete(bookings).where(eq(bookings.id, legacyBookingId));
  });

  it("rejects deactivation with outdated expectedVersion (MEMBERSHIP_VERSION_CONFLICT)", async () => {
    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      membershipId: membershipBarber1ShopAId,
      expectedVersion: 999, // wrong version
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      const error = result.value as any;
      expect(error.code).toBe("MEMBERSHIP_VERSION_CONFLICT");
    }
  });

  it("successfully deactivates membership without blockers, preserving user, account and other shop memberships", async () => {
    // Add a completed past booking - should NOT block
    const pastBookingId = randomUUID();
    const startsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    await db.insert(bookings).values({
      id: pastBookingId,
      barbershopId: shopAId,
      barbermanId: barber1Id,
      customerId,
      startsAt,
      endsAt,
      date: new Date("2026-10-10"),
      startTime: "10:00",
      endTime: "10:30",
      status: "COMPLETED",
      version: 1,
    });

    const result = await deactivateUnitMembershipUseCase.execute({
      actorId: ownerAId,
      shopId: shopAId,
      membershipId: membershipBarber1ShopAId,
      expectedVersion: 1,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      const dto = result.value;
      expect(dto.membershipId).toBe(membershipBarber1ShopAId);
      expect(dto.userId).toBe(barber1Id);
      expect(dto.state).toBe("INACTIVE");
      expect(dto.version).toBe(2);
      expect(dto.endedAt).toBeDefined();
    }

    // Verify user account is still intact
    const user = await usersRepository.findById(barber1Id);
    expect(user).not.toBeNull();
    expect(user?.accountType).toBe("BARBER");

    // Verify Shop B membership for same barber is still ACTIVE!
    const memberShopB = await membershipsRepository.findById(
      membershipBarber1ShopBId,
    );
    expect(memberShopB).not.toBeNull();
    expect(memberShopB?.state).toBe("ACTIVE");

    // Verify public professionals of Shop A no longer includes Barber 1
    const publicList = await listProfessionalsUseCase.execute({
      shopId: shopAId,
    });
    expect(publicList.isRight()).toBe(true);
    if (publicList.isRight()) {
      const ids = publicList.value.professionals.map((p) => p.id);
      expect(ids).not.toContain(barber1Id);
    }

    // Clean up
    await db.delete(bookings).where(eq(bookings.id, pastBookingId));
  });

  it("handles race condition between booking creation and deactivation deterministically", async () => {
    // Barber 2 is active in Shop A. Let's run a controlled race:
    // One transaction attempts deactivation, while another attempts to create a future booking.
    // Deterministic locking ensures one waits for the other and only valid state emerges.
    let deactivationResult: any;
    let bookingResult: any;

    const futureBookingId = randomUUID();
    const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const runDeactivation = async () => {
      deactivationResult = await deactivateUnitMembershipUseCase.execute({
        actorId: ownerAId,
        shopId: shopAId,
        membershipId: membershipBarber2ShopAId,
        expectedVersion: 1,
      });
    };

    const runBookingCreationWithLock = async () => {
      // Simulation of B3/B4 creation writer respecting the locking protocol
      try {
        bookingResult = await unitOfWork.withLocks(
          {
            unitIds: [shopAId],
            professionalIds: [barber2Id],
            membershipIds: [membershipBarber2ShopAId],
          },
          async (tx, { serverTime }) => {
            // Re-verify membership under lock!
            const member = await membershipsRepository.findById(
              membershipBarber2ShopAId,
            );
            if (!member || member.state !== "ACTIVE") {
              return { success: false, reason: "MEMBERSHIP_INACTIVE" };
            }

            // Insert booking
            await tx.insert(bookings).values({
              id: futureBookingId,
              barbershopId: shopAId,
              barbermanId: barber2Id,
              customerId,
              startsAt,
              endsAt,
              date: new Date("2026-10-18"),
              startTime: "11:00",
              endTime: "11:30",
              status: "CONFIRMED",
              version: 1,
            });

            return { success: true };
          },
        );
      } catch (err: any) {
        bookingResult = { success: false, error: err.message };
      }
    };

    // Execute concurrently
    await Promise.all([runDeactivation(), runBookingCreationWithLock()]);

    // Check invariant:
    // EITHER deactivation succeeded (inactive) AND booking was rejected (not active)
    // OR booking succeeded AND deactivation was blocked by the newly created booking!
    // NEVER both: membership inactive AND future booking created.
    const finalMember = await membershipsRepository.findById(
      membershipBarber2ShopAId,
    );
    const [bookingFound] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, futureBookingId));

    if (finalMember?.state === "INACTIVE") {
      expect(bookingFound).toBeUndefined();
    } else {
      expect(finalMember?.state).toBe("ACTIVE");
      expect(bookingFound).toBeDefined();
      expect(deactivationResult.isLeft()).toBe(true);
      expect((deactivationResult.value as any).code).toBe(
        "MEMBERSHIP_HAS_BOOKINGS",
      );
    }

    if (futureBookingId) {
      await db.delete(bookings).where(eq(bookings.id, futureBookingId));
    }
  });
});
