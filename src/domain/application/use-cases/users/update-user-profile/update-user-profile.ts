import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { UsersRepository } from "../../../repositories/users-repository";
import type {
  UpdateUserProfileDTO,
  UpdateUserProfileResponse,
} from "./update-user-profile.dto";

type UpdateUserProfileUseCaseResponse = Either<
  ResourceNotFoundError,
  UpdateUserProfileResponse
>;

export class UpdateUserProfileUseCase {
  constructor(private usersRepository: UsersRepository) {}

  async execute({
    userId,
    name,
    phoneNumber,
  }: UpdateUserProfileDTO): Promise<UpdateUserProfileUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError());
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (phoneNumber !== undefined) {
      user.phoneNumber = phoneNumber ? phoneNumber.trim() : undefined;
    }

    const updatedUser = await this.usersRepository.update(user);

    return right({
      user: {
        id: updatedUser.id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        accountType: updatedUser.accountType,
        emailVerifiedAt: updatedUser.emailVerifiedAt
          ? updatedUser.emailVerifiedAt.toISOString()
          : null,
        avatarUrl: updatedUser.avatarUrl,
        phoneNumber: updatedUser.phoneNumber,
        onboardingIntent: updatedUser.onboardingIntent,
      },
      serverTime: new Date().toISOString(),
    });
  }
}
