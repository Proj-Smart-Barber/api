import { type Either, left, right } from "../../../../../core/logic/either";
import { User } from "../../../../enterprise/entities/user";
import { Cpf } from "../../../../enterprise/entities/value-objects/cpf";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { InvalidCpfError } from "../../../../enterprise/errors/invalid-cpf-error";
import type { UsersRepository } from "../../../repositories/users-repository";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import type { CreateUserDTO } from "./create-user-dto";
import type { CreateUserResponse } from "./create-user-response";

type CreateUserUseCaseResponse = Either<
  CPFOrEmailAlreadyInUseError | InvalidCpfError,
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
    const normalizedEmail = email.trim().toLowerCase();

    const cpfResult = Cpf.create(cpf);

    if (cpfResult.isLeft()) {
      return left(cpfResult.value);
    }

    const normalizedCpf = cpfResult.value.toString();

    const userAlreadyExists = await this.usersRepository.findByCpfOrEmail(
      normalizedCpf,
      normalizedEmail,
    );

    if (userAlreadyExists) {
      return left(new CPFOrEmailAlreadyInUseError());
    }

    const newUser = User.create({
      name,
      email: normalizedEmail,
      password: await Password.generateHashFromPlainText(password, 12),
      cpf: normalizedCpf,
    });

    const user = await this.usersRepository.save(newUser);

    return right({
      userId: user.id.toString(),
    });
  }
}
