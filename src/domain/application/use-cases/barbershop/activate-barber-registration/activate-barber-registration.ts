import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import { User } from "../../../../enterprise/entities/user";
import { Cpf } from "../../../../enterprise/entities/value-objects/cpf";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { BarberRegistrationsRepository } from "../../../repositories/barber-registrations-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { AccountAlreadyExistsError } from "../../_errors/account-already-exists-error";
import { IdentityConflictError } from "../../_errors/identity-conflict-error";
import { InvalidInvitationError } from "../../_errors/invalid-invitation-error";

export interface ActivateBarberRegistrationDTO {
  token: string;
  password: string;
}

export interface ActivateBarberRegistrationResponse {
  userId: string;
  email: string;
  status: "COMPLETED";
}

export type ActivateBarberRegistrationUseCaseResponse = Either<
  | InvalidInvitationError
  | AccountAlreadyExistsError
  | IdentityConflictError
  | Error,
  ActivateBarberRegistrationResponse
>;

export class ActivateBarberRegistrationUseCase {
  constructor(
    private barberRegistrationsRepository: BarberRegistrationsRepository,
    private invitationsRepository: InvitationsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute({
    token,
    password,
  }: ActivateBarberRegistrationDTO): Promise<ActivateBarberRegistrationUseCaseResponse> {
    if (!token || typeof token !== "string" || token.trim() === "") {
      return left(new InvalidInvitationError("Token de ativação ausente."));
    }

    const tokenHash = hashToken(token.trim());

    const registration =
      await this.barberRegistrationsRepository.findByTokenHash(tokenHash);

    const invitation =
      await this.invitationsRepository.findByTokenHash(tokenHash);

    if (!registration) {
      return left(
        new InvalidInvitationError(
          "Cadastro profissional não encontrado para este token.",
        ),
      );
    }

    if (!registration.isPending()) {
      return left(
        new InvalidInvitationError("Este cadastro já foi ativado ou expirou."),
      );
    }

    if (invitation && !invitation.canBeRespondedTo()) {
      return left(
        new InvalidInvitationError("Este convite já foi utilizado ou expirou."),
      );
    }

    const cleanCpf = Cpf.normalize(registration.cpf);
    if (!Cpf.isValid(cleanCpf)) {
      return left(
        new InvalidInvitationError("CPF do cadastro profissional é inválido."),
      );
    }

    const normalizedEmail = registration.email.trim().toLowerCase();

    // Revalidação no momento da ativação para evitar corridas com cadastro público concorrente
    const existingUserByEmail =
      await this.usersRepository.findByEmail(normalizedEmail);
    const existingUserByCpf = await this.usersRepository.findByCpf(cleanCpf);

    const hasConflict =
      (existingUserByCpf && !existingUserByEmail) ||
      (existingUserByEmail && !existingUserByCpf) ||
      (existingUserByEmail &&
        existingUserByCpf &&
        existingUserByEmail.id.toString() !== existingUserByCpf.id.toString());

    if (hasConflict) {
      return left(new IdentityConflictError());
    }

    if (existingUserByEmail && existingUserByCpf) {
      return left(new AccountAlreadyExistsError());
    }

    const codePointLength = Array.from(password).length;
    if (codePointLength < 8) {
      return left(
        new Error(
          "A senha deve ter pelo menos 8 caracteres. Uma frase fácil de lembrar funciona.",
        ),
      );
    }
    const byteLength = new TextEncoder().encode(password).length;
    if (byteLength > 72) {
      return left(
        new Error("Essa senha é longa demais. Use uma frase mais curta."),
      );
    }

    const hashedPassword = await Password.generateHashFromPlainText(
      password,
      12,
    );

    const user = User.create({
      name: registration.name.trim(),
      email: normalizedEmail,
      cpf: cleanCpf,
      password: hashedPassword,
      accountType: "CLIENT",
      emailVerifiedAt: new Date(),
    });

    await this.usersRepository.save(user);

    registration.markCompleted(new Date());
    await this.barberRegistrationsRepository.save(registration);

    return right({
      userId: user.id.toString(),
      email: user.email,
      status: "COMPLETED",
    });
  }
}
