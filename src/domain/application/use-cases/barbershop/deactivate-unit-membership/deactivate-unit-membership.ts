import { type Either, left, right } from "../../../../../core/logic/either";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { BookingsRepository } from "../../../repositories/bookings-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import type {
  ProfessionalMembershipUnitOfWork,
  UnitOfWorkContext,
} from "../../../services/professional-membership-unit-of-work";
import {
  CannotDeactivateOwnerError,
  MembershipHasBookingsError,
  MembershipVersionConflictError,
} from "../../_errors/membership-errors";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import type { TeamMemberDto } from "../list-unit-team/list-unit-team";

export interface DeactivateUnitMembershipDTO {
  actorId: string;
  shopId: string;
  membershipId: string;
  expectedVersion?: number;
}

export type DeactivateUnitMembershipResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | CannotDeactivateOwnerError
  | MembershipVersionConflictError
  | MembershipHasBookingsError,
  TeamMemberDto
>;

export class DeactivateUnitMembershipUseCase {
  constructor(
    private membershipsRepository: MembershipsRepository,
    private barbershopsRepository: BarbershopsRepository,
    private bookingsRepository: BookingsRepository,
    private unitOfWork: ProfessionalMembershipUnitOfWork,
    private usersRepository?: UsersRepository,
  ) {}

  async execute(
    {
      actorId,
      shopId,
      membershipId,
      expectedVersion,
    }: DeactivateUnitMembershipDTO,
    existingTx?: any,
    context?: UnitOfWorkContext,
  ): Promise<DeactivateUnitMembershipResponse> {
    const barbershop = await this.barbershopsRepository.findById(shopId);
    if (!barbershop) {
      return left(new ResourceNotFoundError("Barbearia não encontrada."));
    }

    const runWork = async (
      tx: any,
      { serverTime }: UnitOfWorkContext,
    ): Promise<DeactivateUnitMembershipResponse> => {
      // 1. Revalidate actor authority under lock
      const actorMembership =
        await this.membershipsRepository.findByBarbershopAndUser(
          shopId,
          actorId,
          tx,
        );

      if (
        !actorMembership ||
        actorMembership.role !== Role.OWNER ||
        actorMembership.state !== "ACTIVE"
      ) {
        return left(
          new NotAllowedError(
            "Apenas o proprietário ativo da unidade pode desativar membros.",
          ),
        );
      }

      // 2. Fetch target membership under lock
      const targetMembership = await this.membershipsRepository.findById(
        membershipId,
        tx,
      );

      if (
        !targetMembership ||
        targetMembership.barbershopId.toString() !== shopId
      ) {
        return left(new ResourceNotFoundError("Vínculo não encontrado."));
      }

      // 3. Prohibit owner self-deactivation or transferring ownership via shortcut
      if (
        targetMembership.userId.toString() === actorId ||
        targetMembership.role === Role.OWNER
      ) {
        return left(new CannotDeactivateOwnerError());
      }

      // 4. Version check
      if (
        expectedVersion !== undefined &&
        targetMembership.version !== expectedVersion
      ) {
        return left(new MembershipVersionConflictError());
      }

      // 5. Check blocking bookings (future or in-progress)
      const blockingBookings =
        await this.bookingsRepository.findActiveAndFutureBookingsForBarberman(
          shopId,
          targetMembership.userId.toString(),
          serverTime,
          tx,
        );

      if (blockingBookings.length > 0) {
        return left(
          new MembershipHasBookingsError(
            blockingBookings.map((b) => b.id.toString()),
          ),
        );
      }

      // 6. Deactivate and persist
      targetMembership.deactivate(serverTime);
      await this.membershipsRepository.save(targetMembership, tx);

      // 7. Assemble TeamMemberDto
      let userName = "Membro";
      let avatarUrl: string | null = null;

      if (this.usersRepository) {
        const user = await this.usersRepository.findById(
          targetMembership.userId.toString(),
        );
        if (user) {
          userName = user.name;
          avatarUrl = user.avatarUrl ?? null;
        }
      }

      const dto: TeamMemberDto = {
        membershipId: targetMembership.id.toString(),
        userId: targetMembership.userId.toString(),
        name: userName,
        role: targetMembership.role,
        state: targetMembership.state,
        version: targetMembership.version,
        joinedAt:
          targetMembership.createdAt?.toISOString() ?? serverTime.toISOString(),
        endedAt: targetMembership.endedAt?.toISOString() ?? null,
        avatarUrl,
      };

      return right(dto);
    };

    if (existingTx && context) {
      return await runWork(existingTx, context);
    }

    // Pre-discover target professional to acquire global professional lock
    const target = await this.membershipsRepository.findById(membershipId);
    const professionalIds = target ? [target.userId.toString()] : [];

    return await this.unitOfWork.withLocks(
      {
        unitIds: [shopId],
        professionalIds,
        membershipIds: [membershipId],
      },
      async (tx, ctx) => {
        return await runWork(tx, ctx);
      },
      existingTx,
    );
  }
}
