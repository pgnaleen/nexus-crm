"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface AccountMenuProps {
  tenantName: string;
  userDisplayName: string;
  tenantSlug: string;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function AccountMenu({ tenantName, userDisplayName, tenantSlug }: AccountMenuProps) {
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
      router.push(`/${tenantSlug}`);
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className="avatar-btn"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Account menu"
      >
        {initialsFor(userDisplayName)}
      </button>

      {isOpen && (
        <div className="account-menu-dropdown">
          <div className="account-menu-info">
            <div className="account-menu-name">{userDisplayName}</div>
            <div className="account-menu-tenant">{tenantName}</div>
          </div>
          <button type="button" className="account-menu-item account-menu-item-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}

      {isLoggingOut && <LoadingOverlay label="Signing out…" />}
    </div>
  );
}
