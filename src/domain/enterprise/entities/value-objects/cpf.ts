import { type Either, left, right } from "../../../../core/logic/either";
import { InvalidCpfError } from "../../errors/invalid-cpf-error";

const CPF_LENGTH = 11;

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function hasAllSameDigits(digits: string): boolean {
  return /^(\d)\1{10}$/.test(digits);
}

function calculateCheckDigit(digits: string): number {
  const factor = digits.length + 1;

  const sum = digits
    .split("")
    .reduce(
      (accumulator, digit, index) =>
        accumulator + Number(digit) * (factor - index),
      0,
    );

  const remainder = (sum * 10) % 11;

  return remainder === 10 ? 0 : remainder;
}

export class Cpf {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  get formatted(): string {
    return this.value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  isEqualTo(other: Cpf): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  static normalize(raw: string): string {
    return stripNonDigits(raw);
  }

  static isValid(raw: string): boolean {
    const digits = stripNonDigits(raw);

    if (digits.length !== CPF_LENGTH || hasAllSameDigits(digits)) {
      return false;
    }

    const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9));

    if (firstCheckDigit !== Number(digits[9])) {
      return false;
    }

    const secondCheckDigit = calculateCheckDigit(digits.slice(0, 10));

    return secondCheckDigit === Number(digits[10]);
  }

  static create(raw: string): Either<InvalidCpfError, Cpf> {
    if (!Cpf.isValid(raw)) {
      return left(new InvalidCpfError());
    }

    return right(new Cpf(stripNonDigits(raw)));
  }
}
