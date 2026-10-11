import { validateNewPassword } from "./password-policy";

describe("Password Policy", () => {
  it("should validate unicode code points correctly", () => {
    const validEmoji = "😀".repeat(15);
    const invalidEmoji = "😀".repeat(14);

    expect(validateNewPassword(validEmoji).valid).toBe(true);
    expect(validateNewPassword(invalidEmoji).valid).toBe(false);
  });

  it("should enforce max 72 bytes UTF-8", () => {
    const valid72 = "a".repeat(72);
    const invalid73 = "a".repeat(73);

    expect(validateNewPassword(valid72).valid).toBe(true);
    expect(validateNewPassword(invalid73).valid).toBe(false);
  });

  it("should reject password with fewer than 15 characters", () => {
    expect(validateNewPassword("short-pass").valid).toBe(false);
  });
});
