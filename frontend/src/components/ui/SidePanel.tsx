"use client";

import { useEffect, useState, type ReactNode } from "react";

interface SidePanelProps {
  title: string;
  // Optional muted line under the title -- e.g. a live count of what's in
  // the panel. Omit it and the header renders exactly as before.
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  // Panel width; defaults to a comfortable reading column.
  width?: string;
}

// A right-side sliding drawer -- an alternative to the centered `Dialog`
// modal, for list/side views (e.g. the Priority board's Incoming and Archive
// panels) that read better anchored to the edge than floating mid-screen.
// Deliberately separate from Dialog so its centered-modal consumers are
// untouched.
export function SidePanel({ title, subtitle, onClose, children, width = "420px" }: SidePanelProps) {
  // Off-canvas on first paint, then slide in -- gives the enter transition
  // something to animate from.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      {/* Backdrop -- click to dismiss. */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width, maxWidth: "100%" }}
        className={`relative flex h-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="m-0 text-[16px] font-bold text-crm-text">{title}</h3>
            {subtitle && <p className="m-0 mt-0.5 text-[11.5px] font-semibold text-[var(--color-text-muted)]">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
