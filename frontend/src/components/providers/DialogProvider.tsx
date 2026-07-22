"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { verifyPassword } from "@/lib/api/auth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { CascadeDeleteConfirmDialog } from "@/components/ui/CascadeDeleteConfirmDialog";

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

interface CascadeDeleteOptions {
  title: string;
  warningMessage: string;
}

type CascadeDeleteRequest = CascadeDeleteOptions & { resolve: (confirmed: boolean) => void };

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmCascadeDelete: (options: CascadeDeleteOptions) => Promise<boolean>;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Mounted once in the dashboard layout -- renders a single ConfirmDialog, a
// single CascadeDeleteConfirmDialog, and a single AlertDialog for the whole
// app, so individual widgets call useConfirm()/useCascadeDeleteConfirm()/
// useAlert() instead of each wiring up their own local dialog state.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const [cascadeRequest, setCascadeRequest] = useState<CascadeDeleteRequest | null>(null);
  const [cascadePassword, setCascadePassword] = useState("");
  const [cascadeError, setCascadeError] = useState<string | null>(null);
  const [cascadeVerifying, setCascadeVerifying] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest({ ...options, resolve });
    });
  }, []);

  const confirmCascadeDelete = useCallback((options: CascadeDeleteOptions) => {
    return new Promise<boolean>((resolve) => {
      setCascadePassword("");
      setCascadeError(null);
      setCascadeRequest({ ...options, resolve });
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

  function cancelCascadeDelete() {
    cascadeRequest?.resolve(false);
    setCascadeRequest(null);
  }

  // The password field only gates whether the button is *clickable* --
  // whether it's actually correct is always checked server-side here before
  // the caller's delete is allowed to proceed. Never resolved true on a
  // network/verification failure.
  async function confirmCascadeDeletePassword() {
    if (!cascadeRequest || !cascadePassword.trim() || cascadeVerifying) return;

    setCascadeVerifying(true);
    setCascadeError(null);
    try {
      const { valid } = await verifyPassword(cascadePassword);
      if (!valid) {
        setCascadeError("Incorrect password. Please try again.");
        return;
      }
      cascadeRequest.resolve(true);
      setCascadeRequest(null);
    } catch {
      setCascadeError("Could not verify your password. Please try again.");
    } finally {
      setCascadeVerifying(false);
    }
  }

  return (
    <DialogContext.Provider value={{ confirm, confirmCascadeDelete, showError, showSuccess }}>
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

      <CascadeDeleteConfirmDialog
        open={cascadeRequest !== null}
        title={cascadeRequest?.title ?? ""}
        warningMessage={cascadeRequest?.warningMessage ?? ""}
        password={cascadePassword}
        onPasswordChange={setCascadePassword}
        error={cascadeError}
        verifying={cascadeVerifying}
        onConfirm={confirmCascadeDeletePassword}
        onCancel={cancelCascadeDelete}
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

export function useCascadeDeleteConfirm(): DialogContextValue["confirmCascadeDelete"] {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useCascadeDeleteConfirm must be used within a DialogProvider");
  return ctx.confirmCascadeDelete;
}

export function useAlert(): Pick<DialogContextValue, "showError" | "showSuccess"> {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useAlert must be used within a DialogProvider");
  return { showError: ctx.showError, showSuccess: ctx.showSuccess };
}
