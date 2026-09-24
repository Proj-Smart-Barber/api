import { type Either, left, right } from "../../../../../core/logic/either";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import { BarbershopAlreadyExistsError } from "../../_errors/barbershop-already-exists-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { Barbershop } from "../../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../../enterprise/entities/membership";
import { Slug } from "../../../../enterprise/entities/value-objects/slug";
import type { StaffsRepository } from "../../../repositories/staffs-repository";
import type { CreateBarbershopDTO } from "./create-barbershop-dto";
import type { CreateBarbershopResponse } from "./create-barbershop-response";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

type CreateBarbershopUseCaseResponse = Either<
  ResourceNotFoundError | BarbershopAlreadyExistsError,
  CreateBarbershopResponse
>;

export class CreateBarbershopUseCase {
  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private staffsRepository: StaffsRepository,
  ) {}

  async execute({
    name,
    ownerId,
    cnpj,
    location,
    timezone = DEFAULT_TIMEZONE,
    avatarUrl,
  }: CreateBarbershopDTO): Promise<CreateBarbershopUseCaseResponse> {
    const owner = await this.staffsRepository.findById(ownerId);

    if (!owner) {
      return left(new ResourceNotFoundError());
    }

    const normalizedCnpj = cnpj.replace(/\D/g, "");
    const slug = Slug.createFromText(name);
    const barbershopAlreadyExists =
      await this.barbershopsRepository.findBySlugOrCnpj(
        slug.value,
        normalizedCnpj,
      );

    if (barbershopAlreadyExists) {
      return left(new BarbershopAlreadyExistsError());
    }

    const barbershop = Barbershop.create({
      name,
      ownerId: owner.id,
      slug,
      cnpj: normalizedCnpj,
      location,
      timezone,
      status: "ACTIVE",
      avatarUrl,
    });

    const ownerMembership = Membership.create({
      role: Role.OWNER,
      barbershopId: barbershop.id,
      staffId: owner.id,
    });

    const createdBarbershop =
      await this.barbershopsRepository.createWithOwnerMembership(
        barbershop,
        ownerMembership,
      );

    return right({
      barbershopId: createdBarbershop.id.toString(),
    });
  }
}
