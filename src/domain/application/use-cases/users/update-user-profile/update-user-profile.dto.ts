export interface UpdateUserProfileDTO {
  userId: string;
  name?: string;
  phoneNumber?: string | null;
}

export interface UpdateUserProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    accountType: string;
    emailVerifiedAt: string | null;
    avatarUrl?: string;
    phoneNumber?: string;
    onboardingIntent?: "OWNER" | "CLIENT" | null;
  };
  serverTime: string;
}
