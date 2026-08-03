// Turns a raw audit_logs.changes JSON payload into a readable summary line
// plus a list of per-field detail lines. Must never throw and never render
// blank -- an unrecognised shape always falls back to something, down to raw
// JSON as the last resort. See spec-activity-log.md section E for the full
// shape table and classification order this mirrors exactly.

const ENTITY_LABELS: Record<string, string> = {
  tenant: "Tenant",
  user: "User",
  rbac_role: "Role",
  team: "Team",
  department: "Department",
  deal_source: "Deal Source",
  main_stage: "Main Stage",
  sub_stage: "Sub Stage",
  relationship_type: "Relationship Type",
  relationship_party: "Relationship",
  relationship_company_contact_map: "Relationship Tag",
  company: "Company",
  contact: "Contact",
  deal: "Deal",
  deal_partner: "Deal Partner",
  deal_document: "Deal Document",
  deal_note: "Deal Note",
  // deal_tender_detail deliberately NOT mapped -- exercises the humanised
  // snake_case fallback (spec-activity-log.md Edge Case 6 uses this exact
  // entity_type as its own example: "Deal Tender Details").
  employee: "Employee",
  certification: "Certification",
  priority_task: "Priority Task",
  priority_task_share: "Priority Task Share",
};

// Module-specific phrasing for join-table entities, where entity_id is the
// join row's own id -- an id-based fallback like "#abc12345" is meaningless
// for these, so they're built from the snapshot's own keys instead.
const JOIN_TABLE_ENTITY_TYPES = new Set(["deal_partner", "priority_task_share", "relationship_company_contact_map"]);

// Known boolean-marker keys get dedicated phrasing; anything else falls back
// to a generic "Field Name: Yes/No" line rather than being dropped.
const FLAG_PHRASES: Record<string, string> = {
  passwordReset: "Reset the password",
  passwordSelfChanged: "Changed their own password",
  lockoutCleared: "Cleared an active lockout",
};

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  dealCode: "Deal Code",
  loggingEmail: "Login Email",
  displayName: "Display Name",
  mustChangePassword: "Must Change Password",
  roleIds: "Roles",
  resourceIds: "Permissions",
  addedRoleIds: "Roles Added",
  employeeId: "Employee",
  mainStageId: "Main Stage",
  currentStageId: "Sub Stage",
  ownerId: "Owner",
};

// Keys tried in priority order to build an identifying label for an
// insert/delete headline (e.g. "Created Deal — Acme Renewal").
const IDENTIFYING_KEYS = ["name", "displayName", "dealCode", "username", "fullName", "title"];

function humanizeSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function humanizeCamelCase(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? humanizeSnakeCase(entityType);
}

function fieldLabel(key: string): string {
  return FIELD_LABEL_OVERRIDES[key] ?? humanizeCamelCase(key);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length === 0 ? "(none)" : value.map((item) => formatValue(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isOldNewPair(value: unknown): value is { old: unknown; new: unknown } {
  return !!value && typeof value === "object" && !Array.isArray(value) && "old" in value && "new" in value;
}

export type ChangeLineKind = "diff" | "listDelta" | "flag" | "snapshot";

export interface ChangeLine {
  kind: ChangeLineKind;
  key: string;
  label: string;
  detail: string;
}

export interface RenderedAuditEntry {
  headline: string;
  lines: ChangeLine[];
}

function classifyKey(key: string, value: unknown): ChangeLineKind {
  if (isOldNewPair(value)) {
    return Array.isArray(value.old) && Array.isArray(value.new) ? "listDelta" : "diff";
  }
  if (typeof value === "boolean") return "flag";
  if (Array.isArray(value) && /^(added|removed)/i.test(key)) return "listDelta";
  return "snapshot";
}

function renderLine(key: string, value: unknown): ChangeLine {
  const kind = classifyKey(key, value);
  const label = fieldLabel(key);

  if (kind === "diff") {
    const { old: oldValue, new: newValue } = value as { old: unknown; new: unknown };
    return { kind, key, label, detail: `${formatValue(oldValue)} → ${formatValue(newValue)}` };
  }
  if (kind === "listDelta") {
    if (isOldNewPair(value)) {
      const before = new Set((value.old as unknown[]).map(String));
      const after = new Set((value.new as unknown[]).map(String));
      const added = [...after].filter((item) => !before.has(item));
      const removed = [...before].filter((item) => !after.has(item));
      const parts: string[] = [];
      if (added.length > 0) parts.push(`+${added.length}`);
      if (removed.length > 0) parts.push(`−${removed.length}`);
      return { kind, key, label, detail: parts.length > 0 ? parts.join(", ") : "(no change)" };
    }
    return { kind, key, label, detail: formatValue(value) };
  }
  if (kind === "flag") {
    return { kind, key, label: FLAG_PHRASES[key] ?? label, detail: value ? "Yes" : "No" };
  }
  return { kind, key, label, detail: formatValue(value) };
}

function identifyingLabel(snapshot: Record<string, unknown>): string | null {
  for (const key of IDENTIFYING_KEYS) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function joinTablePhrase(entityType: string, action: string, changes: Record<string, unknown>): string {
  const noun = entityType === "deal_partner" ? "a partner to a deal"
    : entityType === "priority_task_share" ? "a task share"
    : "a relationship tag";
  if (action === "insert") return `Linked ${noun}`;
  if (action === "delete") return `Unlinked ${noun}`;
  return `Updated ${entityLabel(entityType)}`;
}

// Never throws: an unparseable/unexpected `changes` shape still produces a
// headline and falls back to raw JSON for the single line, rather than
// crashing the whole row or the page.
export function renderAuditEntry(
  action: "insert" | "update" | "delete",
  entityType: string,
  changes: Record<string, unknown> | null,
): RenderedAuditEntry {
  const label = entityLabel(entityType);

  if (!changes || Object.keys(changes).length === 0) {
    const verb = action === "insert" ? "Created" : action === "delete" ? "Deleted" : "Updated";
    return { headline: `${verb} ${label}`, lines: [] };
  }

  if (JOIN_TABLE_ENTITY_TYPES.has(entityType)) {
    return { headline: joinTablePhrase(entityType, action, changes), lines: [] };
  }

  try {
    const lines = Object.entries(changes).map(([key, value]) => renderLine(key, value));

    if (action === "insert" || action === "delete") {
      const verb = action === "insert" ? "Created" : "Deleted";
      const identifier = identifyingLabel(changes);
      const headline = identifier ? `${verb} ${label} — ${identifier}` : `${verb} ${label}`;
      return { headline, lines };
    }

    // update: a single boolean-flag change gets its own phrase as the
    // headline (e.g. "Reset the password") instead of a generic "Updated X".
    if (lines.length === 1 && lines[0]!.kind === "flag") {
      return { headline: lines[0]!.label, lines: [] };
    }

    return { headline: `Updated ${label}`, lines };
  } catch {
    // Genuinely unparseable shape -- still never blank.
    return { headline: `${action === "insert" ? "Created" : action === "delete" ? "Deleted" : "Updated"} ${label}`, lines: [] };
  }
}
