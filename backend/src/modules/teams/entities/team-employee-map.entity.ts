import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Employee } from "../../employees/entities/employee.entity";
import { Team } from "./team.entity";

@Entity("teams_employee_map")
export class TeamsEmployeeMap {
  @PrimaryColumn({ type: "uuid" })
  teamId!: string;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team?: Team;

  @PrimaryColumn({ type: "uuid" })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: "CASCADE" })
  @JoinColumn({ name: "employee_id" })
  employee?: Employee;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "uuid", nullable: true })
  createdBy?: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdByUser?: User;
}
