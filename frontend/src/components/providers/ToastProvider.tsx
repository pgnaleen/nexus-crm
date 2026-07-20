"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { UndoToast } from "@/components/ui/UndoToast";

interface ToastOptions {
  message: string;
  actionLabel?: string;
  durationMs?: number;
  onAction?: () => void;
  onExpire?: () => void;
}

interface ToastEntry extends ToastOptions {
  id: string;
  durationMs: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  // Forces a still-pending toast's onExpire to run right now instead of
  // waiting out its timer -- used when the caller is unmounting and a
  // pending action would otherwise be silently lost.
  flushToast: (id: string) => void;
  // Cancels a still-pending toast without firing onExpire or onAction --
  // used when a caller is replacing its own in-flight toast with a new one
  // (e.g. the same card was dragged again before the first move persisted).
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Mounted once in the dashboard layout, same pattern as DialogProvider --
// callers get an imperative showToast() instead of each owning local toast
// state. Entries live in a ref (source of truth for timers) with a render
// tick to trigger re-paints, so dismiss logic never runs inside a setState
// updater (which React can invoke more than once, e.g. under StrictMode).
export function ToastProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef<Map<string, ToastEntry>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [, setRenderTick] = useState(0);

  const sync = useCallback(() => setRenderTick((n) => n + 1), []);

  const dismiss = useCallback(
    (id: string, fireExpire: boolean) => {
      const timer = timersRef.current.get(id);
      if (timer) clearTimeout(timer);
      timersRef.current.delete(id);
      const entry = entriesRef.current.get(id);
      entriesRef.current.delete(id);
      sync();
      if (fireExpire) entry?.onExpire?.();
    },
    [sync],
  );

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = crypto.randomUUID();
      const durationMs = options.durationMs ?? 5000;
      entriesRef.current.set(id, { ...options, id, durationMs });
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id, true), durationMs),
      );
      sync();
      return id;
    },
    [dismiss, sync],
  );

  const flushToast = useCallback(
    (id: string) => {
      if (!entriesRef.current.has(id)) return;
      dismiss(id, true);
    },
    [dismiss],
  );

  const dismissToast = useCallback(
    (id: string) => {
      if (!entriesRef.current.has(id)) return;
      dismiss(id, false);
    },
    [dismiss],
  );

  function handleAction(id: string) {
    const entry = entriesRef.current.get(id);
    dismiss(id, false);
    entry?.onAction?.();
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const toasts = Array.from(entriesRef.current.values());

  return (
    <ToastContext.Provider value={{ showToast, flushToast, dismissToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((toast) => (
            <UndoToast
              key={toast.id}
              message={toast.message}
              actionLabel={toast.actionLabel}
              durationMs={toast.durationMs}
              onAction={() => handleAction(toast.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
