interface CpfProps {
  value: string;
}

/**
 * CPF canônico: somente dígitos (11), com validação de dígitos verificadores.
 * Toda identificação de conta usa a forma canônica — a comparação nunca
 * depende de máscara.
 */
export class Cpf {
  private constructor(private readonly props: CpfProps) {}

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }

  /** Remove tudo que não for dígito. */
  static normalize(raw: string): string {
    return raw.replace(/\D/g, "");
  }

  static isValid(raw: string): boolean {
    const cpf = Cpf.normalize(raw);

    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    const digits = cpf.split("").map(Number);

    const firstVerifier = Cpf.computeVerifier(digits.slice(0, 9), 10);
    if (firstVerifier !== digits[9]) return false;

    const secondVerifier = Cpf.computeVerifier(digits.slice(0, 10), 11);
    return secondVerifier === digits[10];
  }

  /** Retorna a forma canônica ou `null` quando o CPF é inválido. */
  static canonical(raw: string): string | null {
    const normalized = Cpf.normalize(raw);
    return Cpf.isValid(normalized) ? normalized : null;
  }

  private static computeVerifier(
    digits: number[],
    initialWeight: number,
  ): number {
    const sum = digits.reduce(
      (acc, digit, index) => acc + digit * (initialWeight - index),
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }
}
