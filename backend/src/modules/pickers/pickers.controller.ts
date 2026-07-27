import {
  CompanyPickerResponse,
  ContactPickerResponse,
  DepartmentPickerResponse,
  EmployeeLinkPickerResponse,
  EmployeePickerResponse,
  IndustryResponse,
  PERMISSIONS,
  RelationshipRolePickerResponse,
  SystemRole,
  UserPickerResponse,
} from "@orelia/common";
import { Controller, Get, Logger, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CompaniesService } from "../companies/companies.service";
import { ContactsService } from "../contacts/contacts.service";
import { DepartmentsService } from "../departments/departments.service";
import { EmployeesService } from "../employees/employees.service";
import { IndustriesService } from "../industries/industries.service";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { RelationshipTypesService } from "../relationship-types/relationship-types.service";
import { UsersService } from "../users/users.service";

// Held by anyone who can see the Relationships section at all -- any one of
// these four is enough, since the parties list itself decides what a given
// permission level can do with the data.
const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

// Companies/Employees/Industries pickers are consumed by BOTH the Deals/Funnel
// screens (Add Deal dialog, department filter) and the Relationships party
// forms -- gate on whichever set of permissions the actual caller holds, per
// CLAUDE.md's picker rule (never the resource's own admin permission).
const DEALS_OR_RELATIONSHIP_PERMISSION = [PERMISSIONS.DEALS_VIEW, ...ANY_RELATIONSHIP_PERMISSION];

/**
 * System-internal ("picker") routes -- every one below is a narrow id/name
 * lookup for a dropdown/search-select elsewhere in the app, reachable by any
 * authenticated user who holds the *consuming* screen's permission, never the
 * looked-up resource's own admin permission. See CLAUDE.md's "RBAC Routes vs.
 * System-Internal (Picker) Routes" section.
 */
