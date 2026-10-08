import type { UserRole } from "../../../gateways/auth-gateway";

export interface GetUserProfileResponse {
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
    phoneNumber?: string;
    cpf: string;
    /** Tipo da conta, definido pelo servidor. */
    role: UserRole;
    emailVerified: boolean;
  };
}
