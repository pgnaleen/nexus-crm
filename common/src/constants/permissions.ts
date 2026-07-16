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
  DEAL_SOURCES_MANAGE: "deal_sources:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
