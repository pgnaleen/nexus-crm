import { ReminderRepeatType, ReminderStatus } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { User } from "../../users/entities/user.entity";

@Entity("reminders")
export class Reminder extends AuditedTenantEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column()
  title!: string;

  @Column({ type: "timestamptz" })
  remindAt!: Date;

  @Column({ type: "enum", enum: ReminderRepeatType, default: ReminderRepeatType.None })
  repeatType!: ReminderRepeatType;

  // Polymorphic reference — a reminder can attach to any entity type (a Deal,
  // a Tender, etc.), so no FK constraint is possible here; the target table
  // varies per row.
  @Column({ nullable: true })
  remindableType?: string;

  @Column({ type: "uuid", nullable: true })
  remindableId?: string;

  @Column({ type: "enum", enum: ReminderStatus, default: ReminderStatus.Pending })
  status!: ReminderStatus;

  @Column({ type: "int", nullable: true })
  notifyBeforeMinutes?: number;
}
