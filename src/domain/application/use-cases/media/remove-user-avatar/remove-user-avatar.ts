import { type Either, left, right } from "../../../../../core/logic/either";
import type { UsersRepository } from "../../../repositories/users-repository";

export interface RemoveUserAvatarDTO {
  userId: string;
}

export interface RemoveUserAvatarResponse {
  success: boolean;
}

export class RemoveUserAvatarUseCase {
  constructor(private usersRepository: UsersRepository) {}

  async execute(dto: RemoveUserAvatarDTO): Promise<Either<Error, RemoveUserAvatarResponse>> {
    const user = await this.usersRepository.findById(dto.userId);
    if (!user) {
      return left(new Error("Usuário não encontrado."));
    }

    user.avatarUrl = undefined;
    await this.usersRepository.update(user);

    return right({ success: true });
  }
}
