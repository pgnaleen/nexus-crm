"use client";

import { useRouter } from "next/navigation";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { ChangePasswordForm } from "../profile/_components/ChangePasswordForm";

// Same navy dot+gradient shell technique as DashboardLayout's SHELL_BG
// (frontend/src/app/[tenant]/(dashboard)/layout.tsx) -- intentionally
// mirrored here rather than shared, since layout.tsx is a server component
// and this one needs to stay a client component for useRouter.
const SHELL_BG =
  "relative bg-crm-shell [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(160deg,var(--color-crm-shell-gradient-start)_0%,var(--color-crm-shell)_55%,var(--color-crm-shell-gradient-end)_100%)] [background-size:22px_22px,100%_100%]";

interface ForcedPasswordChangeGateProps {
  displayName: string;
}

// Rendered by DashboardLayout instead of the real sidebar/topbar/children
// whenever session.user.mustChangePassword is true -- a user who logged in
// with a temporary (admin- or system-generated) password must set their own
// before they can reach anything else in the app. Reuses ChangePasswordForm
// as-is (it already requires the current password and clears
// mustChangePassword server-side on success); onSuccess just refreshes the
// route so DashboardLayout re-fetches the session and swaps this out for the
// real dashboard once the flag has actually cleared.
export function ForcedPasswordChangeGate({ displayName }: ForcedPasswordChangeGateProps) {
  const router = useRouter();

  return (
    <div className={`flex h-screen items-center justify-center overflow-hidden p-4 ${SHELL_BG}`}>
      <div className="pointer-events-none absolute -top-[120px] -right-[100px] h-[420px] w-[420px] rounded-full bg-crm-shell-gradient-end/30 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-[120px] -left-[100px] h-[360px] w-[360px] rounded-full bg-crm-shell/30 blur-[80px]" />

      <div className="relative w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-5 flex justify-center">
          <NexusLogo variant="mark" tone="dark" size={48} />
        </div>
        <h1 className="mb-1.5 text-center text-[20px] font-bold text-[var(--color-text)]">
          Set a new password
        </h1>
        <p className="mb-6 text-center text-[13px] text-[var(--color-text-muted)]">
          Hi {displayName} — for security, you need to set your own password before continuing.
        </p>

        <ChangePasswordForm onSuccess={() => router.refresh()} />
      </div>
    </div>
  );
}
