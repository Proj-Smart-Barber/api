import type { RequestHeaders } from "../../../gateways/auth-gateway";

export interface ChangePasswordDTO {
  userId: string;
  headers?: RequestHeaders;
  currentPassword: string;
  newPassword: string;
}
