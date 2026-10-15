import type {
  ListTeamOptions,
  MembershipsRepository,
  TeamMemberWithUser,
} from "../../src/domain/application/repositories/memberships-repository";
import type { Invitation } from "../../src/domain/enterprise/entities/invitation";
import type { Membership } from "../../src/domain/enterprise/entities/membership";
import { InvalidInvitationError } from "../../src/domain/application/use-cases/_errors/invalid-invitation-error";
import type { InMemoryUsersRepository } from "./in-memory-users-repository";

export class InMemoryMembershipsRepository implements MembershipsRepository {
  public items: Membership[] = [];
  public usersRepository?: InMemoryUsersRepository;

  constructor(usersRepository?: InMemoryUsersRepository) {
    this.usersRepository = usersRepository;
  }

  async create(membership: Membership): Promise<Membership> {
    this.items.push(membership);

    return membership;
  }

  async save(membership: Membership): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.id.toString() === membership.id.toString(),
    );
    if (index >= 0) {
      this.items[index] = membership;
    } else {
      this.items.push(membership);
    }
  }

  async findById(id: string): Promise<Membership | null> {
    const item = this.items.find((m) => m.id.toString() === id);
    return item ?? null;
  }

  async findByBarbershopAndUser(
    barbershopId: string,
    userId: string,
  ): Promise<Membership | null> {
    const membership = this.items.find(
      (item) =>
        item.barbershopId.toString() === barbershopId &&
        item.userId.toString() === userId,
    );

    return membership ?? null;
  }

  async findManyByBarbershopId(barbershopId: string): Promise<Membership[]> {
    return this.items.filter(
      (item) => item.barbershopId.toString() === barbershopId,
    );
  }

  async findManyByBarbershopIdWithDetails(
    barbershopId: string,
    options: ListTeamOptions,
  ): Promise<{ items: TeamMemberWithUser[]; total: number }> {
    let filtered = this.items.filter(
      (item) => item.barbershopId.toString() === barbershopId,
    );

    if (options.state) {
      filtered = filtered.filter((item) => item.state === options.state);
    }

    filtered.sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.id.toString().localeCompare(b.id.toString());
    });

    const total = filtered.length;
    const pageItems = filtered.slice(
      (options.page - 1) * options.limit,
      options.page * options.limit,
    );

    const items: TeamMemberWithUser[] = await Promise.all(
      pageItems.map(async (m) => {
        const user = this.usersRepository
          ? await this.usersRepository.findById(m.userId.toString())
          : null;
        return {
          membership: m,
          user: {
            id: m.userId.toString(),
            name: user?.name ?? "Membro",
            avatarUrl: user?.avatarUrl ?? null,
          },
        };
      }),
    );

    return { items, total };
  }

  async acceptInvitation(
    invitation: Invitation,
    membership: Membership,
    userToPromote?: any,
  ): Promise<void> {
    if (invitation.isExpired()) {
      throw new InvalidInvitationError(
        "Convite inválido, já respondido ou expirado.",
      );
    }

    if (userToPromote && this.usersRepository) {
      await this.usersRepository.save(userToPromote);
    }
    const existingIndex = this.items.findIndex(
      (m) =>
        m.barbershopId.toString() === membership.barbershopId.toString() &&
        m.userId.toString() === membership.userId.toString(),
    );
    if (existingIndex >= 0) {
      this.items[existingIndex] = membership;
    } else {
      this.items.push(membership);
    }
  }
}
