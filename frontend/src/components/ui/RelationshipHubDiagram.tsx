"use client";

// Generic hub-and-spoke presentational renderer -- no business logic, no API
// calls. Takes a center label and a list of spokes and draws the center
// node connected to each spoke node. Used by the Relationships tab on
// CompanyFormDialog/ContactFormDialog to show every relationship type a
// party is tagged under; each spoke's own `isActive` flag drives whether it
// renders as an active (primary red) or disabled (neutral grey) spoke --
// per the design tokens rule, colors always come from CSS custom
// properties, never a hardcoded hex.

export interface RelationshipHubDiagramSpoke {
  id: string;
  label: string;
  isActive: boolean;
}

interface RelationshipHubDiagramProps {
  centerLabel: string;
  spokes: RelationshipHubDiagramSpoke[];
  emptyLabel: string;
}

const VIEW_WIDTH = 420;
const VIEW_HEIGHT = 260;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const RADIUS = 92;
const CENTER_NODE_WIDTH = 148;
const CENTER_NODE_HEIGHT = 46;
const SPOKE_NODE_WIDTH = 116;
const SPOKE_NODE_HEIGHT = 38;

export function RelationshipHubDiagram({ centerLabel, spokes, emptyLabel }: RelationshipHubDiagramProps) {
  const positions = spokes.map((spoke, index) => {
    const angle = (2 * Math.PI * index) / spokes.length - Math.PI / 2;
    return {
      ...spoke,
      x: CENTER_X + RADIUS * Math.cos(angle),
      y: CENTER_Y + RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        style={{ maxHeight: spokes.length === 0 ? 140 : 280 }}
        role="img"
        aria-label={centerLabel}
      >
        {positions.map((spoke) => (
          <line
            key={`line-${spoke.id}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={spoke.x}
            y2={spoke.y}
            stroke={spoke.isActive ? "var(--color-crm-primary)" : "var(--color-border)"}
            strokeWidth={2}
          />
        ))}

        <foreignObject
          x={CENTER_X - CENTER_NODE_WIDTH / 2}
          y={CENTER_Y - CENTER_NODE_HEIGHT / 2}
          width={CENTER_NODE_WIDTH}
          height={CENTER_NODE_HEIGHT}
        >
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-crm-primary bg-crm-primary-tint px-2 text-center text-[12.5px] font-semibold leading-tight text-crm-text"
            title={centerLabel}
          >
            {centerLabel}
          </div>
        </foreignObject>

        {positions.map((spoke) => (
          <foreignObject
            key={`node-${spoke.id}`}
            x={spoke.x - SPOKE_NODE_WIDTH / 2}
            y={spoke.y - SPOKE_NODE_HEIGHT / 2}
            width={SPOKE_NODE_WIDTH}
            height={SPOKE_NODE_HEIGHT}
          >
            <div
              className={`flex h-full w-full items-center justify-center overflow-hidden rounded-md border px-2 text-center text-[11.5px] font-medium leading-tight ${
                spoke.isActive
                  ? "border-crm-primary/40 bg-white text-crm-text"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]"
              }`}
              title={spoke.label}
            >
              {spoke.label}
            </div>
          </foreignObject>
        ))}
      </svg>

      {spokes.length === 0 && <p className="text-[13px] text-[var(--color-text-muted)]">{emptyLabel}</p>}
    </div>
  );
}
