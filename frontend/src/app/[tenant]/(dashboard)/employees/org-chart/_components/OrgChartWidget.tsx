"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { PERMISSIONS } from "@orelia/common";
import type { DepartmentPickerResponse, OrgChartEmployeeResponse, OrgChartStructureChange } from "@orelia/common";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { getOrgChart, updateOrgChartStructure } from "@/lib/api/employees";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { useAlert, useConfirm } from "@/components/providers/DialogProvider";
import { t } from "@/lib/i18n";

// Stories 1.7 + 1.8 -- the Organization Chart. View mode is read-only; edit
// mode ("Edit Chart", EMPLOYEES_UPDATE only) is a playground: drag employees
// in from the unplaced panel, draw/redraw reporting connections, drop
// Department anchors (purely visual -- they never touch anyone's department
// field), reposition freely. NOTHING is written until Save, which sends
// every changed reporting relationship together (PATCH
// /employees/org-chart/structure); Cancel reverts to the last-saved state.
// Reporting loops are rejected at draw time here AND re-validated
// server-side.

const COMPANY_NODE_ID = "company-root";
const NODE_WIDTH = 230;
const NODE_HEIGHT = 78;

const DEPARTMENT_PALETTE = [
  "#2563eb",
  "#0d9488",
  "#9333ea",
  "#d97706",
  "#0891b2",
  "#65a30d",
  "#c2410c",
  "#4f46e5",
  "#be185d",
  "#047857",
];
const NO_DEPARTMENT_COLOR = "#64748b";

type EmployeeNodeData = {
  employee: OrgChartEmployeeResponse;
  color: string;
  // Story 1.9 -- branch collapse. Present only on cards with direct
  // reports; toggling hides/shows the whole subtree beneath this card.
  reportCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: (employeeId: string) => void;
  [key: string]: unknown;
};

type CompanyNodeData = {
  companyName: string;
  [key: string]: unknown;
};

type DepartmentNodeData = {
  name: string;
  color: string;
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
  const { employee, color, reportCount, isCollapsed, onToggleCollapse } = data;
  return (
    <div
      className="relative flex w-[230px] items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 shadow-sm"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
      {/* Story 1.9 -- collapse/expand control, only on cards with reports.
          Collapsed state shows the hidden-report count as the indicator. */}
      {typeof reportCount === "number" && reportCount > 0 && onToggleCollapse && (
        <button
          type="button"
          className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-1 text-[10px] font-bold shadow-sm transition-colors hover:bg-[#f1f5f9]"
          style={{ color }}
          aria-label={
            isCollapsed
              ? t("employees.orgChart.expandAriaLabel", { name: employee.fullName })
              : t("employees.orgChart.collapseAriaLabel", { name: employee.fullName })
          }
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(employee.id);
          }}
        >
          {isCollapsed ? `+${reportCount}` : "−"}
        </button>
      )}
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

// Story 1.8 -- visual/structural anchor only: no handles, no connections,
// never part of the save payload, never sets anyone's department field.
function DepartmentAnchorNode({ data }: NodeProps<Node<DepartmentNodeData>>) {
  return (
    <div
      className="rounded-full border-2 bg-white px-5 py-2 text-[13px] font-bold shadow-sm"
      style={{ borderColor: data.color, color: data.color }}
    >
      {data.name}
    </div>
  );
}

const NODE_TYPES = { company: CompanyNode, employee: EmployeeNode, departmentAnchor: DepartmentAnchorNode };

// Story 1.9 -- Auto-arrange reuses this too. Department anchors are
// deliberately NOT laid out (dagre would pile the disconnected nodes into a
// corner); they keep whatever position they were dropped at.
function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });
  for (const node of nodes) {
    if (node.type === "departmentAnchor") continue;
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);
  return nodes.map((node) => {
    if (node.type === "departmentAnchor") return node;
    const position = graph.node(node.id);
    return {
      ...node,
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
    };
  });
}

function edgeStyle(): Edge["style"] {
  return { stroke: "#94a3b8", strokeWidth: 1.5 };
}

interface OrgChartWidgetProps {
  companyName: string;
  employees: OrgChartEmployeeResponse[];
  departments: DepartmentPickerResponse[];
  permissions: string[];
}

