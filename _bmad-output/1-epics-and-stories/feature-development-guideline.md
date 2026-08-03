# New Feature Development Guideline

The checklist to follow, in order, every time a new feature is built in this project — so
established rules don't need to be repeated each time, and nothing gets missed. Each numbered
rule links back to where it's defined in full (`CLAUDE.md` for standing rules, memory for
workflow preferences) — this file is the *order to apply them in*, not a restatement of the
rules themselves. Update this file the moment a new standing rule is agreed, so it never drifts
out of date with `CLAUDE.md`.

## 0. Before writing any code

1. **Mock-first for anything user-facing.** Build the frontend UI first (local/mock state, no
   API wiring), get explicit sign-off, *then* wire the backend. Never build both halves before
   the UI has been reviewed.
2. **Decide the route category up front** for any new backend endpoint — RBAC route (gated by
   the resource's own `_VIEW`/`_CREATE`/`_UPDATE`/`_DELETE`) or system-internal/picker route
   (gated on the *consumer's* permission, for dropdown/filter lookups only). See `CLAUDE.md` →
   "RBAC Routes vs. System-Internal (Picker) Routes." Never default into one without deciding.
3. **New permissions are exactly four**: `_VIEW`, `_CREATE`, `_UPDATE`, `_DELETE`. Never add a
   `_MANAGE` key. See `CLAUDE.md` → "Permission Model." **Approved exception:** a resource with
   genuinely no create/update/delete action of its own (e.g. `AUDIT_LOG_VIEW` — audit data is
   read-only) gets exactly one `_VIEW`-only key instead of four dead ones. Not license to shortcut
   a resource that does have real mutations — see CLAUDE.md's own note on this exception.

## 1. Backend

4. New tables extend `AuditedEntity`/`AuditedTenantEntity` — never a bare entity with ad-hoc
   columns. Audit columns (`createdAt/By`, `updatedAt/By`, `deletedAt/By`) come automatically.
   See `CLAUDE.md` → "Audit, Deletion & Logging Rules."
5. The service layer always sets `createdBy`/`updatedBy` from the authenticated user — never
   leave them to default to null on a real write.
6. Soft-delete cascades are explicit and transactional, setting `deletedBy` on every affected
   dependent row — never a raw DB-level `ON DELETE CASCADE` for soft-deletes.
7. If the delete has dependents, it needs the red-warning + password-confirm flow (once the
   shared dialog for this exists — see `../6-finished-archive/todo-audit-infrastructure.md`; until then, flag it as a
   known gap rather than shipping a silent one-click cascade).
8. Consider whether this mutation deserves an `AuditLogService.record(...)` call (once the
   `audit_logs` table exists — see the same todo doc).
9. Don't bypass the global backend request logger (`RequestLoggerMiddleware`) — it's already
   applied to every route; new routes get it automatically, just don't work around it.

## 2. Frontend

10. **No hardcoded user-facing strings.** Every label, placeholder, button, tab name, and error
    message goes into the English label file first, referenced by key. See `CLAUDE.md` →
    "Internationalization."
11. Build with Tailwind + FlyonUI utility classes from the start. `crm-primary` red is confined
    to primary action buttons, active tabs/nav, key badges, and form focus rings — never a large
    surface fill. See `CLAUDE.md` → "Design System (FlyonUI)."
12. Any confirm/alert dialog uses the shared `DialogProvider` (`useConfirm`/`useAlert`) — never
    local `ConfirmDialog`/`AlertDialog` state.
13. Dropdown/filter data goes through a dedicated picker fetch function, added to the
    consolidated pickers lib file (`frontend/src/lib/pickers/server.ts` and its backend
    counterpart) — never fetch a resource's full admin list just to fill a dropdown.
14. After any create/update call, use the server's returned object directly (or re-fetch) —
    never `Object.assign(entity, dto)` and trust that local object's now-stale omitted fields.

## 3. Admin CRUD sections specifically (if this feature is one)

15. Follow the established pattern: table → sidebar entry → view/add/edit/delete, each its own
    permission + route, one section built and verified at a time.

## 4. Verification (every feature, no exceptions)

16. Typecheck clean — or only the same pre-existing, already-identified unrelated errors, not
    new ones.
17. Visual and behavioral verification in the browser (Playwright: screenshots + real
    interaction), not "should work by inspection." For anything with real logic behind the
    markup (timers, drag-and-drop, optimistic state), verify the *behavior*, not just the pixels.
18. If backend-wired, verify via `psql` that data persisted correctly, then clean up any test
    data created during verification.
19. Run at least one regression check on an unrelated existing page to confirm nothing outside
    this feature's scope broke.

## Keeping this file honest

This file is a *process*, not a rulebook — the actual rules live in `CLAUDE.md` and get updated
there first. Whenever a rule in `CLAUDE.md` changes, check whether the step order above still
makes sense, and update both together.
