"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import ReactGridLayout, { useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { CheckCircleIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/Dialog";

// Stages 1-3 of the widget-dashboard feature -- see epics-system.md, Story 1.8.
//
// Layout + which widgets are currently visible both persist to localStorage only for now, not
// the backend -- this is still a dummy-data mock phase (per the project's mock-first workflow).
//
// Tying each widget to whichever section/permission its data belongs to (so a viewer only ever
// sees widgets for sections they actually have access to) is real permission-driven work for a
// later stage -- no per-widget permission concept exists yet, so the picker panel below lists
// every widget to everyone. That's the one piece deliberately not built yet; the panel mechanism
// itself is real, not deferred.
const LAYOUT_STORAGE_KEY = "orelia-dashboard-layout-v4";
const VISIBLE_STORAGE_KEY = "orelia-dashboard-visible-v1";

export interface WidgetEntry {
  label: string;
  node: ReactNode;
}

interface DashboardWidgetGridProps {
  widgets: Record<string, WidgetEntry>;
  defaultLayout: Layout;
}

function loadLayout(defaultLayout: Layout): Layout {
  if (typeof window === "undefined") return defaultLayout;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return defaultLayout;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultLayout;
  } catch {
    return defaultLayout;
  }
}

function loadVisibleKeys(allKeys: string[]): string[] {
  if (typeof window === "undefined") return allKeys;
  try {
    const raw = window.localStorage.getItem(VISIBLE_STORAGE_KEY);
    if (!raw) return allKeys;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => allKeys.includes(k)) : allKeys;
  } catch {
    return allKeys;
  }
}

// A widget removed from the grid needs *somewhere* to go when re-added from the panel -- appended
// below whatever's already there, at a sensible default size, letting the grid's own vertical
// compaction settle it into place rather than computing a real free slot ourselves.
function placeNewWidget(key: string, currentLayout: Layout): LayoutItem {
  const maxY = currentLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return { i: key, x: 0, y: maxY, w: 4, h: 3 };
}

export function DashboardWidgetGrid({ widgets, defaultLayout }: DashboardWidgetGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(Object.keys(widgets));

  const allKeys = Object.keys(widgets);

  useEffect(() => {
    setLayout(loadLayout(defaultLayout));
    setVisibleKeys(loadVisibleKeys(allKeys));
    // Only ever load from storage once on mount -- defaultLayout/widgets are fresh on every
    // render from the caller, so they must not be dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistVisibleKeys(next: string[]) {
    setVisibleKeys(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function persistLayout(next: Layout) {
    setLayout(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function removeWidget(key: string) {
    persistVisibleKeys(visibleKeys.filter((k) => k !== key));
  }

  function addWidget(key: string) {
    persistVisibleKeys([...visibleKeys, key]);
    if (!layout.some((item) => item.i === key)) {
      persistLayout([...layout, placeNewWidget(key, layout)]);
    }
  }

  function toggleEditMode() {
    const next = !isEditMode;
    setIsEditMode(next);
    if (!next) setIsPanelOpen(false);
  }

  const visibleLayout = layout.filter((item) => visibleKeys.includes(item.i));
  const hiddenKeys = allKeys.filter((key) => !visibleKeys.includes(key));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-[26px] font-bold text-crm-text">Dashboard</h2>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={() => setIsPanelOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-crm-text hover:bg-crm-primary-tint"
            >
              <PlusIcon size={13} />
              Add widgets
            </button>
          )}
          <button
            type="button"
            onClick={toggleEditMode}
            title={isEditMode ? "Done editing" : "Edit dashboard layout"}
            aria-label={isEditMode ? "Done editing" : "Edit dashboard layout"}
            className={
              isEditMode
                ? "flex h-8 w-8 items-center justify-center rounded-lg bg-crm-primary text-white"
                : "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-crm-text hover:bg-crm-primary-tint"
            }
          >
            {isEditMode ? <CheckCircleIcon size={15} /> : <EditIcon size={15} />}
          </button>
        </div>
      </div>

      {isEditMode && (
        <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">
          Drag a widget's corner to resize it, drag its body to move it, or click the trash
          icon to remove it. Click the checkmark when you're happy with the arrangement.
        </p>
      )}

      <div ref={containerRef as RefObject<HTMLDivElement>}>
        {mounted && (
          <ReactGridLayout
            layout={visibleLayout}
            width={width}
            gridConfig={{ cols: 12, rowHeight: 70, margin: [12, 12] }}
            dragConfig={{ enabled: isEditMode }}
            resizeConfig={{ enabled: isEditMode }}
            onLayoutChange={persistLayout}
          >
            {visibleKeys.map((key) => (
              <div
                key={key}
                className={isEditMode ? "relative outline-dashed outline-2 outline-crm-primary/30" : "relative"}
              >
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeWidget(key)}
                    title={`Remove ${widgets[key]?.label ?? "widget"}`}
                    aria-label={`Remove ${widgets[key]?.label ?? "widget"}`}
                    className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-crm-primary-tint hover:text-crm-primary"
                  >
                    <TrashIcon size={12} />
                  </button>
                )}
                {widgets[key]?.node}
              </div>
            ))}
          </ReactGridLayout>
        )}
      </div>

      <Dialog open={isPanelOpen} title="Add widgets" onClose={() => setIsPanelOpen(false)} maxWidth="420px">
        <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">
          Every widget is listed here for now — showing only the ones your access allows is a
          later step, not built yet.
        </p>
        <div className="max-h-[60vh] overflow-y-auto">
          {hiddenKeys.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Every widget is already on your dashboard.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {hiddenKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => addWidget(key)}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-[13px] text-crm-text hover:bg-crm-primary-tint"
                >
                  {widgets[key]?.label ?? key}
                  <PlusIcon size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
