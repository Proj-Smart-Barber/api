import { type Either, left, right } from "../../../../../core/logic/either";
import { Cpf } from "../../../../enterprise/entities/value-objects/cpf";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { AuthGateway } from "../../../gateways/auth-gateway";
import { AuthGatewayError } from "../../../gateways/auth-gateway";
import { CPFOrEmailAlreadyInUseError } from "../../_errors/cpf-or-email-already-in-use-error";
import { InvalidCpfError } from "../../_errors/invalid-cpf-error";
import { WeakPasswordError } from "../../_errors/weak-password-error";
import type { CreateUserDTO } from "./create-user-dto";
import type { CreateUserResponse } from "./create-user-response";

type CreateUserUseCaseResponse = Either<
  InvalidCpfError | CPFOrEmailAlreadyInUseError | WeakPasswordError,
  CreateUserResponse
>;

/**
 * Cadastro de conta única: o CPF é canonizado/validado antes de persistir e a
 * escrita da conta (usuário + credencial) fica a cargo do better-auth.
 * O papel inicial é CLIENT — nenhum permissão é inferida no cadastro.
 */
export class CreateUserUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private authGateway: AuthGateway,
  ) {}

  async execute({
    name,
    email,
    password,
    cpf,
    phoneNumber,
    callbackURL,
  }: CreateUserDTO): Promise<CreateUserUseCaseResponse> {
    const canonicalCpf = Cpf.canonical(cpf);

    if (!canonicalCpf) {
      return left(new InvalidCpfError());
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userAlreadyExists = await this.usersRepository.findByCpfOrEmail(
      canonicalCpf,
      normalizedEmail,
    );

    if (userAlreadyExists) {
      return left(new CPFOrEmailAlreadyInUseError());
    }

    try {
      const { userId, setCookies, authToken } = await this.authGateway.signUp({
        name: name.trim(),
        email: normalizedEmail,
        password,
        cpf: canonicalCpf,
        phoneNumber,
        callbackURL,
      });

      return right({ userId, setCookies, authToken });
    } catch (error) {
      if (error instanceof AuthGatewayError) {
        if (
          error.code === "EMAIL_ALREADY_IN_USE" ||
          error.code === "CPF_ALREADY_IN_USE"
        ) {
          return left(new CPFOrEmailAlreadyInUseError());
        }

        if (error.code === "WEAK_PASSWORD") {
          return left(new WeakPasswordError());
        }
      }

      throw error;
    }
  }
}
