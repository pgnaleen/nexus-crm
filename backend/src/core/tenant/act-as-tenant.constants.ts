export const ACT_AS_TENANT_COOKIE = "orelia_act_as_tenant";
export const ACT_AS_TENANT_TOKEN_TYPE = "act-as-tenant";
export const ACT_AS_TENANT_TTL_MS = 20 * 60 * 1000; // 20 minutes

export interface ActAsTenantTokenPayload {
  typ: typeof ACT_AS_TENANT_TOKEN_TYPE;
  actAsTenantId: string;
  actingUserId: string;
}
