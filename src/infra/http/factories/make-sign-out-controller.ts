import type { Controller } from "../../../core/infra/controller";
import { SignOutUseCase } from "../../../domain/application/use-cases/users/sign-out/sign-out";
import { DrizzleRefreshTokensRepository } from "../../drizzle/repositories/drizzle-refresh-tokens-repository";
import { SignOutController } from "../controllers/sign-out-controller";

export function makeSignOutController(): Controller {
  const refreshTokensRepository = new DrizzleRefreshTokensRepository();
  const signOutUseCase = new SignOutUseCase(refreshTokensRepository);
  const signOutController = new SignOutController(signOutUseCase);

  return signOutController;
}
