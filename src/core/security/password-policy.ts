export function validateNewPassword(password: string): {
  valid: boolean;
  error?: string;
} {
  const codePoints = [...password].length;
  const byteLength = Buffer.byteLength(password, "utf8");

  if (codePoints < 15) {
    return {
      valid: false,
      error: "A senha deve ter pelo menos 15 caracteres.",
    };
  }

  if (byteLength > 72) {
    return {
      valid: false,
      error: "A senha é longa demais. Use uma frase mais curta.",
    };
  }

  return { valid: true };
}
