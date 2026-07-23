"use client";

import { useMemo } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { OrgChartEmployeeResponse } from "@orelia/common";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { t } from "@/lib/i18n";

// Story 1.7 -- read-only Organization Chart. A single Company root node is
// always present (named after the tenant, never creatable/deletable);
// employees with a reporting manager hang beneath them, colored by
// department; employees with no manager sit in the "unplaced" side panel
// (visible to everyone with EMPLOYEES_VIEW, so data gaps are never hidden).
// Edit mode (dragging, re-parenting, saving) is Story 1.8, deliberately not
// built here.

const COMPANY_NODE_ID = "company-root";
const NODE_WIDTH = 230;
const NODE_HEIGHT = 78;

// Department color assignment: deterministic per departmentId (sorted, then
// cycled through the palette) so colors are stable across reloads for the
// same set of departments. Muted hues -- the brand red stays reserved for
// primary actions per the design system.
const DEPARTMENT_PALETTE = [
  "#2563eb", // blue
  "#0d9488", // teal
  "#9333ea", // purple
  "#d97706", // amber
  "#0891b2", // cyan
  "#65a30d", // lime
  "#c2410c", // orange
  "#4f46e5", // indigo
  "#be185d", // pink
  "#047857", // emerald
];
const NO_DEPARTMENT_COLOR = "#64748b"; // slate -- employees with no department

type EmployeeNodeData = {
  employee: OrgChartEmployeeResponse;
  color: string;
  [key: string]: unknown;
};

type CompanyNodeData = {
  companyName: string;
  [key: string]: unknown;
};

function CompanyNode({ data }: NodeProps<Node<CompanyNodeData>>) {
  return (
    <div className="rounded-xl border-2 border-crm-shell bg-crm-shell px-6 py-3 text-center shadow-md">
      <Handle type="source" position={Position.Bottom} className="!bg-crm-shell" />
      <div className="text-[11px] font-semibold tracking-[0.08em] text-white/60 uppercase">
        {t("employees.orgChart.companyLabel")}
      </div>
      <div className="text-[15px] font-bold text-white">{data.companyName}</div>
    </div>
  );
}

function EmployeeNode({ data }: NodeProps<Node<EmployeeNodeData>>) {
  const { employee, color } = data;
  return (
    <div
      className="flex w-[230px] items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 shadow-sm"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
      {employee.profilePhotoUrl ? (
        <img
          src={resolveUploadUrl(employee.profilePhotoUrl)}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full border border-[var(--color-border)] object-cover"
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: color }}
        >
          {employee.fullName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-crm-text">{employee.fullName}</div>
        <div className="truncate text-[11.5px] text-[var(--color-text-muted)]">
          {employee.currentDesignation ?? t("employees.notSet")}
        </div>
        {employee.departmentName && (
          <div className="truncate text-[10.5px] font-semibold" style={{ color }}>
            {employee.departmentName}
          </div>
        )}
      </div>
    </div>
  );
}

const NODE_TYPES = { company: CompanyNode, employee: EmployeeNode };

// Top-down tree layout via dagre. Pure function of the placed set -- no
// persisted positions in view mode (manual repositioning is Story 1.8).
function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });
  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
    };
  });
}

interface OrgChartWidgetProps {
  companyName: string;
  employees: OrgChartEmployeeResponse[];
  permissions: string[];
}

export function OrgChartWidget({ companyName, employees, permissions }: OrgChartWidgetProps) {
  const canView = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW);

  const { nodes, edges, unplaced, departmentColor } = useMemo(() => {
    // Stable department -> color mapping.
    const departmentIds = Array.from(
      new Set(employees.map((employee) => employee.departmentId).filter((id): id is string => Boolean(id))),
    ).sort();
    const colorByDepartment = new Map<string, string>(
      departmentIds.map((id, index) => [id, DEPARTMENT_PALETTE[index % DEPARTMENT_PALETTE.length]!]),
    );
    const colorFor = (employee: OrgChartEmployeeResponse) =>
      (employee.departmentId && colorByDepartment.get(employee.departmentId)) || NO_DEPARTMENT_COLOR;

    // Placed = has a reporting manager; everyone else waits in the panel.
    const placed = employees.filter((employee) => employee.reportingManagerId !== null);
    const placedIds = new Set(placed.map((employee) => employee.id));
    const unplacedList = employees.filter((employee) => employee.reportingManagerId === null);

    const chartNodes: Node[] = [
      {
        id: COMPANY_NODE_ID,
        type: "company",
        position: { x: 0, y: 0 },
        data: { companyName } satisfies CompanyNodeData,
        draggable: false,
        selectable: false,
      },
      ...placed.map(
        (employee): Node => ({
          id: employee.id,
          type: "employee",
          position: { x: 0, y: 0 },
          data: { employee, color: colorFor(employee) } satisfies EmployeeNodeData,
          draggable: false,
        }),
      ),
    ];

    // Edge to the actual manager when they're on the canvas; managers who
    // are themselves unplaced (or exited, i.e. absent from this payload)
    // can't anchor a subtree, so those reports attach under the Company
    // root rather than floating detached.
    const chartEdges: Edge[] = placed.map((employee) => {
      const managerOnCanvas = employee.reportingManagerId && placedIds.has(employee.reportingManagerId);
      const source = managerOnCanvas ? employee.reportingManagerId! : COMPANY_NODE_ID;
      return {
        id: `${source}->${employee.id}`,
        source,
        target: employee.id,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      };
    });

    return {
      nodes: layoutNodes(chartNodes, chartEdges),
      edges: chartEdges,
      unplaced: unplacedList,
      departmentColor: colorFor,
    };
  }, [employees, companyName]);

  if (!canView) {
    return (
      <div className="content-card">
        <div className="empty-state">
          <p className="empty-state-title">{t("employees.orgChart.title")}</p>
          <p className="empty-state-message">{t("employees.orgChart.noAccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{t("employees.orgChart.title")}</h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("employees.orgChart.subtitle")}</p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* ── Canvas ── */}
        <div className="content-card h-[calc(100vh-230px)] min-h-[420px] flex-1 overflow-hidden p-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.2}
          >
            <Background gap={18} size={1.5} color="#e2e8f0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* ── Unplaced panel -- visible to every viewer so data gaps show ── */}
        <div className="content-card w-[280px] shrink-0 self-start">
          <h2 className="m-0 mb-1 text-[15px] font-bold text-crm-text">
            {t("employees.orgChart.unplacedTitle")}
            <span className="ml-2 inline-block rounded-full bg-[#f1f5f9] px-2 py-[1px] text-[11.5px] font-semibold text-[var(--color-text-muted)]">
              {unplaced.length}
            </span>
          </h2>
          <p className="m-0 mb-3 text-[12px] text-[var(--color-text-muted)]">
            {t("employees.orgChart.unplacedHint")}
          </p>
          {unplaced.length === 0 ? (
            <p className="m-0 text-[12.5px] text-[var(--color-text-muted)]">
              {t("employees.orgChart.unplacedEmpty")}
            </p>
          ) : (
            <div className="flex max-h-[calc(100vh-330px)] flex-col gap-2 overflow-y-auto">
              {unplaced.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[#f8fafc] px-2.5 py-2"
                  style={{ borderLeft: `3px solid ${departmentColor(employee)}` }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold text-white"
                    style={{ background: departmentColor(employee) }}
                  >
                    {employee.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-crm-text">{employee.fullName}</div>
                    <div className="truncate text-[11px] text-[var(--color-text-muted)]">
                      {employee.departmentName ?? t("employees.notSet")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
