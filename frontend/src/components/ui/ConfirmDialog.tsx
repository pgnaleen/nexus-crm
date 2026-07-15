"use client";

import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" }}>
        <div style={{ 
          flexShrink: 0,
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          width: "48px", 
          height: "48px", 
          borderRadius: "50%", 
          backgroundColor: isDestructive ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
          color: isDestructive ? "#ef4444" : "#3b82f6"
        }}>
          {isDestructive ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>
        <div style={{ paddingTop: "2px" }}>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
            {message}
          </p>
        </div>
      </div>
      
      <div className="dialog-actions" style={{ marginTop: "0", borderTop: "1px solid var(--color-border)", paddingTop: "20px" }}>
        <Button type="button" variant="secondary" onClick={onCancel} style={{ padding: "8px 16px" }}>
          {cancelLabel}
        </Button>
        <Button 
          type="button" 
          variant="primary" 
          onClick={onConfirm} 
          style={isDestructive ? { backgroundColor: "#ef4444", color: "#ffffff", border: "none", padding: "8px 16px" } : { padding: "8px 16px" }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
