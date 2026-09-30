import { sign } from "jsonwebtoken";
import { left, right, type Either } from "../../../../../core/logic/either";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import type { StringValue } from "ms";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { SignInUserDTO } from "./sign-in-user-dto";
import type { SignInUserResponse } from "./sign-in-user-response";
import { env } from "../../../../../infra/env";

type SignInUserUseCaseResponse = Either<
  InvalidCredentialsError,
  SignInUserResponse
>;

export class SignInUserUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private barbershopsRepository: BarbershopsRepository,
  ) {}

  async execute({
    email,
    password,
  }: SignInUserDTO): Promise<SignInUserUseCaseResponse> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      return left(new InvalidCredentialsError());
    }

    const memberships = await this.barbershopsRepository.findManyByStaffId(
      user.id.toString(),
    );

    if (memberships.length === 0) {
      return left(new InvalidCredentialsError());
    }

    const passwordMatch = await Password.isValid(
      password,
      user.password.toString(),
    );

    if (passwordMatch.isLeft()) {
      return left(new InvalidCredentialsError());
    }

    const token = sign({ sub: user.id.toString() }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as StringValue,
    });

    return right({
      access_token: token,
    });
  }
}
