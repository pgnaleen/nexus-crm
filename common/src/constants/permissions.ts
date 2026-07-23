export const PERMISSIONS = {
  PLATFORM_IMPERSONATE_TENANT: "platform:impersonate-tenant",

  TENANTS_VIEW: "tenants:view",
  TENANTS_CREATE: "tenants:create",
  TENANTS_UPDATE: "tenants:update",
  TENANTS_DELETE: "tenants:delete",

  USERS_VIEW: "users:view",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DISABLE: "users:disable",
  USERS_DELETE: "users:delete",

  RBAC_VIEW: "rbac:view",
  RBAC_CREATE: "rbac:create",
  RBAC_UPDATE: "rbac:update",
  RBAC_DELETE: "rbac:delete",

  TEAMS_VIEW: "teams:view",
  TEAMS_CREATE: "teams:create",
  TEAMS_UPDATE: "teams:update",
  TEAMS_DELETE: "teams:delete",

  COMPANIES_CREATE: "companies:create",
  COMPANIES_VIEW: "companies:view",
  COMPANIES_UPDATE: "companies:update",
  COMPANIES_DELETE: "companies:delete",

  CONTACTS_CREATE: "contacts:create",
  CONTACTS_VIEW: "contacts:view",
  CONTACTS_UPDATE: "contacts:update",
  CONTACTS_DELETE: "contacts:delete",

  DEALS_CREATE: "deals:create",
  DEALS_VIEW: "deals:view",
  DEALS_UPDATE: "deals:update",
  DEALS_DELETE: "deals:delete",

  // Dead wildcard, superseded by MAIN_STAGE_*/SUB_STAGE_*'s own granular
  // permissions -- never wired to any endpoint. Tracked for removal as its
  // own task (Funnel plan, Task 4) since it needs zero migration (nothing
  // to move access to) unlike every other _MANAGE key removed above.
  DEAL_STAGES_MANAGE: "deal_stages:manage",

  RELATIONSHIP_TYPE_VIEW: "relationship_type:view",
  RELATIONSHIP_TYPE_CREATE: "relationship_type:create",
  RELATIONSHIP_TYPE_UPDATE: "relationship_type:update",
  RELATIONSHIP_TYPE_DELETE: "relationship_type:delete",

  RELATIONSHIP_VIEW: "relationship:view",
  RELATIONSHIP_CREATE: "relationship:create",
  RELATIONSHIP_UPDATE: "relationship:update",
  RELATIONSHIP_DELETE: "relationship:delete",

  DEAL_SOURCE_VIEW: "deal_source:view",
  DEAL_SOURCE_CREATE: "deal_source:create",
  DEAL_SOURCE_UPDATE: "deal_source:update",
  DEAL_SOURCE_DELETE: "deal_source:delete",

  MAIN_STAGE_VIEW: "main_stage:view",
  MAIN_STAGE_CREATE: "main_stage:create",
  MAIN_STAGE_UPDATE: "main_stage:update",
  MAIN_STAGE_DELETE: "main_stage:delete",

  DEPARTMENT_VIEW: "department:view",
  DEPARTMENT_CREATE: "department:create",
  DEPARTMENT_UPDATE: "department:update",
  DEPARTMENT_DELETE: "department:delete",

  SUB_STAGE_VIEW: "sub_stage:view",
  SUB_STAGE_CREATE: "sub_stage:create",
  SUB_STAGE_UPDATE: "sub_stage:update",
  SUB_STAGE_DELETE: "sub_stage:delete",

  BACKUP_CREATE: "backup:create",

  // Only VIEW exists so far -- CREATE/UPDATE/DELETE are added alongside their
  // own stories (Employee Management epic, Story 1.1 is directory view only)
  // rather than pre-seeded ahead of any endpoint that would enforce them.
  EMPLOYEES_VIEW: "employees:view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
