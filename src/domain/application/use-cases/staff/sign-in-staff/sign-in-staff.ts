import { sign } from "jsonwebtoken";
import { left, right, type Either } from "../../../../../core/logic/either";
import { Password } from "../../../../enterprise/entities/value-objects/password";
import { InvalidCredentialsError } from "../../_errors/invalid-credentials-error";
import type { StringValue } from "ms";
import type { StaffsRepository } from "../../../repositories/staffs-repository";
import type { SignInStaffDTO } from "./sign-in-staff-dto";
import type { SignInStaffResponse } from "./sign-in-staff-response";

type SignInStaffUseCaseResponse = Either<
  InvalidCredentialsError,
  SignInStaffResponse
>;

export class SignInStaffUseCase {
  constructor(private staffsRepository: StaffsRepository) {}

  async execute({
    email,
    password,
  }: SignInStaffDTO): Promise<SignInStaffUseCaseResponse> {
    const staff = await this.staffsRepository.findByEmail(email);

    if (!staff) {
      return left(new InvalidCredentialsError());
    }

    const passwordMatch = await Password.isValid(
      password,
      staff.password.toString(),
    );

    if (passwordMatch.isLeft()) {
      return left(new InvalidCredentialsError());
    }

    const token = sign({ sub: staff.id.toString() }, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN! as StringValue,
    });

    return right({
      access_token: token,
    });
  }
}
