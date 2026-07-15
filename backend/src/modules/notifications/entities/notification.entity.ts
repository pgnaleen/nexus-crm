import { NotificationType } from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { User } from "../../users/entities/user.entity";

@Entity("notifications")
export class Notification extends AuditedTenantEntity {
  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column()
  title!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "enum", enum: NotificationType, default: NotificationType.System })
  type!: NotificationType;

  @Column({ nullable: true })
  linkUrl?: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  readAt?: Date;
}