function OrgChartInner({ companyName, employees: initialEmployees, departments, permissions }: OrgChartWidgetProps) {
  const confirm = useConfirm();
  const { showError } = useAlert();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const canView = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW);
  const canUpdate = permissions.includes(PERMISSIONS.EMPLOYEES_UPDATE);

  // Last-saved baseline -- what view mode shows and what Cancel reverts to.
  const [employees, setEmployees] = useState(initialEmployees);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const colorForEmployee = useMemo(() => {
    const departmentIds = Array.from(
      new Set(employees.map((employee) => employee.departmentId).filter((id): id is string => Boolean(id))),
    ).sort();
    const colorByDepartment = new Map<string, string>(
      departmentIds.map((id, index) => [id, DEPARTMENT_PALETTE[index % DEPARTMENT_PALETTE.length]!]),
    );
    return (employee: OrgChartEmployeeResponse) =>
      (employee.departmentId && colorByDepartment.get(employee.departmentId)) || NO_DEPARTMENT_COLOR;
  }, [employees]);

  const colorForDepartment = useMemo(() => {
    const departmentIds = Array.from(
      new Set(employees.map((employee) => employee.departmentId).filter((id): id is string => Boolean(id))),
    ).sort();
    const colorByDepartment = new Map<string, string>(
      departmentIds.map((id, index) => [id, DEPARTMENT_PALETTE[index % DEPARTMENT_PALETTE.length]!]),
    );
    return (departmentId: string) => colorByDepartment.get(departmentId) ?? NO_DEPARTMENT_COLOR;
  }, [employees]);

  // Build nodes/edges for the last-saved structure. Placed = has a manager
  // OR sits at the root; orphans (manager unplaced/exited) attach under the
  // root so nothing floats detached.
  const buildFromBaseline = useCallback(
    (data: OrgChartEmployeeResponse[]): { nodes: Node[]; edges: Edge[] } => {
      const placed = data.filter((employee) => employee.reportingManagerId !== null || employee.placedAtRoot);
      const placedIds = new Set(placed.map((employee) => employee.id));
      const nodes: Node[] = [
        {
          id: COMPANY_NODE_ID,
          type: "company",
          position: { x: 0, y: 0 },
          data: { companyName } satisfies CompanyNodeData,
          draggable: false,
          selectable: false,
          deletable: false,
        },
        ...placed.map(
          (employee): Node => ({
            id: employee.id,
            type: "employee",
            position: { x: 0, y: 0 },
            data: { employee, color: colorForEmployee(employee) } satisfies EmployeeNodeData,
            deletable: false,
          }),
        ),
      ];
      const edges: Edge[] = placed.map((employee) => {
        const managerOnCanvas = employee.reportingManagerId && placedIds.has(employee.reportingManagerId);
        const source = managerOnCanvas ? employee.reportingManagerId! : COMPANY_NODE_ID;
        return {
          id: `${source}->${employee.id}`,
          source,
          target: employee.id,
          type: "smoothstep",
          style: edgeStyle(),
          deletable: false,
        };
      });
      return { nodes: layoutNodes(nodes, edges), edges };
    },
    [companyName, colorForEmployee],
  );

  const initial = useMemo(() => buildFromBaseline(employees), [buildFromBaseline, employees]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Story 1.9 -- collapsed managers: their whole subtree is hidden (nodes
  // AND edges), and their card shows the hidden-report count.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      if (edge.source === COMPANY_NODE_ID) continue;
      const list = map.get(edge.source) ?? [];
      list.push(edge.target);
      map.set(edge.source, list);
    }
    return map;
  }, [edges]);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const collapsedId of collapsedIds) {
      const queue = [...(childrenOf.get(collapsedId) ?? [])];
      while (queue.length > 0) {
        const id = queue.pop()!;
        if (hidden.has(id)) continue;
        hidden.add(id);
        queue.push(...(childrenOf.get(id) ?? []));
      }
    }
    return hidden;
  }, [collapsedIds, childrenOf]);

  const toggleCollapse = useCallback((employeeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }, []);

  // Employees currently represented by a canvas node.
  const onCanvasIds = useMemo(() => new Set(nodes.filter((node) => node.type === "employee").map((n) => n.id)), [nodes]);
  const unplaced = employees.filter((employee) => !onCanvasIds.has(employee.id));

  function resetToBaseline(data: OrgChartEmployeeResponse[]) {
    const rebuilt = buildFromBaseline(data);
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
    setCollapsedIds(new Set());
  }

  // Story 1.9 -- Auto-arrange (edit mode): snap back to the automatic
  // top-down dagre layout. A layout reset only, never a save.
  function handleAutoArrange() {
    setNodes((current) => layoutNodes(current, edges));
  }

  // ── Edit-mode interactions ────────────────────────────────────────────

  // Loop rejection at draw time (AC): walking up the WOULD-BE ancestors of
  // the new manager must never reach the employee being re-parented.
  const wouldCreateLoop = useCallback(
    (managerId: string, employeeId: string): boolean => {
      const parentOf = new Map<string, string>();
      for (const edge of edges) {
        if (edge.source !== COMPANY_NODE_ID) {
          parentOf.set(edge.target, edge.source);
        }
      }
      let cursor: string | undefined = managerId;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === employeeId) return true;
        if (visited.has(cursor)) return false;
        visited.add(cursor);
        cursor = parentOf.get(cursor);
      }
      return false;
    },
    [edges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isEditMode) return;
      const { source, target } = connection;
      if (!source || !target || target === COMPANY_NODE_ID) return;
      // Anchors have no handles, but belt-and-braces: never wire them.
      const sourceNode = nodes.find((node) => node.id === source);
      const targetNode = nodes.find((node) => node.id === target);
      if (targetNode?.type !== "employee") return;
      if (source !== COMPANY_NODE_ID && sourceNode?.type !== "employee") return;
      if (source === target) return;
      if (source !== COMPANY_NODE_ID && wouldCreateLoop(source, target)) {
        showError(t("employees.orgChart.loopRejected"));
        return;
      }
      // One manager per employee: the new connection replaces any existing
      // incoming edge on the target.
      setEdges((current) => [
        ...current.filter((edge) => edge.target !== target),
        {
          id: `${source}->${target}`,
          source,
          target,
          type: "smoothstep",
          style: edgeStyle(),
        },
      ]);
    },
    [isEditMode, nodes, wouldCreateLoop, setEdges, showError],
  );

  // Drag sources: unplaced employees and department anchors.
  function handlePanelDragStart(event: DragEvent, kind: "employee" | "department", id: string) {
    event.dataTransfer.setData("application/orelia-orgchart", JSON.stringify({ kind, id }));
    event.dataTransfer.effectAllowed = "move";
  }

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (!isEditMode) return;
      const raw = event.dataTransfer.getData("application/orelia-orgchart");
      if (!raw) return;
      const { kind, id } = JSON.parse(raw) as { kind: "employee" | "department"; id: string };
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      if (kind === "employee") {
        const employee = employees.find((item) => item.id === id);
        if (!employee || onCanvasIds.has(id)) return;
        setNodes((current) => [
          ...current,
          {
            id: employee.id,
            type: "employee",
            position,
            data: { employee, color: colorForEmployee(employee) } satisfies EmployeeNodeData,
          },
        ]);
        return;
      }

      const department = departments.find((item) => item.id === id);
      if (!department) return;
      setNodes((current) => [
        ...current,
        {
          // Unique per drop -- the same department can anchor several areas.
          id: `dept-anchor-${id}-${current.length}`,
          type: "departmentAnchor",
          position,
          data: { name: department.name, color: colorForDepartment(id) } satisfies DepartmentNodeData,
          connectable: false,
        },
      ]);
    },
    [isEditMode, employees, departments, onCanvasIds, screenToFlowPosition, setNodes, colorForEmployee, colorForDepartment],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // ── Save / Cancel ─────────────────────────────────────────────────────

  function computeChanges(): OrgChartStructureChange[] {
    const parentOf = new Map<string, string>();
    for (const edge of edges) {
      parentOf.set(edge.target, edge.source);
    }
    const baseline = new Map(employees.map((employee) => [employee.id, employee]));
    const changes: OrgChartStructureChange[] = [];
    for (const node of nodes) {
      if (node.type !== "employee") continue;
      const before = baseline.get(node.id);
      if (!before) continue;
      const parent = parentOf.get(node.id);
      // On canvas but not connected yet -> still unplaced; no change entry.
      const next: { reportingManagerId: string | null; placedAtRoot: boolean } = parent
        ? parent === COMPANY_NODE_ID
          ? { reportingManagerId: null, placedAtRoot: true }
          : { reportingManagerId: parent, placedAtRoot: false }
        : { reportingManagerId: null, placedAtRoot: false };
      if (before.reportingManagerId !== next.reportingManagerId || before.placedAtRoot !== next.placedAtRoot) {
        changes.push({ employeeId: node.id, ...next });
      }
    }
    return changes;
  }

  async function handleSave() {
    const changes = computeChanges();
    if (changes.length === 0) {
      setIsEditMode(false);
      resetToBaseline(employees);
      return;
    }
    const ok = await confirm({
      title: t("employees.orgChart.saveConfirm.title"),
      message: t("employees.orgChart.saveConfirm.message", { count: changes.length }),
      confirmLabel: t("employees.orgChart.saveConfirm.confirmLabel"),
    });
    if (!ok) return;

    setIsSaving(true);
    try {
      await updateOrgChartStructure({ changes });
      const fresh = await getOrgChart();
      setEmployees(fresh);
      setIsEditMode(false);
      const rebuilt = buildFromBaseline(fresh);
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("employees.orgChart.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setIsEditMode(false);
    resetToBaseline(employees);
  }

  // ──────────────────────────────────────────────────────────────────────

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
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">
            {isEditMode ? t("employees.orgChart.editSubtitle") : t("employees.orgChart.subtitle")}
          </p>
        </div>
        <div className="flex gap-2.5">
          {canUpdate && !isEditMode && (
            <Button type="button" onClick={() => setIsEditMode(true)}>
              {t("employees.orgChart.editButton")}
            </Button>
          )}
          {isEditMode && (
            <>
              <Button type="button" variant="secondary" onClick={handleAutoArrange} disabled={isSaving}>
                {t("employees.orgChart.autoArrangeButton")}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSaving}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="button" onClick={handleSave} isLoading={isSaving}>
                {t("employees.orgChart.saveButton")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-5">
        {/* ── Canvas ── */}
        <div
          ref={wrapperRef}
          className={`content-card h-[calc(100vh-230px)] min-h-[420px] flex-1 overflow-hidden p-0 ${
            isEditMode ? "outline outline-2 outline-offset-[-2px] outline-crm-primary/40" : ""
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes.map((node) => {
              if (node.type === "company") return node;
              if (node.type !== "employee") return { ...node, draggable: isEditMode };
              const reportCount = childrenOf.get(node.id)?.length ?? 0;
              return {
                ...node,
                draggable: isEditMode,
                hidden: hiddenIds.has(node.id),
                data: {
                  ...node.data,
                  reportCount,
                  isCollapsed: collapsedIds.has(node.id),
                  onToggleCollapse: toggleCollapse,
                },
              };
            })}
            edges={edges.map((edge) => ({
              ...edge,
              hidden: hiddenIds.has(edge.target) || hiddenIds.has(edge.source),
            }))}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            nodesConnectable={isEditMode}
            elementsSelectable={isEditMode}
            minZoom={0.2}
            deleteKeyCode={null}
          >
            <Background gap={18} size={1.5} color="#e2e8f0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* ── Side panel: unplaced employees (+ anchors in edit mode) ── */}
        <div className="flex w-[280px] shrink-0 flex-col gap-5 self-start">
          <div className="content-card">
            <h2 className="m-0 mb-1 text-[15px] font-bold text-crm-text">
              {t("employees.orgChart.unplacedTitle")}
              <span className="ml-2 inline-block rounded-full bg-[#f1f5f9] px-2 py-[1px] text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                {unplaced.length}
              </span>
            </h2>
            <p className="m-0 mb-3 text-[12px] text-[var(--color-text-muted)]">
              {isEditMode ? t("employees.orgChart.unplacedDragHint") : t("employees.orgChart.unplacedHint")}
            </p>
            {unplaced.length === 0 ? (
              <p className="m-0 text-[12.5px] text-[var(--color-text-muted)]">
                {t("employees.orgChart.unplacedEmpty")}
              </p>
            ) : (
              <div className="flex max-h-[calc(100vh-430px)] flex-col gap-2 overflow-y-auto">
                {unplaced.map((employee) => (
                  <div
                    key={employee.id}
                    draggable={isEditMode}
                    onDragStart={(event) => handlePanelDragStart(event, "employee", employee.id)}
                    className={`flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[#f8fafc] px-2.5 py-2 ${
                      isEditMode ? "cursor-grab active:cursor-grabbing" : ""
                    }`}
                    style={{ borderLeft: `3px solid ${colorForEmployee(employee)}` }}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold text-white"
                      style={{ background: colorForEmployee(employee) }}
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

          {isEditMode && departments.length > 0 && (
            <div className="content-card">
              <h2 className="m-0 mb-1 text-[15px] font-bold text-crm-text">
                {t("employees.orgChart.anchorsTitle")}
              </h2>
              <p className="m-0 mb-3 text-[12px] text-[var(--color-text-muted)]">
                {t("employees.orgChart.anchorsHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {departments.map((department) => (
                  <div
                    key={department.id}
                    draggable
                    onDragStart={(event) => handlePanelDragStart(event, "department", department.id)}
                    className="cursor-grab rounded-full border-2 bg-white px-3 py-1 text-[12px] font-bold active:cursor-grabbing"
                    style={{ borderColor: colorForDepartment(department.id), color: colorForDepartment(department.id) }}
                  >
                    {department.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrgChartWidget(props: OrgChartWidgetProps) {
  return (
    <ReactFlowProvider>
      <OrgChartInner {...props} />
    </ReactFlowProvider>
  );
}
