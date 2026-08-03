// Items are gated by resource *prefix* (e.g. "department"), not a specific permission key --
// a user has access if they hold ANY permission under that prefix (view/create/update/delete,
// or manage while it still exists on some resources). This mirrors the same grouping logic
// RolePermissionsDialog already uses, and means callers never need editing again just because a
// resource's specific permission set changes (e.g. Manage being removed).
export function hasAnyPermissionForPrefix(permissions: string[], prefix: string | string[]): boolean {
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  return prefixes.some((p) => permissions.some((permission) => permission.startsWith(`${p}:`)));
}
