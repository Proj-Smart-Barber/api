import { type Either, left, right } from "../../../../../core/logic/either";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { UsersRepository } from "../../../repositories/users-repository";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import type { CreateUserDTO } from "./create-user-dto";
import type { CreateUserResponse } from "./create-user-response";

type CreateUserUseCaseResponse = Either<
  CPFOrEmailAlreadyInUseError,
  CreateUserResponse
>;

export class CreateUserUseCase {
  constructor(private usersRepository: UsersRepository) {}

  async execute({
    name,
    email,
    password,
    cpf,
  }: CreateUserDTO): Promise<CreateUserUseCaseResponse> {
    const userAlreadyExists = await this.usersRepository.findByCpfOrEmail(
      cpf,
      email,
    );

    if (userAlreadyExists) {
      return left(new CPFOrEmailAlreadyInUseError());
    }

    const newUser = User.create({
      name,
      email,
      password: await Password.generateHashFromPlainText(password, 12),
      cpf,
    });

    const user = await this.usersRepository.save(newUser);

    return right({
      userId: user.id.toString(),
    });
  }
}
