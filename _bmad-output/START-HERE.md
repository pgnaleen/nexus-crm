# Nexus CRM — Status

*Last rebuilt 2026-07-31. Every story below was verified against the code, not copied from the
epic files. Where the docs and the code disagreed, the code won.*

## → What to do next

**Commit the uncommitted work in your tree.** Nine files plus `.env` implementing story `6-4`
(welcome-email delivery status) are sitting uncommitted right now — fixed and verified live, but
one bad `git stash` from gone. That already nearly happened once this session.

Then: **Epic 6 — User Management**. It is the only epic with open feature work of its own, and it
holds 7 of the 9 highest-severity items in the project. Full ranked list:
[open-items.md](2-current-work/open-items.md).

---

## Epics

| # | Epic | Done | Status | Source |
|---|---|:--:|---|---|
| 1 | HR — Employee Directory & Org Visibility | 14/14 | ✅ done | [epics-hr.md](1-epics-and-stories/epics-hr.md) |
| 2 | System — UI Modernization (Tailwind/FlyonUI) | 5/8 | 🔨 in progress | [epics-system.md](1-epics-and-stories/epics-system.md) |
| 3 | Priority Tracker — Eisenhower Task Management | 10/10 | ✅ done | [epics-task-management.md](1-epics-and-stories/epics-task-management.md) |
| 4 | Priority Deck — Prototype v2 Parity | 12/12 | ✅ done | [epics-task-management.md](1-epics-and-stories/epics-task-management.md) |
| 5 | Priority Tracker — Event-Sourced Flow, Chat & Realtime | 5/5 | ✅ done | [epics-task-management.md](1-epics-and-stories/epics-task-management.md) |
| 6 | User Management — Provisioning & Credential Lifecycle | 0/8 | 🔨 in progress | [epics-user-management.md](1-epics-and-stories/epics-user-management.md) |

**46 of 57 stories done**, 10 backlog, 1 in review. The 11 open ones: `2-5` migrate modals,
`2-6` responsive QA, `2-7` final QA, and all eight of epic 6 — of which `6-4` is built and
verified but uncommitted, hence `review` rather than `done`.

> The four epic files each call their own epic "Epic 1". BMad needs globally-unique epic numbers,
> so they're renumbered 1–6 above and in `sprint-status.yaml`. The mapping is documented in that
> file's header. Story numbers *inside* each epic are unchanged.

## Highest-severity open work

| Sev | Item | Story |
|:--:|---|---|
| 🟠 | Welcome-email failure invisible to admin — **built, uncommitted** | `6-4` |
| 🟠 | `APP_BASE_URL` unset → welcome email links to `localhost:3000` | `6-4` |
| 🟠 | User creation is not transactional — failed employee link orphans the account | — |
| 🟠 | Admin password reset does not revoke existing sessions | `6-5` |
| 🟠 | Temporary passwords never expire | `6-1` |
| 🟠 | No resend path; only recovery leaks the credential out-of-band | `6-2`/`6-3` |
| 🟠 | Login email changeable with no verification | `6-7` |
| 🟠 | `ignoreBuildErrors: true` — prod builds can't fail on type errors | — |
| 🟠 | `docker-compose.yml` fix lives only on the deploy server, uncommitted | — |

All 23 open items, including 🟡/⚪: [open-items.md](2-current-work/open-items.md).

## Doc-vs-code corrections

Found while verifying. The old files said one thing; the code said another.

1. **All 14 HR stories were marked `CONFIRMED`, which reads as done but means "the product owner
   agreed to this story."** All 14 are in fact built and shipped — verified via
   `backend/src/modules/employees/`, `certifications/`, the org-chart page, and explicit
   `// Story 1.N --` markers in the source.
2. **Epic 4's twelve stories all said `DRAFT` while the epic header said "all 12 built."** The
   header was right — `--color-pd-*` tokens are in `globals.css` (41 uses) and `TaskDetailDialog.tsx`
   carries `Story 2.4 / 2.5 / 2.6 / 2.7 / 2.8 / 2.11 / 2.12` markers.
3. **Story file `1-4-update-employee-record.md` said `ready-for-dev`.** It is done —
   `PATCH /employees/:id` exists and `EmployeeFormDialog.tsx:151` is commented
   `Story 1.4 -- both present = edit mode`. Its own AC note claiming `EMPLOYEES_UPDATE`
   "does not exist yet" is stale; it is at `permissions.ts:84`. **Corrected in the file.**
4. **The 🔴 stored-XSS upload bug is gone.** Uploads moved to S3 (presigned GETs,
   `core/storage/s3.service.ts`); `main.ts` no longer serves static assets at all. The four
   "deferred until the S3 migration" items go with it.
5. **`F2` and `F3` in the old master todo are both built** — `relationship_types.system_role`
   exists and drives Add Deal's pickers; `linkExistingCompanyToType`/`linkExistingContactToType`
   shipped in `2ff3d34`.
6. **`todo-audit-infrastructure.md`'s two remaining unchecked boxes are both resolved** — the
   deep-logging retrofit is 100% complete, and the `createdBy NOT NULL` constraint was correctly
   *abandoned* (it broke login for seeded rows), not deferred.
7. **`todo-system-wide`'s eleven unchecked permission boxes are done.** Only `DEAL_STAGES_MANAGE`
   survives. i18n is also much further along than that file claims — 17 namespaces exist, not one.
8. **`epics-hr.md`'s frontmatter points at `spec-employee-management.md`, which has never existed
   in this repo.** Left as-is — it predates this reorganization and isn't something a file move
   caused. Either write the spec or drop the `inputDocuments` line.

## Where things live

Folders are numbered in the order you'd read them. Each has its own `README.md` saying what
belongs in it.

```
_bmad-output/
├── START-HERE.md              ← you are here
│
├── 1-epics-and-stories/       WHAT we're building, broken into 57 stories
│   └── epics-{hr,system,task-management,user-management}.md
│
├── 2-current-work/            WHAT'S IN FLIGHT — the live folder
│   ├── sprint-status.yaml         all 57 stories, machine-readable  ⚠ fixed name
│   ├── open-items.md              the one open-work list
│   ├── deferred-work.md           owned by bmad-code-review         ⚠ fixed name
│   ├── api-endpoint-registry.md
│   └── 1-4-update-employee-record.md   the only story file that exists
│
├── 3-feature-specs/           HOW one feature must behave (input, not a work item)
├── 4-design-plans/            design notes written before building (input)
├── 5-testing/                 playbook + results — never started
└── 6-finished-archive/        done & superseded, kept as evidence, not deleted
```

> **The folder names are safe to change; these three things inside `2-current-work/` are not.**
> The folder paths live in config (`_bmad/custom/config.toml`, pinned there so a BMad reinstall
> can't revert them). But the skills address these by exact name and fail silently if renamed:
> `sprint-status.yaml` · `deferred-work.md` (code-review appends to it on every run) · story
> files sitting **directly** in `2-current-work/`, not in a `stories/` subfolder.

## Vocabulary

Epics hold **stories**; stories hold **tasks/subtasks** (the `- [ ]` checklist inside a story
file). **Bugs** sit outside that tree — they're fixes to shipped code, tracked in `open-items.md`,
and may spawn a story. **Specs** and **plans** are inputs to stories, not work items themselves.

Story status is one of five, and only these five:
`backlog` → `ready-for-dev` → `in-progress` → `review` → `done`.
