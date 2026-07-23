"use client";

import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  isError?: boolean;
}

export function AlertDialog({
  open,
  title,
  message,
  onClose,
  isError = false,
}: AlertDialogProps) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" }}>
        <div style={{ 
          flexShrink: 0,
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          width: "48px", 
          height: "48px", 
          borderRadius: "50%", 
          backgroundColor: isError ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
          color: isError ? "#ef4444" : "#3b82f6"
        }}>
          {isError ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
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
      
      <div className="mt-0 flex justify-end gap-2.5 border-t border-[var(--color-border)] pt-5">
        <Button 
          type="button" 
          variant="primary" 
          onClick={onClose}
          style={{ padding: "8px 24px" }}
        >
          OK
        </Button>
      </div>
    </Dialog>
  );
}
