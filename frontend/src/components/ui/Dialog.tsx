"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

export function Dialog({ open, title, onClose, children, maxWidth }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="dialog-overlay" onMouseDown={handleOverlayClick} role="presentation">
      <div 
        className="dialog-panel" 
        role="dialog" 
        aria-modal="true" 
        aria-label={typeof title === "string" ? title : undefined}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div className="dialog-header">
          <h3 className="dialog-title">{title}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
