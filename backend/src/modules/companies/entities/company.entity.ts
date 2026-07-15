import {
  AccountTier,
  CreditStatus,
  EmployeeCountBand,
  FiscalYearEndMonth,
  Region,
  RevenueBand,
  Sector,
} from "@orelia/common";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditedTenantEntity } from "../../../core/tenant";
import { Employee } from "../../employees/entities/employee.entity";
import { Industry } from "../../tenants/entities/industry.entity";

@Entity("companies")
export class Company extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  url?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ type: "jsonb", nullable: true })
  brands?: string[];

  @Column({ type: "uuid", nullable: true })
  industryId?: string;

  @ManyToOne(() => Industry, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "industry_id" })
  industry?: Industry;

  @Column({ nullable: true })
  subIndustry?: string;

  @Column({ type: "enum", enum: AccountTier, nullable: true })
  accountTier?: AccountTier;

  @Column({ type: "enum", enum: EmployeeCountBand, nullable: true })
  employeeCount?: EmployeeCountBand;

  @Column({ type: "enum", enum: RevenueBand, nullable: true })
  revenueBand?: RevenueBand;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  annualSpend?: number;

  @Column({ type: "enum", enum: Sector, nullable: true })
  sector?: Sector;

  @Column({ nullable: true })
  stockTicker?: string;

  @Column({ type: "enum", enum: FiscalYearEndMonth, nullable: true })
  fiscalYearEnd?: FiscalYearEndMonth;

  @Column({ type: "enum", enum: Region, nullable: true })
  region?: Region;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  hqCityAddress?: string;

  @Column({ type: "jsonb", nullable: true })
  branches?: string[];

  @Column({ type: "uuid", nullable: true })
  parentCompanyId?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "parent_company_id" })
  parentCompany?: Company;

  @Column({ type: "enum", enum: CreditStatus, nullable: true })
  credit?: CreditStatus;

  @Column({ type: "uuid", nullable: true })
  territoryOwnerId?: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "territory_owner_id" })
  territoryOwner?: Employee;

  @Column({ type: "text", nullable: true })
  territoryNotes?: string;
}
