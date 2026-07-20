"use client";

interface UndoToastProps {
  message: string;
  actionLabel?: string;
  durationMs: number;
  onAction: () => void;
}

export function UndoToast({ message, actionLabel = "Undo", durationMs, onAction }: UndoToastProps) {
  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast-message">{message}</span>
      <button type="button" className="undo-toast-action" onClick={onAction}>
        {actionLabel}
      </button>
      <div className="undo-toast-progress" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );
}
