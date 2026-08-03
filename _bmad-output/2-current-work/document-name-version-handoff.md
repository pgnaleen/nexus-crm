# Deal document name & version fields — handoff (2026-08-03)

**Status: done and verified at the code/DB level; no browser click-through yet (see Known gaps).**
This doc exists so the next person doesn't have to reconstruct the change from commit messages
alone. Authoritative live docs: `api-endpoint-registry.md`'s "Deal Documents" section (now
documents `version`) and `CLAUDE.md` (no dedicated rule needed — this follows existing patterns,
not a new one).

## What it is

Client ask: when uploading a document to a Deal, let the user set a **document name** and a
**version**, instead of the name being silently the raw uploaded filename and no version existing
at all.

Investigation found "name" already existed end-to-end as the `title` column/field (entity → DTO →
contract → controller → UI) — it just wasn't exposed as an editable input anywhere; both upload
call sites in `AddDealDialog.tsx` hardcoded `title: file.name`. "Version" didn't exist at all —
no column, no DTO/contract field, no UI, confirmed via a full grep across the entity, DTOs,
contracts, services, controllers, and the upload UI.

## Decisions made with the client/user before building

- **Version is a free-text string** (like `title` — nullable varchar, not a numeric
  auto-increment).
- **Upload UX is stage-first-then-confirm**: selecting a file adds it to a pending list with
  editable Name/Version inputs, rather than uploading instantly. This replaces edit-mode's
  previous instant-upload-on-select behavior; create-mode already staged files until deal
  creation, it just gained the two new inputs.
- **Defaults when a field is left blank**: Name falls back to the uploaded file's name (same as
  today's only previous behavior, now just a fallback instead of the sole option). Version falls
  back to `"1.0"` — resolved once, at upload time, via a single shared helper
  (`resolveDocMeta()` in `AddDealDialog.tsx`), so every document gets a real stored value rather
  than blank/null even if the user types nothing.

## Files touched

Backend:
- `backend/src/database/migrations/1784700000037-AddVersionToDocuments.ts` (new) — nullable
  `version` varchar on the shared `documents` table, same nullability as `title` (only
  `DealDocument` rows use it; the other four owner types sharing this table leave it null).
- `backend/src/modules/documents/entities/document.entity.ts` — `version` column.
- `backend/src/modules/documents/documents.service.ts` — `add()` gained a `version` param.
- `backend/src/modules/deals/dto/create-deal-document.dto.ts` — optional `version` field.
- `backend/src/modules/deals/deal-documents.service.ts` — passes `version` through on create,
  includes it in both the insert and delete `audit_logs` `changes` payloads.
- `backend/src/modules/deals/deal-documents.controller.ts` — `toResponse()` includes `version`.
- `common/src/contracts/deals.contracts.ts` — `version?: string` on `CreateDealDocumentRequest`
  and `DealDocumentResponse`.

Frontend:
- `frontend/src/lib/api/deals.ts` — `uploadDealDocument()` appends `version` to the multipart
  body when present.
- `frontend/src/components/funnel/AddDealDialog.tsx` — the main rework: `StagedDocument` gained
  `name`/`version`; `addFiles()` now always stages instead of edit-mode instant-uploading;
  `resolveDocMeta()` centralizes the blank→filename / blank→`"1.0"` fallback; new
  `uploadStagedDocument()` handles the edit-mode explicit Upload action; the Documents tab UI
  shows editable Name/Version inputs per pending file (plus an Upload button in edit mode), and
  the existing-documents list now shows `docType · version`.
- `frontend/src/components/funnel/ViewDealDialog.tsx` — the read-only View Deal Documents tab was
  also showing `docType` with no version; added `` {doc.docType}{doc.version ? ` · ${doc.version}` : ""} ``
  there too, for consistency with `AddDealDialog.tsx`. This was found by explicitly checking every
  frontend consumer of `DealDocumentResponse`/`uploadDealDocument`/`listDealDocuments` — confirmed
  these two dialogs are the only two.
- `_bmad-output/2-current-work/api-endpoint-registry.md` — the `POST /deals/:dealId/documents`
  row updated to document the new `version` field on both request and response.

Other upload flows in the app (Employee CV/Photo, Company Logo, Certification Evidence) were
deliberately left untouched — they're single-file "replace current" uploads with no `title`/
`docType` concept at all (see `documents.service.ts`'s `replaceSingle`/`HARD_RETIRE_ON_REPLACE`),
a different shape than Deal Documents' multi-file list, so "document name and version" doesn't
apply to them.

## What was verified

- `pnpm --filter @orelia/common build` — clean.
- Backend `tsc --noEmit` — clean.
- Frontend `tsc --noEmit` — only pre-existing, unrelated errors in `RolePermissionsDialog.tsx`/
  `TenantFormDialog.tsx`/`UserFormDialog.tsx`/`RoleCardPicker.tsx`; confirmed identical via
  `git stash` back to the `dev-g` baseline before this feature, so nothing here is a regression.
- Migration run against the live `orelia-postgres-1` container (`pnpm run migration:run` inside
  `orelia-backend-1`); confirmed via `\d documents` that the `version` column exists and is
  nullable, matching `title`.

## Known gaps

- **No browser click-through** — no browser automation tool was available in this session. The
  golden path (add a file in both create and edit mode, edit Name/Version, upload, confirm it
  displays correctly in both `AddDealDialog.tsx` and `ViewDealDialog.tsx`) still needs a manual
  pass in the running app.

## Unrelated: other work-in-progress sitting in this repo right now

While finishing this feature, unrelated uncommitted changes were found already sitting in the
working tree — `common/src/contracts/deal-stages.contracts.ts`, `common/src/types/deal.types.ts`,
`frontend/src/app/[tenant]/(dashboard)/deals/[id]/page.tsx`, `frontend/src/app/[tenant]/
(dashboard)/funnel/page.tsx`, `frontend/src/components/funnel/FunnelBoard.tsx`, and an untracked
`_bmad-output/2-current-work/funnel-main-stage-progress.md`. None of it was built by this
session — it's a separate, already in-progress feature (Main Stage weight/weighted-pipeline,
matching that untracked file's name). Same situation `activity-log-handoff.md` ran into before —
that work is deliberately **not** included in this feature's commit; see
`funnel-main-stage-progress.md` if it exists for whoever is tracking that one.
