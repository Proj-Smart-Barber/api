import { hashToken } from "../../../../../core/crypto/token";
import { PasswordRecoveryToken } from "../../../../enterprise/entities/password-recovery-token";
import { User } from "../../../../enterprise/entities/user";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { FakeEmailService } from "../../../../../../test/fakes/fake-email-service";
import { InMemoryPasswordRecoveryTokensRepository } from "../../../../../../test/repositories/in-memory-password-recovery-tokens-repository";
import { InMemoryUsersRepository } from "../../../../../../test/repositories/in-memory-users-repository";
import { EmailSendError } from "../../_errors/email-send-error";
import { SendPasswordRecoveryUseCase } from "./send-password-recovery";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryPasswordRecoveryTokensRepository: InMemoryPasswordRecoveryTokensRepository;
let fakeEmailService: FakeEmailService;
let sut: SendPasswordRecoveryUseCase;

describe("Send password recovery", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryPasswordRecoveryTokensRepository =
      new InMemoryPasswordRecoveryTokensRepository();
    fakeEmailService = new FakeEmailService();

    sut = new SendPasswordRecoveryUseCase(
      inMemoryUsersRepository,
      inMemoryPasswordRecoveryTokensRepository,
      fakeEmailService,
    );
  });

  async function createUser(emailVerifiedAt?: Date): Promise<User> {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
      emailVerifiedAt,
    });
    await inMemoryUsersRepository.save(user);

    return user;
  }

  it("should send a recovery email with a link for an existing user", async () => {
    await createUser();

    const response = await sut.execute({ email: "fulano@email.com" });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual({ sentTo: "fulano@email.com" });

    expect(fakeEmailService.recoveryEmails).toHaveLength(1);
    const sent = fakeEmailService.recoveryEmails[0];
    expect(sent.to).toBe("fulano@email.com");
    expect(sent.name).toBe("Fulano");
    expect(sent.recoveryUrl).toContain("/reset-password?token=");
    expect(sent.expiresInHours).toBeGreaterThan(0);
  });

  it("should send a recovery email even for an already verified user", async () => {
    await createUser(new Date());

    const response = await sut.execute({ email: "fulano@email.com" });

    expect(response.isRight()).toBe(true);
    expect(fakeEmailService.recoveryEmails).toHaveLength(1);
  });

  it("should store only the hashed token", async () => {
    await createUser();

    await sut.execute({ email: "fulano@email.com" });

    const plainToken = new URL(
      fakeEmailService.recoveryEmails[0].recoveryUrl,
    ).searchParams.get("token");

    expect(plainToken).toBeTruthy();
    expect(inMemoryPasswordRecoveryTokensRepository.items).toHaveLength(1);
    expect(inMemoryPasswordRecoveryTokensRepository.items[0].tokenHash).toBe(
      hashToken(plainToken as string),
    );
  });

  it("should invalidate previous active tokens and rotate", async () => {
    const user = await createUser();

    const previous = PasswordRecoveryToken.create({
      userId: user.id,
      tokenHash: "previous-token-hash",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await inMemoryPasswordRecoveryTokensRepository.create(previous);

    await sut.execute({ email: "fulano@email.com" });

    expect(previous.isUsed()).toBe(true);
    expect(inMemoryPasswordRecoveryTokensRepository.items).toHaveLength(2);
  });

  it("should not send or reveal anything for an unknown email", async () => {
    const response = await sut.execute({
      email: "nao-existe@email.com",
    });

    expect(response.isRight()).toBe(true);
    expect(response.value).toEqual({ sentTo: "nao-existe@email.com" });
    expect(fakeEmailService.recoveryEmails).toHaveLength(0);
    expect(inMemoryPasswordRecoveryTokensRepository.items).toHaveLength(0);
  });

  it("should return an email send error when the email service fails", async () => {
    await createUser();

    fakeEmailService.failNextSend = true;

    const response = await sut.execute({ email: "fulano@email.com" });

    expect(response.value).toBeInstanceOf(EmailSendError);
  });
});
