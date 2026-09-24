export interface GetStaffProfileResponse {
  staff: {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
  };
}
