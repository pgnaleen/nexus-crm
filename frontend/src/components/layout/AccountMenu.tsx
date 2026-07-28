"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface AccountMenuProps {
  tenantName: string;
  userDisplayName: string;
  tenantSlug: string;
  /**
   * Signed URL of the user's employee photo, or null for initials. Comes from
   * the dashboard layout's own /employees/me fetch, so it's the same image My
   * Profile shows and re-signs on every server render like every other
   * *DisplayUrl in this app.
   */
  userPhotoUrl?: string | null;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function AccountMenu({
  tenantName,
  userDisplayName,
  tenantSlug,
  userPhotoUrl = null,
}: AccountMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setIsOpen(false);
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Session may already be dead (expired token, refresh already failed
      // elsewhere) -- logout is a one-way action from the user's
      // perspective either way, so fall through to the same redirect.
    }
    router.push(`/${tenantSlug}`);
    router.refresh();
  }

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border-none bg-crm-shell text-xs font-bold text-white"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Account menu"
      >
        {userPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFor(userDisplayName)
        )}
      </button>

      {isOpen && (
        <div className="account-menu-dropdown">
          <div className="account-menu-info flex items-center gap-2.5">
            {userPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userPhotoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crm-primary-tint text-xs font-bold text-crm-primary">
                {initialsFor(userDisplayName)}
              </span>
            )}
            <span className="min-w-0">
              <span className="account-menu-name block truncate">{userDisplayName}</span>
              <span className="account-menu-tenant block truncate">{tenantName}</span>
            </span>
          </div>
          <Link
            href={`/${tenantSlug}/profile`}
            className="account-menu-item"
            onClick={() => setIsOpen(false)}
          >
            My Profile
          </Link>
          <button type="button" className="account-menu-item account-menu-item-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}

      {isLoggingOut && <LoadingOverlay label="Signing out…" />}
    </div>
  );
}
