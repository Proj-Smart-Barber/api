import { User } from "../../../domain/enterprise/entities/user";
import { Password } from "../../../domain/enterprise/entities/value-objects/password";
import { SendPasswordRecoveryUseCase } from "../../../domain/application/use-cases/users/send-password-recovery/send-password-recovery";
import { FakeEmailService } from "../../../../test/fakes/fake-email-service";
import { InMemoryPasswordRecoveryTokensRepository } from "../../../../test/repositories/in-memory-password-recovery-tokens-repository";
import { InMemoryUsersRepository } from "../../../../test/repositories/in-memory-users-repository";
import { SendPasswordRecoveryController } from "./send-password-recovery-controller";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryPasswordRecoveryTokensRepository: InMemoryPasswordRecoveryTokensRepository;
let fakeEmailService: FakeEmailService;
let controller: SendPasswordRecoveryController;

describe("SendPasswordRecoveryController", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryPasswordRecoveryTokensRepository =
      new InMemoryPasswordRecoveryTokensRepository();
    fakeEmailService = new FakeEmailService();

    const useCase = new SendPasswordRecoveryUseCase(
      inMemoryUsersRepository,
      inMemoryPasswordRecoveryTokensRepository,
      fakeEmailService,
    );

    controller = new SendPasswordRecoveryController(useCase);
  });

  async function createUser(): Promise<User> {
    const user = User.create({
      name: "Fulano",
      email: "fulano@email.com",
      password: await Password.generateHashFromPlainText("12345678", 12),
      cpf: "00000000000",
    });

    return inMemoryUsersRepository.save(user);
  }

  it("should return 200 with sentTo and send the email", async () => {
    await createUser();

    const response = await controller.handle({ email: "fulano@email.com" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ sentTo: "fulano@email.com" });
    expect(fakeEmailService.recoveryEmails).toHaveLength(1);
  });

  it("should return 200 with sentTo for an unknown email without sending", async () => {
    const response = await controller.handle({
      email: "nao-existe@email.com",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ sentTo: "nao-existe@email.com" });
    expect(fakeEmailService.recoveryEmails).toHaveLength(0);
  });

  it("should return 400 for an invalid email", async () => {
    const response = await controller.handle({ email: "invalid-email" });

    expect(response.statusCode).toBe(400);
    expect(fakeEmailService.recoveryEmails).toHaveLength(0);
  });

  it("should return 500 when the email service fails", async () => {
    await createUser();
    fakeEmailService.failNextSend = true;

    const response = await controller.handle({ email: "fulano@email.com" });

    expect(response.statusCode).toBe(500);
  });
});
