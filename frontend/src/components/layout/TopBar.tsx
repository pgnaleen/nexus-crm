"use client";

import { useState, useEffect } from "react";
import { AccountMenu } from "./AccountMenu";
import { NotificationPanel } from "./NotificationPanel";
import { SearchIcon } from "@/components/ui/icons";

interface TopBarProps {
  tenantName: string;
  userDisplayName: string;
  tenantSlug: string;
}

export function TopBar({ tenantName, userDisplayName, tenantSlug }: TopBarProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = time
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(time)
    : "";
  
  const formattedTime = time
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(time)
    : "";

  return (
    <header className="topbar">
      <div className="topbar-search">
        <SearchIcon />
        <input type="text" placeholder="Search..." />
      </div>

      <div className="topbar-actions">
        {time && (
          <div className="topbar-datetime">
            <span className="topbar-date">{formattedDate}</span>
            <span className="topbar-time">{formattedTime}</span>
          </div>
        )}

        <NotificationPanel />

        <AccountMenu tenantName={tenantName} userDisplayName={userDisplayName} tenantSlug={tenantSlug} />
      </div>
    </header>
  );
}
