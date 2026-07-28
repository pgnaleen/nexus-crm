# Brand assets — Nexus

Delivered source SVGs for the Nexus logo. **These files are not imported by the
application** and are not served to browsers — `frontend/` has no `public/`
directory by design. They live here as the design source of truth, for
re-export to other channels (slide decks, print, email signatures) and so a
future designer can see exactly what was supplied.

The app renders the logo from `frontend/src/components/brand/NexusLogo.tsx`,
which inlines the same path data as React SVG. That indirection is deliberate:
inlining lets the red come from `var(--color-crm-primary)` instead of a baked-in
hex, which is what keeps CLAUDE.md's single-source-of-truth colour rule true.

**If you replace the files in this folder, `NexusLogo.tsx` does not update
automatically.** The path data must be re-copied by hand.

## Files

| File | Viewbox | Lockup | Tone |
|---|---|---|---|
| `nexus-mark-white.svg` | 320×323 | mark only | white |
| `nexus-mark-red.svg` | 320×323 | mark only | red |
| `nexus-horizontal-white.svg` | 830×228 | mark + wordmark, side by side | all white |
| `nexus-horizontal-dark.svg` | 830×228 | mark + wordmark, side by side | red mark, `#252525` wordmark |
| `nexus-stacked-white.svg` | 320×442 | mark above wordmark | all white |
| `nexus-stacked-dark.svg` | 320×442 | mark above wordmark | red mark, `#252525` wordmark |
| `orel-it.svg` | 108×24 | Orel IT vendor logo | red, white knockout "IT" |

White lockups are for the navy app shell; dark lockups are for white/light
backgrounds. The Orel IT logo is the vendor attribution in the login card
footer, rendered by `frontend/src/components/brand/OrelItLogo.tsx`.

## Colour note

The supplied Nexus files use `#ED1B24`. On 2026-07-28 this was adopted as the app-wide
`--color-crm-primary` token so the logo and every other red surface (buttons,
active sidebar item, status badges, focus rings) match exactly. Two other
near-identical reds were considered and rejected: `#E91C2D` (the app's previous
token) and `#EA0A2A` (orelit.com's live accent). See CLAUDE.md § Color tokens.

`orel-it.svg` was supplied at `#E91C2D` — the *rejected* value. Both logo components
render their red from `var(--color-crm-primary)` rather than the literal in the file,
so the login card doesn't show two near-identical reds side by side. If exact
vendor-logo fidelity ever outranks page consistency, pin the fill in `OrelItLogo.tsx`
back to a literal; the component documents this.
