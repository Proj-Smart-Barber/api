import { compare, hash } from "bcryptjs";
import { type Either, left, right } from "../../../../core/logic/either";

export class Password {
  public value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString() {
    return this.value;
  }

  static create(password: string) {
    return new Password(password);
  }

  static async generateHashFromPlainText(password: string, round: number) {
    const passwordHash = await hash(password, round);

    return new Password(passwordHash);
  }

  static async isValid(
    password: string,
    hash: string,
  ): Promise<Either<false, true>> {
    const passwordMatchWithHash = await compare(password, hash);

    if (!passwordMatchWithHash) {
      return left(false);
    }

    return right(true);
  }
}
