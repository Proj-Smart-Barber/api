export interface GetUserProfileResponse {
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
    phoneNumber?: string;
  };
}
