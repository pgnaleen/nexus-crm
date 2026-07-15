import { ReminderRepeatType, ReminderStatus } from "../enums";

export interface IReminder {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  remindAt: string;
  repeatType: ReminderRepeatType;
  remindableType?: string | null;
  remindableId?: string | null;
  status: ReminderStatus;
  notifyBeforeMinutes?: number | null;
}
