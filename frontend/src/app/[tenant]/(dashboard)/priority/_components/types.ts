import { PriorityTaskQuadrant } from "@orelia/common";

// Classic Eisenhower reading order: Urgent+Important, Not Urgent+Important
// (top row), Urgent+Not Important, Not Urgent+Not Important (bottom row).
export const QUADRANT_ORDER: PriorityTaskQuadrant[] = [
  PriorityTaskQuadrant.Do,
  PriorityTaskQuadrant.Decide,
  PriorityTaskQuadrant.Delegate,
  PriorityTaskQuadrant.Delete,
];

export const DEFAULT_QUADRANT: PriorityTaskQuadrant = PriorityTaskQuadrant.Do;

export interface QuadrantConfig {
  id: PriorityTaskQuadrant;
  watermark: string;
  panelClass: string;
  watermarkClass: string;
  dotClass: string;
  // Story 2.3 -- the card rank chip: solid accent fill + a soft drop shadow
  // in the same hue.
  accentClass: string;
}

// Story 2.1/2.2 -- each quadrant's palette comes from the --color-pd-* tokens
// in globals.css's @theme block (taken verbatim from the client's
// orel-tasks_2.html prototype), never a raw hex here. Panel fill is a vertical
// -soft -> -fill gradient; because Tailwind can't express a multi-stop
// background-image as a plain utility, it uses the same arbitrary-property +
// var() form the app shell already uses, per CLAUDE.md's design-system rule.
//
// Class strings are written out in full rather than composed from a token
// prefix -- Tailwind scans source text for literal class names, so a
// template-built `bg-pd-${x}-fill` would generate no CSS at all.
//
// Story 2.9 -- lives here rather than in PriorityBoard.tsx because the accept
// dialog's quadrant tiles need the same dots and action words; two copies of
// this map would be two places for the palette to drift.
export const QUADRANT_STYLE: Record<PriorityTaskQuadrant, Omit<QuadrantConfig, "id">> = {
  [PriorityTaskQuadrant.Do]: {
    watermark: "DO",
    panelClass:
      "[background-image:linear-gradient(180deg,var(--color-pd-do-soft)_0%,var(--color-pd-do-fill)_100%)]",
    watermarkClass: "text-pd-do-word",
    dotClass: "bg-pd-do-acc shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-pd-do-acc)_22%,transparent)]",
    accentClass: "bg-pd-do-acc shadow-[0_3px_8px_-3px_var(--color-pd-do-acc)]",
  },
  [PriorityTaskQuadrant.Decide]: {
    watermark: "DECIDE",
    panelClass:
      "[background-image:linear-gradient(180deg,var(--color-pd-de-soft)_0%,var(--color-pd-de-fill)_100%)]",
    watermarkClass: "text-pd-de-word",
    dotClass: "bg-pd-de-acc shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-pd-de-acc)_22%,transparent)]",
    accentClass: "bg-pd-de-acc shadow-[0_3px_8px_-3px_var(--color-pd-de-acc)]",
  },
  [PriorityTaskQuadrant.Delegate]: {
    watermark: "DELEGATE",
    panelClass:
      "[background-image:linear-gradient(180deg,var(--color-pd-dg-soft)_0%,var(--color-pd-dg-fill)_100%)]",
    watermarkClass: "text-pd-dg-word",
    dotClass: "bg-pd-dg-acc shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-pd-dg-acc)_22%,transparent)]",
    accentClass: "bg-pd-dg-acc shadow-[0_3px_8px_-3px_var(--color-pd-dg-acc)]",
  },
  [PriorityTaskQuadrant.Delete]: {
    watermark: "DELETE",
    panelClass:
      "[background-image:linear-gradient(180deg,var(--color-pd-dl-soft)_0%,var(--color-pd-dl-fill)_100%)]",
    watermarkClass: "text-pd-dl-word",
    dotClass: "bg-pd-dl-acc shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-pd-dl-acc)_22%,transparent)]",
    accentClass: "bg-pd-dl-acc shadow-[0_3px_8px_-3px_var(--color-pd-dl-acc)]",
  },
};

export const QUADRANTS: QuadrantConfig[] = QUADRANT_ORDER.map((id) => ({ id, ...QUADRANT_STYLE[id] }));
