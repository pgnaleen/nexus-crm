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

@Entity("companies")
export class Company extends AuditedTenantEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  url?: string;

  // Logo lives in the shared `documents` table (ownerType CompanyLogo,
  // ownerId this row's id) -- see documents.module.ts.

  @Column({ type: "jsonb", nullable: true })
  brands?: string[];

  // Industries are a many-to-many through `company_industries`, deliberately
  // NOT modelled as a @ManyToMany here. updateCompany() Object.assign()s the
  // DTO onto a bare-loaded entity and saveScoped()s it -- a relation on this
  // class would put that write path squarely in CLAUDE.md's TypeORM gotcha
  // (saving an entity carrying relations nulls its FK columns). The join rows
  // are managed explicitly through CompanyIndustry's own repository instead.

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

  // Plain ISO country names from the frontend COUNTRIES list -- there is no
  // countries table, so a jsonb array matches brands/branches above rather
  // than inventing a lookup. Consumed by findDistinctCountries().
  @Column({ type: "jsonb", nullable: true })
  countries?: string[];

  @Column({ nullable: true })
  hqCityAddress?: string;

  @Column({ type: "jsonb", nullable: true })
  branches?: string[];

  @Column({ type: "uuid", nullable: true })
  parentCompanyId?: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "parent_company_id" })
  parentCompany?: Company;

  // Free-text fallback for when the parent isn't itself a Company record yet
  // -- mutually exclusive with parentCompanyId in practice, enforced at the
  // form/service layer rather than a DB constraint (either is valid alone).
  @Column({ nullable: true })
  parentCompanyName?: string;

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
