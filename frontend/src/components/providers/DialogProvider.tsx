"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertDialog } from "@/components/ui/AlertDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };

interface AlertState {
  title: string;
  message: string;
  isError: boolean;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Mounted once in the dashboard layout -- renders a single ConfirmDialog and
// a single AlertDialog for the whole app, so individual widgets call
// useConfirm()/useAlert() instead of each wiring up their own local
// open/message state and their own <ConfirmDialog>/<AlertDialog> JSX.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest({ ...options, resolve });
    });
  }, []);

  const showError = useCallback((message: string, title = "Error") => {
    setAlertState({ title, message, isError: true });
  }, []);

  const showSuccess = useCallback((message: string, title = "Success") => {
    setAlertState({ title, message, isError: false });
  }, []);

  function settleConfirm(confirmed: boolean) {
    confirmRequest?.resolve(confirmed);
    setConfirmRequest(null);
  }

  return (
    <DialogContext.Provider value={{ confirm, showError, showSuccess }}>
      {children}

      <ConfirmDialog
        open={confirmRequest !== null}
        title={confirmRequest?.title ?? ""}
        message={confirmRequest?.message ?? ""}
        confirmLabel={confirmRequest?.confirmLabel}
        cancelLabel={confirmRequest?.cancelLabel}
        isDestructive={confirmRequest?.isDestructive}
        onConfirm={() => settleConfirm(true)}
        onCancel={() => settleConfirm(false)}
      />

      <AlertDialog
        open={alertState !== null}
        title={alertState?.title ?? ""}
        message={alertState?.message ?? ""}
        isError={alertState?.isError}
        onClose={() => setAlertState(null)}
      />
    </DialogContext.Provider>
  );
}

export function useConfirm(): DialogContextValue["confirm"] {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm must be used within a DialogProvider");
  return ctx.confirm;
}

export function useAlert(): Pick<DialogContextValue, "showError" | "showSuccess"> {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useAlert must be used within a DialogProvider");
  return { showError: ctx.showError, showSuccess: ctx.showSuccess };
}
