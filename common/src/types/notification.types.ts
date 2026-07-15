import { NotificationType } from "../enums";

export interface INotification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
}
