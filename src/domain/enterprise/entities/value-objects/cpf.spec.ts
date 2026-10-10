import { InvalidCpfError } from "../../errors/invalid-cpf-error";
import { Cpf } from "./cpf";

describe("Cpf", () => {
  describe("isValid", () => {
    it("should accept a valid unformatted CPF", () => {
      expect(Cpf.isValid("11144477735")).toBe(true);
      expect(Cpf.isValid("52998224725")).toBe(true);
      expect(Cpf.isValid("12345678909")).toBe(true);
    });

    it("should accept a valid formatted CPF", () => {
      expect(Cpf.isValid("111.444.777-35")).toBe(true);
      expect(Cpf.isValid("529.982.247-25")).toBe(true);
    });

    it("should reject a CPF with the wrong length", () => {
      expect(Cpf.isValid("1234567890")).toBe(false);
      expect(Cpf.isValid("123456789012")).toBe(false);
      expect(Cpf.isValid("")).toBe(false);
    });

    it("should reject a CPF made only of the same digit", () => {
      expect(Cpf.isValid("00000000000")).toBe(false);
      expect(Cpf.isValid("11111111111")).toBe(false);
      expect(Cpf.isValid("99999999999")).toBe(false);
    });

    it("should reject a CPF with invalid check digits", () => {
      expect(Cpf.isValid("12345678900")).toBe(false);
      expect(Cpf.isValid("11144477736")).toBe(false);
    });

    it("should reject a CPF with non-numeric characters", () => {
      expect(Cpf.isValid("abcdefghijk")).toBe(false);
    });
  });

  describe("create", () => {
    it("should create a Cpf storing only the digits", () => {
      const result = Cpf.create("111.444.777-35");

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeInstanceOf(Cpf);
      expect((result.value as Cpf).value).toBe("11144477735");
    });

    it("should normalize a CPF with spaces", () => {
      const result = Cpf.create("111 444 777 35");

      expect(result.isRight()).toBe(true);
      expect((result.value as Cpf).value).toBe("11144477735");
    });

    it("should not create a Cpf when the value is invalid", () => {
      const result = Cpf.create("00000000000");

      expect(result.isLeft()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidCpfError);
    });
  });

  describe("formatted", () => {
    it("should return the mask XXX.XXX.XXX-XX", () => {
      const cpf = Cpf.create("11144477735").value as Cpf;

      expect(cpf.formatted).toBe("111.444.777-35");
    });
  });

  describe("isEqualTo", () => {
    it("should consider formatted and unformatted CPFs as equal", () => {
      const formatted = Cpf.create("111.444.777-35").value as Cpf;
      const unformatted = Cpf.create("11144477735").value as Cpf;

      expect(formatted.isEqualTo(unformatted)).toBe(true);
    });

    it("should not consider different CPFs as equal", () => {
      const first = Cpf.create("11144477735").value as Cpf;
      const second = Cpf.create("52998224725").value as Cpf;

      expect(first.isEqualTo(second)).toBe(false);
    });
  });
});
