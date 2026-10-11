export interface FetchUserNotificationsDTO {
  userId: string;
  cursor?: string;
  limit?: number;
}
