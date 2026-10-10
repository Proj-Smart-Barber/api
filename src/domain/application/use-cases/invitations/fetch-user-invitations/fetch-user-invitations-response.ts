export interface UserInvitationItem {
  id: string;
  barbershopId: string;
  barbershopName: string | null;
  status: string;
  role: string;
  expiresAt: Date;
  createdAt: Date | null;
}

export interface FetchUserInvitationsResponse {
  invitations: UserInvitationItem[];
}
