export const PERMISSIONS = {
  PLATFORM_IMPERSONATE_TENANT: "platform:impersonate-tenant",

  TENANTS_MANAGE: "tenants:manage",
  TENANTS_VIEW: "tenants:view",
  TENANTS_CREATE: "tenants:create",
  TENANTS_UPDATE: "tenants:update",
  TENANTS_DELETE: "tenants:delete",

  USERS_MANAGE: "users:manage",
  USERS_VIEW: "users:view",
  USERS_CREATE: "users:create",
  USERS_READ: "users:read",
  USERS_UPDATE: "users:update",
  USERS_DISABLE: "users:disable",
  USERS_DELETE: "users:delete",

  RBAC_MANAGE: "rbac:manage",
  RBAC_VIEW: "rbac:view",
  RBAC_CREATE: "rbac:create",
  RBAC_UPDATE: "rbac:update",
  RBAC_DELETE: "rbac:delete",

  TEAMS_MANAGE: "teams:manage",
  TEAMS_VIEW: "teams:view",
  TEAMS_CREATE: "teams:create",
  TEAMS_UPDATE: "teams:update",
  TEAMS_DELETE: "teams:delete",

  COMPANIES_CREATE: "companies:create",
  COMPANIES_READ: "companies:read",
  COMPANIES_UPDATE: "companies:update",
  COMPANIES_DELETE: "companies:delete",

  CONTACTS_CREATE: "contacts:create",
  CONTACTS_READ: "contacts:read",
  CONTACTS_UPDATE: "contacts:update",
  CONTACTS_DELETE: "contacts:delete",

  DEALS_CREATE: "deals:create",
  DEALS_READ: "deals:read",
  DEALS_UPDATE: "deals:update",
  DEALS_DELETE: "deals:delete",
  DEALS_STAGE_UPDATE: "deals:stage:update",

  DEAL_STAGES_MANAGE: "deal_stages:manage",

  RELATIONSHIP_TYPE_MANAGE: "relationship_type:manage",
  RELATIONSHIP_TYPE_CREATE: "relationship_type:create",
  RELATIONSHIP_TYPE_UPDATE: "relationship_type:update",
  RELATIONSHIP_TYPE_DELETE: "relationship_type:delete",

  RELATIONSHIP_MANAGE: "relationship:manage",
  RELATIONSHIP_VIEW: "relationship:view",
  RELATIONSHIP_CREATE: "relationship:create",
  RELATIONSHIP_UPDATE: "relationship:update",
  RELATIONSHIP_DELETE: "relationship:delete",

  DEAL_SOURCE_MANAGE: "deal_source:manage",
  DEAL_SOURCE_VIEW: "deal_source:view",
  DEAL_SOURCE_CREATE: "deal_source:create",
  DEAL_SOURCE_UPDATE: "deal_source:update",
  DEAL_SOURCE_DELETE: "deal_source:delete",

  MAIN_STAGE_MANAGE: "main_stage:manage",
  MAIN_STAGE_VIEW: "main_stage:view",
  MAIN_STAGE_CREATE: "main_stage:create",
  MAIN_STAGE_UPDATE: "main_stage:update",
  MAIN_STAGE_DELETE: "main_stage:delete",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
