import { Cpf } from "./cpf";

describe("Cpf value object", () => {
  it("should normalize any mask to the canonical 11 digits", () => {
    expect(Cpf.normalize("529.982.247-25")).toBe("52998224725");
    expect(Cpf.normalize("529 982 247 25")).toBe("52998224725");
  });

  it("should accept valid verification digits", () => {
    expect(Cpf.isValid("529.982.247-25")).toBe(true);
    expect(Cpf.isValid("52998224725")).toBe(true);
    expect(Cpf.isValid("111.444.777-35")).toBe(true);
    expect(Cpf.isValid("123.456.789-09")).toBe(true);
  });

  it("should reject invalid verification digits", () => {
    expect(Cpf.isValid("52998224726")).toBe(false);
    expect(Cpf.isValid("12345678901")).toBe(false);
  });

  it("should reject repeated digits and incomplete values", () => {
    expect(Cpf.isValid("11111111111")).toBe(false);
    expect(Cpf.isValid("00000000000")).toBe(false);
    expect(Cpf.isValid("1234567890")).toBe(false);
    expect(Cpf.isValid("")).toBe(false);
  });

  it("should return the canonical value only when it is valid", () => {
    expect(Cpf.canonical("529.982.247-25")).toBe("52998224725");
    expect(Cpf.canonical("00000000000")).toBeNull();
  });
});
