"use client";

import { useEffect } from "react";
import { subscribeToAuthChanges } from "@/lib/auth/tab-sync";

// Mounted once in the dashboard layout, same pattern as DialogProvider/
// ToastProvider -- reloads this tab if another tab logs in as a different
// user or logs out, since cookies are shared across tabs but nothing else
// signals the change to an already-open one. Renders nothing; pure
// side-effect mount.
export function TabSyncListener() {
  useEffect(() => subscribeToAuthChanges(), []);
  return null;
}