@Controller("pickers")
export class PickersController {
  private readonly logger = new Logger(PickersController.name);

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly departmentsService: DepartmentsService,
    private readonly employeesService: EmployeesService,
    private readonly industriesService: IndustriesService,
    private readonly relationshipTypesService: RelationshipTypesService,
    private readonly usersService: UsersService,
  ) {}

  // Resolves every type this tenant flagged for `role` (multiple types may
  // share a role), then returns the deduplicated union of companies/contacts
  // tagged under any of them. `configured: false` means no type is flagged
  // yet (distinct from `configured: true` with empty arrays, which means at
  // least one type is flagged but nothing's tagged under it).
  private async findRolePickerParties(role: SystemRole): Promise<RelationshipRolePickerResponse> {
    const typeIds = await this.relationshipTypesService.findSystemRoleTypeIds(role);
    if (typeIds.length === 0) {
      this.logger.debug(`No relationship type flagged as ${role} for this tenant`);
      return { configured: false, companies: [], contacts: [] };
    }
    const [companies, contacts] = await Promise.all([
      this.companiesService.findPickerForRelationshipType(typeIds),
      this.contactsService.findPickerForRelationshipType(typeIds),
    ]);
    return {
      configured: true,
      companies: companies.map((company) => ({ id: company.id, name: company.name, country: company.country ?? null })),
      contacts: contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        companyId: contact.companyId ?? null,
      })),
    };
  }

  // Gated on DEALS_VIEW only -- the only real caller is Add Deal's Customer field.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get("deal-customer-parties")
  async findDealCustomerParties(): Promise<RelationshipRolePickerResponse> {
    this.logger.debug("GET /pickers/deal-customer-parties called");
    try {
      const result = await this.findRolePickerParties(SystemRole.Customer);
      this.logger.debug(
        `GET /pickers/deal-customer-parties returning configured=${result.configured}, ${result.companies.length} company(ies), ${result.contacts.length} contact(s)`,
      );
      return result;
    } catch (err) {
      this.logger.error(`GET /pickers/deal-customer-parties failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Gated on DEALS_VIEW only -- the only real caller is Add Deal's Partners field.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get("deal-partner-parties")
  async findDealPartnerParties(): Promise<RelationshipRolePickerResponse> {
    this.logger.debug("GET /pickers/deal-partner-parties called");
    try {
      const result = await this.findRolePickerParties(SystemRole.Partner);
      this.logger.debug(
        `GET /pickers/deal-partner-parties returning configured=${result.configured}, ${result.companies.length} company(ies), ${result.contacts.length} contact(s)`,
      );
      return result;
    } catch (err) {
      this.logger.error(`GET /pickers/deal-partner-parties failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Also consumed by the Add/Edit Employee forms' department dropdown
  // (Stories 1.2/1.4) -- an EMPLOYEES_CREATE or EMPLOYEES_UPDATE holder with
  // no Deals access would otherwise 403 here, same class of gap already
  // fixed for companies/contacts/employees above.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW, PERMISSIONS.EMPLOYEES_CREATE, PERMISSIONS.EMPLOYEES_UPDATE])
  @Get("departments")
  async findDepartments(): Promise<DepartmentPickerResponse[]> {
    this.logger.debug("GET /pickers/departments called");
    try {
      const departments = await this.departmentsService.findPicker();
      this.logger.debug(`GET /pickers/departments returning ${departments.length} row(s)`);
      return departments.map((department) => ({ id: department.id, name: department.name }));
    } catch (err) {
      this.logger.error(`GET /pickers/departments failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(DEALS_OR_RELATIONSHIP_PERMISSION)
  @Get("companies")
  async findCompanies(
    @Query("search") search?: string,
    @Query("excludeId") excludeId?: string,
  ): Promise<CompanyPickerResponse[]> {
    this.logger.debug(`GET /pickers/companies called (search=${search ?? "none"}, excludeId=${excludeId ?? "none"})`);
    try {
      const companies = await this.companiesService.findPicker(search, excludeId);
      this.logger.debug(`GET /pickers/companies returning ${companies.length} row(s)`);
      return companies.map((company) => ({ id: company.id, name: company.name, country: company.country ?? null }));
    } catch (err) {
      this.logger.error(`GET /pickers/companies failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get("company-countries")
  async findCompanyCountries(): Promise<string[]> {
    this.logger.debug("GET /pickers/company-countries called");
    try {
      const countries = await this.companiesService.findCountries();
      this.logger.debug(`GET /pickers/company-countries returning ${countries.length} row(s)`);
      return countries;
    } catch (err) {
      this.logger.error(`GET /pickers/company-countries failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Gated on DEALS_VIEW, not CONTACTS_VIEW -- the only real caller today is
  // the Deals/Funnel Add Deal dialog. Fixed from the old /contacts/picker
  // route, which was wrongly gated on the resource's own admin permission.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get("contacts")
  async findContacts(@Query("companyId") companyId?: string): Promise<ContactPickerResponse[]> {
    this.logger.debug(`GET /pickers/contacts called (companyId=${companyId ?? "none"})`);
    try {
      const contacts = await this.contactsService.findPicker(companyId);
      this.logger.debug(`GET /pickers/contacts returning ${contacts.length} row(s)`);
      return contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        companyId: contact.companyId ?? null,
      }));
    } catch (err) {
      this.logger.error(`GET /pickers/contacts failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // Story 1.6 -- options for User Management's "link to Employee" picker:
  // unlinked employees only, plus (when editing, via forUserId) the employee
  // currently linked to that user. Gated on the *consumer's* permissions
  // (Add/Edit User), per CLAUDE.md's picker rule.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_UPDATE])
  @Get("employees/linkable")
  async findLinkableEmployees(@Query("forUserId") forUserId?: string): Promise<EmployeeLinkPickerResponse[]> {
    this.logger.debug(`GET /pickers/employees/linkable called (forUserId=${forUserId ?? "none"})`);
    try {
      const employees = await this.employeesService.findLinkable(forUserId);
      this.logger.debug(`GET /pickers/employees/linkable returning ${employees.length} row(s)`);
      return employees.map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        employeeEmail: employee.employeeEmail ?? null,
      }));
    } catch (err) {
      this.logger.error(`GET /pickers/employees/linkable failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(DEALS_OR_RELATIONSHIP_PERMISSION)
  @Get("employees")
  async findEmployees(): Promise<EmployeePickerResponse[]> {
    this.logger.debug("GET /pickers/employees called");
    try {
      const employees = await this.employeesService.findPicker();
      this.logger.debug(`GET /pickers/employees returning ${employees.length} row(s)`);
      return employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }));
    } catch (err) {
      this.logger.error(`GET /pickers/employees failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(DEALS_OR_RELATIONSHIP_PERMISSION)
  @Get("industries")
  async findIndustries(): Promise<IndustryResponse[]> {
    this.logger.debug("GET /pickers/industries called");
    try {
      const industries = await this.industriesService.findAll();
      this.logger.debug(`GET /pickers/industries returning ${industries.length} row(s)`);
      return industries.map((industry) => ({ id: industry.id, name: industry.name }));
    } catch (err) {
      this.logger.error(`GET /pickers/industries failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  // No PermissionsGuard/RequirePermission -- gated by the global JwtAuthGuard
  // only, matching Priority Tasks' own "authenticated user, no RBAC
  // permission" access model (Stories 1.5 Share / 1.6 Delegate need to pick
  // any other active user in the tenant, and the feature itself has no
  // permission to check against).
  @Get("users")
  async findUsers(@CurrentUser() user: AuthenticatedUser): Promise<UserPickerResponse[]> {
    this.logger.debug(`GET /pickers/users called by ${user.sub}`);
    try {
      const users = await this.usersService.findPicker(user.sub);
      this.logger.debug(`GET /pickers/users returning ${users.length} row(s)`);
      return users.map((u) => ({ id: u.id, displayName: u.displayName }));
    } catch (err) {
      this.logger.error(`GET /pickers/users failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
