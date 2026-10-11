import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { UsersRepository } from "../../../repositories/users-repository";
import type { GetUserProfileDTO } from "./get-user-profile-dto";
import type { GetUserProfileResponse } from "./get-user-profile-response";

type GetUserProfileUseCaseResponse = Either<
  ResourceNotFoundError,
  GetUserProfileResponse
>;

export class GetUserProfileUseCase {
  constructor(private usersRepository: UsersRepository) {}

  async execute({
    userId,
  }: GetUserProfileDTO): Promise<GetUserProfileUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError());
    }

    const profile = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      emailVerifiedAt: user.emailVerifiedAt
        ? user.emailVerifiedAt.toISOString()
        : null,
      avatarUrl: user.avatarUrl,
      phoneNumber: user.phoneNumber,
      onboardingIntent: user.onboardingIntent,
    };

    return right({
      user: profile,
      staff: profile,
      serverTime: new Date().toISOString(),
    });
  }
}
