# Project Docs — ORELIA CRM

Plain-markdown project tracking, read and updated directly by whoever (human or Claude) is working
on this repo. Replaces the old BMAD-generated `_bmad-output/` tree — no framework, no per-story
files, no separate status YAML; this folder *is* the status.

**Start with [`EPICS.md`](./EPICS.md).** It's the index + progress view: every epic's status in
one table, plus a short "Unsorted / Current Focus" section for anything active that doesn't map to
one specific story yet.

- **[`EPICS.md`](./EPICS.md)** — index into [`epics/`](./epics/), which holds one file per epic
  with its stories nested underneath as a checklist. Read the index first for "what's done, what's
  next," then open the one epic file you're actually touching.
- **[`BUGS.md`](./BUGS.md)** — index into [`bugs/`](./bugs/), which holds open findings split by
  review/category, plus [`bugs/fixed-closed.md`](./bugs/fixed-closed.md). Add new findings to the
  relevant category file manually when they aren't fixed immediately (new category → new file,
  linked from `BUGS.md`).
- **[`DECISIONS.md`](./DECISIONS.md)** — incident post-mortems and the reasoning behind standing
  rules in `CLAUDE.md` (why a rule exists, what broke, how it was fixed). Read it for the "why";
  `CLAUDE.md` itself is what to actually follow.
- **[`plans/PLANS.md`](./plans/PLANS.md)** — active, unresolved design plans and open questions only. A plan
  moves out of this file (with a pointer left in `EPICS.md`) the moment its work ships.
- **[`specs/activity-log.md`](./specs/activity-log.md)** — the one still-relevant behavioral spec
  (Activity Log's epic is fully built now — see `EPICS.md` — this doc remains useful as the
  detailed edge-case/design record for that feature).
- **[`api-endpoint-registry.md`](./api-endpoint-registry.md)** — index into [`api/`](./api/),
  which holds the actual endpoint tables split by feature area (Pickers & Auth, Deals,
  Relationships, HR, Admin, Priority Tasks, Platform). Open the one file you need, not all ~700
  lines. Update the relevant file in the same change whenever an endpoint is created, moved, or
  its shape changes (rule lives in `CLAUDE.md`).
- **[`feature-development-guideline.md`](./feature-development-guideline.md)** — the build-order
  checklist to follow for every new feature, referencing `CLAUDE.md`'s standing rules in the order
  they apply.
- **[`archive/`](./archive/)** — epics/bugs moved out of the live files once they're fully done
  *and* no longer useful in a day-to-day read (typically superseded by later work). Nothing here
  is deleted outright — git history already covers that; this is purely about keeping `EPICS.md`/
  `BUGS.md` short enough to read in one pass. **Rule:** when `EPICS.md` or `BUGS.md`'s "done"/
  "Fixed" content starts crowding out the still-open items, move the fully-closed, no-longer-
  referenced entries to `archive/epics-archive.md` / `archive/bugs-archive.md`, leaving a one-line
  stub + pointer behind if anything still open references it (see Epic 3 in `EPICS.md` for the
  pattern). Don't archive something still cross-referenced by open work.
