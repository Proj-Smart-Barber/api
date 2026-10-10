export interface BarbershopInvitationItem {
  id: string;
  email: string;
  status: string;
  role: string;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date | null;
}

export interface FetchBarbershopInvitationsResponse {
  invitations: BarbershopInvitationItem[];
}
