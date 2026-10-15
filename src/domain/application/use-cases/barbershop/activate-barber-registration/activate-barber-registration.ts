import { hashToken } from "../../../../../core/crypto/token";
import { type Either, left, right } from "../../../../../core/logic/either";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import type { BarberRegistrationsRepository } from "../../../repositories/barber-registrations-repository";
import type { InvitationsRepository } from "../../../repositories/invitations-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { AccountAlreadyExistsError } from "../../_errors/account-already-exists-error";
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
  InvalidInvitationError | AccountAlreadyExistsError | Error,
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

    if (!registration && !invitation) {
      return left(new InvalidInvitationError("Token de ativação inválido."));
    }

    const email = registration?.email ?? invitation?.email;
    if (!email) {
      return left(new InvalidInvitationError("Dados do convite corrompidos."));
    }

    if (registration && !registration.isPending()) {
      return left(
        new InvalidInvitationError("Este cadastro já foi ativado ou expirou."),
      );
    }

    if (invitation && !invitation.canBeRespondedTo()) {
      return left(
        new InvalidInvitationError("Este convite já foi utilizado ou expirou."),
      );
    }

    // Se já existe conta para este e-mail, deve fazer login em vez de definir nova senha
    const existingUser = await this.usersRepository.findByEmail(email);
    if (existingUser) {
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
      name: registration?.name ?? "Profissional",
      email,
      cpf: registration?.cpf ?? "00000000000",
      password: hashedPassword,
      accountType: "CLIENT",
      emailVerifiedAt: new Date(),
    });

    await this.usersRepository.save(user);

    if (registration) {
      registration.markCompleted(new Date());
      await this.barberRegistrationsRepository.save(registration);
    }

    return right({
      userId: user.id.toString(),
      email: user.email,
      status: "COMPLETED",
    });
  }
}
