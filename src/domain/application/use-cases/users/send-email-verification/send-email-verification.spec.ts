import { hashToken } from "../../../../../core/crypto/token";
import { EmailVerification } from "../../../../enterprise/entities/email-verification";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { FakeEmailService } from "../../../../../../test/fakes/fake-email-service";
import { InMemoryEmailVerificationsRepository } from "../../../../../../test/repositories/in-memory-email-verifications-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { EmailSendError } from "../../_errors/email-send-error";
import { SendEmailVerificationUseCase } from "./send-email-verification";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEmailVerificationsRepository: InMemoryEmailVerificationsRepository;
let fakeEmailService: FakeEmailService;
let sut: SendEmailVerificationUseCase;

describe("Send email verification", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEmailVerificationsRepository =
      new InMemoryEmailVerificationsRepository();
    fakeEmailService = new FakeEmailService();

    sut = new SendEmailVerificationUseCase(
      inMemoryUsersRepository,
      inMemoryEmailVerificationsRepository,
      fakeEmailService,
    );
  });

  it("should send a verification email with a link for an unverified user", async () => {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(user);

    const response = await sut.execute({ email: "fulano@email.com" });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual({ sentTo: "fulano@email.com" });

    expect(fakeEmailService.sentEmails).toHaveLength(1);
    const sent = fakeEmailService.sentEmails[0];
    expect(sent.to).toBe("fulano@email.com");
    expect(sent.name).toBe("Fulano");
    expect(sent.verificationUrl).toContain(
      "/api/users/verification-email/confirm?token=",
    );
    expect(sent.expiresInHours).toBeGreaterThan(0);
  });

  it("should store only the hashed token", async () => {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(user);

    await sut.execute({ email: "fulano@email.com" });

    const plainToken = new URL(
      fakeEmailService.sentEmails[0].verificationUrl,
    ).searchParams.get("token");

    expect(plainToken).toBeTruthy();
    expect(inMemoryEmailVerificationsRepository.items).toHaveLength(1);
    expect(inMemoryEmailVerificationsRepository.items[0].tokenHash).toBe(
      hashToken(plainToken as string),
    );
  });

  it("should invalidate previous active tokens and rotate", async () => {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(user);

    const previous = EmailVerification.create({
      userId: user.id,
      tokenHash: "previous-token-hash",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await inMemoryEmailVerificationsRepository.create(previous);

    await sut.execute({ email: "fulano@email.com" });

    expect(previous.isUsed()).toBe(true);
    expect(inMemoryEmailVerificationsRepository.items).toHaveLength(2);
  });

  it("should not send or reveal anything for an unknown email", async () => {
    const response = await sut.execute({
      email: "nao-existe@email.com",
    });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual({ sentTo: "nao-existe@email.com" });
    expect(fakeEmailService.sentEmails).toHaveLength(0);
    expect(inMemoryEmailVerificationsRepository.items).toHaveLength(0);
  });

  it("should not send or reveal anything for an already verified user", async () => {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
      emailVerifiedAt: new Date(),
    });
    await inMemoryUsersRepository.save(user);

    const response = await sut.execute({ email: "fulano@email.com" });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual({ sentTo: "fulano@email.com" });
    expect(fakeEmailService.sentEmails).toHaveLength(0);
  });

  it("should return an email send error when the email service fails", async () => {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });
    await inMemoryUsersRepository.save(user);

    fakeEmailService.failNextSend = true;

    const response = await sut.execute({ email: "fulano@email.com" });

    expect(response.value).toBeInstanceOf(EmailSendError);
  });
});
