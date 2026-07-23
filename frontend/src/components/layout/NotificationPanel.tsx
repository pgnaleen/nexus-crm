"use client";

import { useState, useRef, useEffect } from "react";
import { BellIcon } from "@/components/ui/icons";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

const DUMMY_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "New Tenant Registered",
    message: "Acme Corp has just signed up for the Pro Plan.",
    time: "2 mins ago",
    unread: true,
  },
  {
    id: "2",
    title: "System Update",
    message: "Platform maintenance successfully completed.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: "3",
    title: "Billing Alert",
    message: "Invoice #1023 generated for Globex Inc.",
    time: "5 hours ago",
    unread: false,
  }
];

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => n.unread).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="notification-panel-wrapper" ref={ref}>
      <button
        type="button"
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border-none text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#eceefc] ${isOpen ? "bg-[#eceefc]" : "bg-[#f5f6fa]"}`}
        aria-label="Notifications"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-[7px] h-1.5 w-1.5 rounded-full border-[1.5px] border-white bg-crm-primary" />
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-read" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">You're all caught up!</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className={`notification-item ${notif.unread ? "unread" : ""}`}>
                  <div className="notification-item-content">
                    <div className="notification-item-title">{notif.title}</div>
                    <div className="notification-item-message">{notif.message}</div>
                    <div className="notification-item-time">{notif.time}</div>
                  </div>
                  {notif.unread && <div className="notification-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
