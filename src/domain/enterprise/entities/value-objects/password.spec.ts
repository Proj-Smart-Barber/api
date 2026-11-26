import { Password } from "./password";

describe("Password", () => {
  it("deve gerar um hash diferente da senha em texto puro", async () => {
    const password = await Password.generateHashFromPlainText(
      "senha-forte-123",
      4,
    );

    expect(password.value).not.toBe("senha-forte-123");
    expect(password.toString()).toBe(password.value);
  });

  it("deve validar a senha correta contra o hash gerado", async () => {
    const password = await Password.generateHashFromPlainText(
      "senha-forte-123",
      4,
    );

    const result = await Password.isValid("senha-forte-123", password.value);

    expect(result.isRight()).toBe(true);
  });

  it("deve rejeitar uma senha incorreta", async () => {
    const password = await Password.generateHashFromPlainText(
      "senha-forte-123",
      4,
    );

    const result = await Password.isValid("senha-errada", password.value);

    expect(result.isLeft()).toBe(true);
  });
});
