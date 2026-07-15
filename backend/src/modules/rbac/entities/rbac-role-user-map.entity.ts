import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { RbacRole } from "./rbac-role.entity";

@Entity("rbac_role_user_map")
export class RbacRoleUserMap {
  @PrimaryColumn({ type: "uuid" })
  roleId!: string;

  @ManyToOne(() => RbacRole, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role?: RbacRole;

  @PrimaryColumn({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
