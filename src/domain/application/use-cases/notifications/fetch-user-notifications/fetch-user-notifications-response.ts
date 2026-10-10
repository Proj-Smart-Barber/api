export interface UserNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  readAt: Date | null;
  scheduledAt: Date;
  createdAt: Date | null;
}

export interface FetchUserNotificationsResponse {
  notifications: UserNotificationItem[];
}
