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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="box-border flex h-8 w-8 shrink-0 appearance-none items-center justify-center overflow-hidden rounded-full border-none bg-crm-shell p-0 text-[11.5px] font-bold text-white cursor-pointer transition-transform duration-150 active:scale-95 focus:outline-none"
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
        <div className="absolute right-0 top-[calc(100%+8px)] min-w-[220px] bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.12)] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Info Header */}
          <div className="flex items-center gap-3 p-3 border-b border-slate-100 mb-1 select-none">
            {userPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userPhotoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover border border-slate-100 shadow-sm"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50/80 border border-red-100/60 text-xs font-bold text-crm-primary shadow-sm">
                {initialsFor(userDisplayName)}
              </span>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-[13.5px] font-bold text-slate-800 truncate" title={userDisplayName}>
                {userDisplayName}
              </span>
              <span className="text-[11px] font-medium text-slate-400 truncate mt-0.5" title={tenantName}>
                {tenantName}
              </span>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="space-y-0.5">
            <Link
              href={`/${tenantSlug}/profile`}
              className="group flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-all duration-150 no-underline"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-slate-400 group-hover:text-slate-500 transition-colors">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              My Profile
            </Link>
            
            <button 
              type="button" 
              className="group flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold text-red-500 hover:text-red-600 hover:bg-red-50/50 transition-all duration-150 border-none bg-transparent cursor-pointer outline-none" 
              onClick={handleLogout}
            >
              <span className="text-red-400 group-hover:text-red-500 transition-colors">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              Log out
            </button>
          </div>
        </div>
      )}

      {isLoggingOut && <LoadingOverlay label="Signing out…" />}
    </div>
  );
}
