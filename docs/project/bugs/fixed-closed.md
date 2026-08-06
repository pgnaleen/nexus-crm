# Fixed / Closed

Part of the split bugs tracker — see [`../BUGS.md`](../BUGS.md) for the severity legend shared
across every file in this folder. Once this list gets long enough to crowd out a quick read, move
older entries to [`../archive/bugs-archive.md`](../archive/bugs-archive.md).

- ✅ **Welcome-email failure invisible to admin** (provisioning bug #1) — `MailDeliveryResult`
  contract, `CreateUserResponse.welcomeEmail`, warning panel in `UserFormDialog`. Verified live
  2026-07-31; flagged uncommitted at the time — re-check current `git log` (see Epic 6 in
  `../epics/epic-6-user-management.md`).
- ✅ **`APP_BASE_URL` unset** (provisioning bug #2) — set explicitly in `.env` with a comment that
  it must change again at real deploy time.
- ✅ **`deal-contacts.service.ts::add()` tenant-scoping gap** — module replaced by
  `deal-partners.service.ts`, which resolves targets through the tenant-scoped repository first
  (2026-07-20).
- ✅ **`main.ts` never sets `trust proxy`** — `req.ip` was the nginx proxy's address, not the
  client's. Fixed 2026-08-03 alongside Activity Log's IP capture (`TRUST_PROXY_HOPS`, default 0).
- ✅ **`AuthService` audit gap** — closed 2026-08-03 by Epic 7: `auth_events` now captures
  login-succeeded / login-failed (all 4 reasons) / account-locked / logout with real IP/user-agent.
- ✅ **Company multi-country/multi-industry: non-existent `industryId` → 500** and **silent data
  loss on `updateCompany`'s non-atomic industry replace** — both found by probing the live API
  2026-07-31, neither catchable by a typecheck. Fixed: upfront FK validation
  (`validateIndustryIds`) + wrapping the delete/insert in one transaction. Full incident + the
  generalized "replace a set of join rows" rule: `../DECISIONS.md`.
- ✅ **Stored XSS — unauthenticated `express.static` serving of uploads** — gone; uploads moved to
  S3 with presigned GETs, `main.ts` no longer serves any static assets.
- ✅ **Add Deal's Customer/Partners pickers showed every company/contact in the tenant** —
  `relationship_types.system_role` (and later, multi-type support) built; pickers now scope to
  tagged parties only. Design notes: see git history, was
  `_bmad-output/4-design-plans/plan-deal-customer-partner-filtering.md` and
  `plan-multi-type-system-role.md`.
- ✅ **No way to tag an existing Company/Contact under an additional relationship type** — built
  (`linkExistingCompanyToType`/`linkExistingContactToType`).
- ✅ Deep debug logging retrofit to every backend endpoint — 100% complete (2026-07-22).
- ✅ Permission model `_MANAGE` migration — done for all ten flagged resources; only the dead
  `DEAL_STAGES_MANAGE` wildcard remains (tracked in `../plans/PLANS.md`'s funnel/deal-management plan).
- ✅ Resource display-name map added to the Roles permissions dialog (`RESOURCE_DISPLAY_NAME`).
- ⛔ **Enforce `createdBy` NOT NULL at the DB level** — attempted and correctly abandoned, not
  deferred: the CHECK constraint broke login for seeded rows and was reverted. Do not retry without
  a real "system actor" concept.
