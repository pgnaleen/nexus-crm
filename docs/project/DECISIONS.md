# CLAUDE.md Decision Log & Fixed-Bug Post-Mortems

Extracted from `CLAUDE.md` on 2026-08-03 to keep the live rules file lean. **The rule derived
from each incident below still lives in `CLAUDE.md`** — this file is the evidence and narrative
behind it: why the rule exists, what broke, how it was found and fixed. Read it when you need the
"why," not as something that needs to be re-applied — that's what the rule in `CLAUDE.md` is for.

## Brand color decision (2026-07-28)

Three near-identical reds were in play. `#ED1B24` is the value the delivered Nexus logo SVGs were
exported with, and on 2026-07-28 the client chose it as the app-wide `--color-crm-primary` so the
logo and every other red surface match exactly. The two rejected candidates, recorded so this
isn't re-litigated: `#E91C2D` (the token's own earlier value) and `#EA0A2A` (confirmed directly
from `orelit.com`'s theme CSS, `--wp--preset--color--accent: #ea0a2a`). All three are genuinely
red, not orange, despite how they can read on some displays, and the differences are a few points
in the blue channel — imperceptible side by side. Which one is *correct* was a brand-authority
call, not a visual one. This does not change where red is allowed to appear — the client
separately confirmed the shell background should stay navy (`#022B5D`) with no red in it at all;
red stays confined to the four usages listed in `CLAUDE.md`'s Color tokens rule.

## Glow token: why a duplicate token exists

`--color-crm-primary-glow` restates the primary as `rgba()` at 15% alpha because Tailwind cannot
derive an alpha variant of a custom property inside a composite `box-shadow` value. Before
2026-07-28 there was no glow token and ten separate components each hardcoded
`rgba(233,28,45,0.15)` inline — so changing `--color-crm-primary` left every form focus ring
glowing the *previous* brand red, with nothing to catch it. The glow token was introduced to fix
that. If a future Tailwind version can express `color-mix()` or an alpha modifier here, collapse
this token back into `--color-crm-primary` and delete this entry (and the corresponding note in
`CLAUDE.md`).

## RelationshipTypesService / RelationshipPartiesService cascade bug (2026-07-28)

Discovered during a full audit prompted by the client: `RelationshipTypesService.remove()` (and
the single-party `RelationshipPartiesService.remove()` used by the "Delete Company/Person" button)
both only soft-deleted the `relationship_company_contact_map` row — the tag linking a Company or
Contact to a Relationship Type. Neither ever touched the underlying `Company`/`Contact` row's own
`deletedAt`/`deletedBy`. The visible symptom: delete a Relationship Type (or a single Company/
Person card under one), the confirm dialog correctly warns "this will also delete N tagged
companies/contacts," but those Companies/Contacts stayed fully active underneath — still returned
by every picker (e.g. still selectable when creating a new Deal), still visible to any other
Relationship Type they also happened to be tagged under, effectively un-deletable by a normal user
ever again.

**Fixed 2026-07-28** — both `RelationshipPartiesService.remove()` and
`RelationshipTypesService.remove()` now cascade the real soft-delete down to the Company/Contact
(and a deleted company's own owned Contacts), each getting its own `audit_logs` row (not just a
count folded into the parent's entry), and each blocked with a `ConflictException` naming the
still-referenced records if any of them has an active Deal reference — mirroring the guard
`removeContactForCompany()` already had. Verified live: booted the app, ran both delete paths
against real throwaway rows, confirmed `companies`/`contacts` rows actually got
`deletedAt`/`deletedBy` set and each produced its own `audit_logs` delete row.

**Known residual data issue:** this bug shipped before the fix above, so 6 Companies and 1 Contact
in the live database are still soft-orphaned from it (a `relationship_company_contact_map` row
that's deleted, pointing at a Company/Contact that isn't) — found via direct query during the same
audit. Not backfilled automatically; needs an explicit one-time cleanup decision (which rows,
confirmed with the client) rather than a silent bulk soft-delete.

## TypeORM `save()` nulled relation FK columns (2026-07-21)

Discovered while building View Deal — `deals.service.ts`'s `update()` and `moveStage()` both
loaded the `Deal` via `findOneWithRelations()` (needed six-then-ten `leftJoinAndSelect`s for
display purposes: company, owner, stage names, etc.), mutated one or two fields on that same
object, then called `saveScoped()`. This silently **nulled every relation-backed FK column on the
row** (`company_id`, `contact_id`, `primary_contact_id`, `source_id`, `department_id`,
`pre_sales_person_id`, `pmo_id`) on every single update/move — confirmed empirically: reproduced
with as few as one relation loaded, reproduced with zero DTO fields touching those columns
(`moveStage` never even referenced them), gone completely the instant the entity was loaded with
*zero* relations. It was only ever caught because `deals` happens to have a `CHECK` constraint
(`company_id IS NOT NULL OR contact_id IS NOT NULL`) that turned the corruption into a loud 500
instead of a silent data loss. Any other entity with the same load-with-relations-then-save
pattern and no equivalent CHECK constraint would have lost its relation columns on every partial
update with no error at all. Audited at the time: no other service in the codebase did this —
Deals was the only one combining "needs relations for display" with "the same method is also used
to fetch the mutation target." Fixed by splitting `deals.service.ts` into `findOneOrFail`
(relations/response) and a private `findOneBareOrFail` (the entity that actually gets mutated and
saved) — the pattern the standing rule in `CLAUDE.md` now requires everywhere.

## `RelationshipPartiesService.updateCompany()` non-atomic replace (2026-07-31)

Found hours after shipping, by probing the endpoint — not by any typecheck.
`RelationshipPartiesService.updateCompany()` replaced a company's `company_industries` rows with a
`delete(removed)` followed by a `save(added)`, unwrapped. When the insert failed on a bad
`industry_id` FK, **the delete stayed committed and the company was left with no industries at
all** — reproduced live, one bad id took a company from 1 link to 0, with nothing shown to the
user. The same missing validation also turned a well-formed but non-existent uuid into a `500`
instead of a `404`, on both the create and update paths. Fixed by adding
`validateIndustryIds`-style upfront FK validation (mirroring `deals.service.ts::validateReferences`)
and wrapping the delete+insert in one transaction — the pattern the standing rule in `CLAUDE.md`
now requires for any "replace this record's links" write path.

## Permission Model `_MANAGE` migration (2026-07-28)

Migration complete for `TENANTS`, `USERS`, `RBAC`, `TEAMS`, `RELATIONSHIP_TYPE`, `RELATIONSHIP`,
`MAIN_STAGE`, `SUB_STAGE`, `DEPARTMENT`, `DEAL_SOURCE` — all ten `_MANAGE` keys deleted from
`permissions.ts`, every controller guard and frontend `hasManage` fallback trimmed, both roles
that held any of them (`Admin`, `Super Admin`) migrated onto the granular equivalents first
(verified via direct DB query — zero access lost), and `Sidebar.tsx` changed from checking one
hardcoded permission key per nav item to checking "does the user hold *any* permission under this
resource's prefix" — so removing a resource's `_MANAGE` key (or changing its permission set again
later) never requires a matching `Sidebar.tsx` edit. Companies/Contacts/Deals never had a
`_MANAGE` key at all (already 4-permission by design) — the only fix needed there was renaming
their read action from `_READ` to `_VIEW` for naming consistency with every other resource.
