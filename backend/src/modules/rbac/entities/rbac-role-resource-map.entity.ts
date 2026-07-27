import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { RbacResource } from "./rbac-resource.entity";
import { RbacRole } from "./rbac-role.entity";

@Entity("rbac_role_resource_map")
export class RbacRoleResourceMap {
  @PrimaryColumn({ type: "uuid" })
  roleId!: string;

  @ManyToOne(() => RbacRole, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role?: RbacRole;

  @PrimaryColumn({ type: "uuid" })
  resourceId!: string;

  @ManyToOne(() => RbacResource, { onDelete: "CASCADE" })
  @JoinColumn({ name: "resource_id" })
  resource?: RbacResource;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
