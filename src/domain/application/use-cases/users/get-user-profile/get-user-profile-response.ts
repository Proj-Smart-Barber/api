import type { AccountType } from "../../../../enterprise/entities/user";

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  emailVerifiedAt: string | null;
  avatarUrl?: string;
  phoneNumber?: string;
  onboardingIntent?: "OWNER" | "CLIENT" | null;
}

export interface GetUserProfileResponse {
  user: UserProfileDto;
  staff: UserProfileDto;
  serverTime: string;
}
