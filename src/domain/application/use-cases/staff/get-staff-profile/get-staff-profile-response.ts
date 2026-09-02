import type { StaffRole } from "../../../../enterprise/entities/staff";

export interface GetStaffProfileResponse {
  staff: {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
    role: StaffRole;
  };
}
