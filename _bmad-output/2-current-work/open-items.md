# Open Items — Nexus CRM

**The single list of everything still open.** Consolidated 2026-07-31 from the five files that
each used to claim this role. Every item below was **re-verified against the code** before being
carried over — items the old lists still called open but which are actually shipped were dropped,
and those drops are recorded in [../START-HERE.md](../START-HERE.md#doc-vs-code-corrections).

Severity: 🔴 Critical (security / data integrity) · 🟠 High (real bug or blocker) · 🟡 Medium ·
⚪ Low / polish.

**Related files that stay separate on purpose:**
- [deferred-work.md](./deferred-work.md) — 7 items, owned by `bmad-code-review`, which **appends**
  to it on every run. Never merge it into this file; it will be rewritten underneath you.
- [sprint-status.yaml](./sprint-status.yaml) — story-level status for all 57 stories.

---

## Ranked

> ✅ **Resolved 2026-07-31.** Items 1 and 2 were sitting uncommitted across 9 files plus `.env`;
> they are now committed. The warning is kept as a note rather than deleted because the risk was
> real, not hypothetical: a `git stash push -u` / `stash drop` during that session deleted the
> untracked bug-list file, recovered only because the doc reorganisation had already copied it to
> `archive/`. Commit work of this size before starting anything on top of it.

| # | Item | Sev | Epic / story | Where |
|---|---|:--:|---|---|
| 1 | Welcome-email failure is invisible to the admin — account created, reported as success, unusable by anyone. ✅ **Fixed + verified live 2026-07-31, uncommitted** — `sendWelcomeEmail` returns `MailDeliveryResult` instead of `void`; `create()` propagates it; `POST /users` returns `CreateUserResponse` with `welcomeEmail`; the dialog shows a warning panel naming the reason instead of closing on a silent success. Verified by creating real throwaway users through the live API: `{sent:false, reason:"not_configured"}` before the keys loaded, `{sent:true}` after. All test rows removed | 🟠 | `6-4` (`review`) | `mail.service.ts`, `users.service.ts`, `UserFormDialog.tsx` |
| 2 | `APP_BASE_URL` unset → welcome email's only button points at `localhost:3000` | 🟠 | `6-4` | ✅ **Fixed 2026-07-31** — set explicitly in `.env` with a comment stating it must change before mailing real recipients. Two gotchas found while verifying, both worth keeping: (a) `docker compose restart` does **not** re-read `env_file` — only `up -d --force-recreate` loads changed `.env` values, so the keys looked set but the app still reported `not_configured`; (b) it is still `http://localhost:3000` and **must be changed at deploy time** or every production welcome email ships a dead button |
| 3 | User creation is not transactional — a failed employee link orphans an un-emailed account, and retrying 409s on the username | 🟠 | — | `users.service.ts` `create()` L142-179 |
| 4 | Admin password reset does not revoke existing sessions — resetting a compromised account leaves the attacker logged in | 🟠 | `6-5` | `users.service.ts` `resetPassword()` L277-301 |
| 5 | Temporary passwords never expire | 🟠 | `6-1` | no TTL anywhere in the flow |
| 6 | No resend path; the only recovery leaks the credential out-of-band | 🟠 | `6-2` / `6-3` | — |
| 7 | Login email can be changed with no verification or notification | 🟠 | `6-7` | — |
| 8 | `typescript.ignoreBuildErrors: true` — production builds cannot fail on type errors | 🟠 | — | `frontend/next.config.js:4-12` |
| 9 | `docker-compose.yml`'s local-`postgres` removal exists only on the deploy server, uncommitted — a fresh clone/redeploy hits the same port conflict again | 🟠 | — | `docker-compose.yml:2-11,54-55` |
| 10 | Rotate the three secrets printed into a chat transcript (`DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) | 🟡 | — | server `.env` |
| 11 | Auth cross-tab session sync — both fixes built, **neither live-verified** | 🟡 | — | [../4-design-plans/plan-auth-cross-tab-session-sync.md](../4-design-plans/plan-auth-cross-tab-session-sync.md) §6 |
| 12 | Phase 5 — migrate modals & interactive components to Tailwind | 🟡 | `2-5` | CLAUDE.md phase list |
| 13 | Phase 6 — responsive QA pass (only 4 files use any breakpoint prefix) | 🟡 | `2-6` | [../4-design-plans/plan-phase6-responsive-qa.md](../4-design-plans/plan-phase6-responsive-qa.md) |
| 14 | Final QA verification pass | 🟡 | `2-7` | — |
| 15 | **Testing track has never started** — Step 0 tooling setup not done, 0 of N sections tested | 🟡 | — | [../5-testing/TEST-RESULTS.md](../5-testing/TEST-RESULTS.md) |
| 16 | `UserStatus.Invited` is modelled but never set | 🟡 | `6-6` | — |
| 17 | No self-service "Forgot password" | 🟡 | `6-8` | — |
| 18 | i18n retrofit incomplete — 17 namespaces exist; Tenants, Roles, Teams, Deal Sources, Main/Sub Stages, Funnel, Dashboard and the shared UI primitives still hardcode text | 🟡 | — | `frontend/src/locales/en.json` |
| 19 | Upload extension + `ContentType` still come from the client (`splitExt(originalname)`) | 🟡 | — | `uploads.controller.ts`, `storage/s3.service.ts:70` |
| 20 | Delete the dead `DEAL_STAGES_MANAGE` wildcard (zero controllers check it) | ⚪ | — | `common/src/constants/permissions.ts:44` |
| 21 | New user-facing strings in the credential work are hardcoded, against the i18n rule | ⚪ | — | — |
| 22 | `ResetPasswordRequest` still carries an admin-supplied password | ⚪ | `6-3` | — |
| 23 | Per-action row labels in the Roles dialog still show the raw suffix | ⚪ | — | `RolePermissionsDialog.tsx` |
| 24 | `audit_logs` grows unbounded and nothing ever deletes from it — no retention policy, no partitioning. Surfaced by Epic 7, which makes the table readable for the first time | 🟡 | `7-*` (deferred) | [../3-feature-specs/spec-activity-log.md](../3-feature-specs/spec-activity-log.md) |
| 25 | `AuthService`, `DocumentsService`, `UploadsController`, `IndustriesService`, `DbBackupService` write **zero** audit rows; `CompaniesService`/`ContactsService` write none of their own (only the relationship services do). Epic 7 closes the `AuthService` half; the rest stays open | 🟡 | — | `backend/src/modules/{companies,contacts,documents,uploads}/` |
| 26 | `main.ts` never sets `trust proxy`, so `req.ip` is the nginx proxy's address, not the client's. Blocks any meaningful IP capture | 🟡 | `7-6` | `backend/src/main.ts` |

**Item 24 note.** Deliberately *not* solved by a delete button: there is no `AUDIT_LOG_DELETE`
permission by design, so retention stays an operator concern (env var + cron, default off) rather
than a UI action. If volume ever becomes a real problem the right answer is monthly `RANGE`
partitioning on `occurred_at` — cheap `DETACH` instead of `DELETE` — which is a far bigger migration
on an already-large table. **Decide it before the table is big, not after.**

Items 1–7, 16, 17, 21, 22 are the eleven bugs from the user-provisioning architecture review —
full evidence for each is preserved in
[../6-finished-archive/bugs-user-provisioning.md](../6-finished-archive/bugs-user-provisioning.md).

---

## What's next

**Epic 6 (User Management) is the active front.** It holds seven of the nine 🟠 items above.
Items 1 and 2 are done and verified live but **not committed** — that is the first thing to deal
with, not more new work.

0. **Commit items 1 and 2.** Nothing else should be started on top of a 9-file uncommitted change,
   for the reason recorded in the warning above.
1. Item 4 (`6-5`) — the security one; the fix already exists twice in the same file to copy from
   (`changeOwnPassword()` L336-339, `disable()` L363).
2. Item 3 — make `create()` transactional, closing the orphaned-account path that items 1 and 2
   only made *visible*.

Item 9 is independent, ~5 minutes, and prevents a repeat of a production outage already diagnosed
once — worth doing before anything else regardless. Item 2's `APP_BASE_URL` is still
`http://localhost:3000` and **must be changed at deploy time**; until then no real recipient gets
a working button.

Item 9 is independent, ~5 minutes, and prevents a repeat of a production outage already diagnosed
once — worth doing before anything else regardless.

---

## Dropped as already fixed (verified 2026-07-31)

These were still listed as open in the old files. Code says otherwise:

| Was tracked as | Reality |
|---|---|
| 🔴 Stored XSS — `express.static` serving uploads unauthenticated | **Gone.** Uploads moved to S3 (`core/storage/s3.service.ts`, presigned GETs); `main.ts` no longer serves static assets at all. The four "deferred to the S3 migration" upload items go with it — only the residual item 19 above survives |
| F2 — Add Deal's Customer/Partners pickers show every company in the tenant | **Built.** `relationship_types.system_role` exists; `AddDealDialog` sources both fields from relationship-type-scoped parties |
| F3 — no way to tag an existing Company/Contact under an additional type | **Built.** `linkExistingCompanyToType` / `linkExistingContactToType` (`relationship-parties.service.ts:615+`), shipped in `2ff3d34` |
| Retrofit deep debug logging to every backend endpoint | **100% complete** (2026-07-22) |
| Enforce `createdBy` NOT NULL at the DB level | **Correctly abandoned**, not deferred — the CHECK constraint broke login for seeded rows and was reverted. Do not retry without a real "system actor" concept |
| Permission model `_MANAGE` migration (11 unchecked boxes) | **Done.** Only `DEAL_STAGES_MANAGE` remains, and it's item 20 |
| Add a resource display-name map to the Roles dialog | **Built** — `RESOURCE_DISPLAY_NAME` (`RolePermissionsDialog.tsx:36`) |

---

## Found and fixed 2026-07-31 — company multi-country/multi-industry

Two defects introduced by `03e778d` (multi-country/multi-industry) and fixed in `06ca6d9`.
Recorded here rather than dropped silently: both were found by **probing the running endpoints**
after the code was already committed and pushed, and neither was catchable by a typecheck. They
are the concrete argument for item 15 (the testing track has never started).

| Sev | Bug | Fix |
|:--:|---|---|
| 🟡 | A well-formed but non-existent `industryId` reached the `company_industries` FK and surfaced as a **500**, on both the create and update paths | `validateIndustryIds()` resolves every submitted id up front and throws `NotFoundException` naming the missing ones — the posture `deals.service.ts::validateReferences` already applies to every FK on a Deal |
| 🟠 | **Silent data loss.** `updateCompany` replaced industry links with a delete-then-insert and **no transaction around the pair**. A failing insert left the delete committed, stripping the company of every industry it had. Reproduced live: one bad id took a company from 1 link to 0 | The replacement now runs inside `dataSource.transaction`. Validation alone was not sufficient — an industry deleted between the check and the insert would still race |

**The generalisable rule** — replacing a set of join rows is a delete plus an insert, and it is only
correct inside one transaction. Added to `CLAUDE.md` so the next join table doesn't repeat it.

**Related, still open:** the realistic trigger for the second bug is a stale picker — an industry
deleted between the form loading its options and the user saving. That staleness is a live item in
[deferred-work.md](./deferred-work.md), whose entry rated its worst case as "stale dropdown, not
incorrect data." That assessment was wrong for as long as this bug existed; the destructive half is
now fixed, but the staleness itself is still unaddressed.
