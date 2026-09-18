import type { StaffRole } from "../../../../enterprise/entities/staff";

export interface GetStaffProfileResponse {
  staff: {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
  };
  barbershop?: {
    id: string;
    name: string;
    timezone: string;
  };
}
