"use client";

import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = "year" | "month" | "week" | "day";
type ReminderPriority = "high" | "medium" | "low";

interface Reminder {
  id: string;
  title: string;
  description: string;
  date: string; // ISO date string "YYYY-MM-DD"
  time: string; // "HH:MM"
  priority: ReminderPriority;
  completed: boolean;
  color: string;
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const todayStr = `${yyyy}-${mm}-${dd}`;

function dateStr(daysOffset: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

const DUMMY_REMINDERS: Reminder[] = [
  { id: "1", title: "Team standup", description: "Daily sync with the dev team", date: todayStr, time: "09:00", priority: "high", completed: false, color: "#6366f1" },
  { id: "2", title: "Review Q3 proposals", description: "Go through all pending proposals from clients", date: todayStr, time: "11:30", priority: "medium", completed: false, color: "#0ea5e9" },
  { id: "3", title: "Client call — Nexus Corp", description: "Discuss contract renewal terms", date: todayStr, time: "14:00", priority: "high", completed: false, color: "#f59e0b" },
  { id: "4", title: "Follow up: Sarah Johnson", description: "Send updated pricing sheet", date: dateStr(1), time: "10:00", priority: "medium", completed: false, color: "#10b981" },
  { id: "5", title: "Monthly invoice run", description: "Generate and send all monthly invoices", date: dateStr(1), time: "15:00", priority: "high", completed: false, color: "#f59e0b" },
  { id: "6", title: "Product demo — Acme Inc", description: "Live walkthrough of new dashboard features", date: dateStr(2), time: "11:00", priority: "medium", completed: false, color: "#6366f1" },
  { id: "7", title: "Board meeting preparation", description: "Prepare slides for Thursday board meeting", date: dateStr(3), time: "09:00", priority: "high", completed: false, color: "#ef4444" },
  { id: "8", title: "CRM data cleanup", description: "Remove duplicates and archive old contacts", date: dateStr(4), time: "14:00", priority: "low", completed: false, color: "#10b981" },
  { id: "9", title: "Quarterly review", description: "Internal Q3 performance review", date: dateStr(7), time: "10:00", priority: "high", completed: false, color: "#f59e0b" },
  { id: "10", title: "Pipeline audit", description: "Review all open deals in the funnel", date: dateStr(-1), time: "13:00", priority: "medium", completed: true, color: "#0ea5e9" },
  { id: "11", title: "Team lunch", description: "Monthly team outing — book a restaurant", date: dateStr(10), time: "12:00", priority: "low", completed: false, color: "#10b981" },
  { id: "12", title: "Contract signing — BlueStar", description: "Final contract signature from BlueStar Ltd", date: dateStr(14), time: "16:00", priority: "high", completed: false, color: "#6366f1" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + i);
    return nd;
  });
}
function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}
function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
function priorityLabel(p: ReminderPriority) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CalendarWidget() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>(DUMMY_REMINDERS);
  const [showReminderPanel, setShowReminderPanel] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newReminder, setNewReminder] = useState({ title: "", description: "", date: todayStr, time: "09:00", priority: "medium" as ReminderPriority });

  const remindersByDate = useMemo(() => {
    const map: Record<string, Reminder[]> = {};
    reminders.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [reminders]);

  function navigate(direction: 1 | -1) {
    const d = new Date(currentDate);
    if (viewMode === "year") d.setFullYear(d.getFullYear() + direction);
    else if (viewMode === "month") d.setMonth(d.getMonth() + direction);
    else if (viewMode === "week") d.setDate(d.getDate() + 7 * direction);
    else d.setDate(d.getDate() + direction);
    setCurrentDate(d);
  }

  function goToday() { setCurrentDate(new Date()); }

  function toggleComplete(id: string) {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, completed: !r.completed } : r));
  }

  function addReminder() {
    if (!newReminder.title.trim()) return;
    const colors: Record<ReminderPriority, string> = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
    setReminders((prev) => [...prev, {
      id: String(Date.now()),
      ...newReminder,
      completed: false,
      color: colors[newReminder.priority],
    }]);
    setShowAddModal(false);
    setNewReminder({ title: "", description: "", date: todayStr, time: "09:00", priority: "medium" });
  }

  function getHeaderLabel() {
    if (viewMode === "year") return String(currentDate.getFullYear());
    if (viewMode === "month") return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === "week") {
      const dates = getWeekDates(currentDate);
      return `${MONTHS[dates[0].getMonth()].slice(0, 3)} ${dates[0].getDate()} – ${MONTHS[dates[6].getMonth()].slice(0, 3)} ${dates[6].getDate()}, ${dates[6].getFullYear()}`;
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  }

  const panelReminders = selectedDate ? (remindersByDate[selectedDate] ?? []) : reminders.filter(r => !r.completed).slice(0, 12);
  const panelTitle = selectedDate ? `${selectedDate}` : "Upcoming";

  return (
    <div className="cal-wrapper">
      {/* ── Top Bar ────────────────────────────── */}
      <div className="cal-topbar">
        <div className="cal-topbar-left">
          <h1 className="cal-heading">Calendar</h1>
          <button className="cal-today-btn" onClick={goToday}>Today</button>
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => navigate(-1)}>‹</button>
            <span className="cal-period-label">{getHeaderLabel()}</span>
            <button className="cal-nav-btn" onClick={() => navigate(1)}>›</button>
          </div>
        </div>
        <div className="cal-topbar-right">
          <div className="cal-view-tabs">
            {(["day", "week", "month", "year"] as ViewMode[]).map((v) => (
              <button key={v} className={`cal-view-tab${viewMode === v ? " active" : ""}`} onClick={() => setViewMode(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button className="cal-reminder-toggle" onClick={() => setShowReminderPanel(!showReminderPanel)}>
            <span className="cal-reminder-icon">🔔</span>
            Reminders
            {reminders.filter(r => !r.completed).length > 0 && (
              <span className="cal-badge">{reminders.filter(r => !r.completed).length}</span>
            )}
          </button>
          <button className="cal-add-btn" onClick={() => setShowAddModal(true)}>+ Add Reminder</button>
        </div>
      </div>

      {/* ── Main Content ───────────────────────── */}
      <div className="cal-body">
        {/* Calendar View */}
        <div className="cal-main">
          {viewMode === "month" && <MonthView currentDate={currentDate} remindersByDate={remindersByDate} todayStr={todayStr} onDayClick={(d) => setSelectedDate(prev => prev === d ? null : d)} selectedDate={selectedDate} />}
          {viewMode === "week" && <WeekView currentDate={currentDate} remindersByDate={remindersByDate} todayStr={todayStr} onDayClick={(d) => setSelectedDate(prev => prev === d ? null : d)} selectedDate={selectedDate} />}
          {viewMode === "day" && <DayView currentDate={currentDate} remindersByDate={remindersByDate} todayStr={todayStr} />}
          {viewMode === "year" && <YearView currentDate={currentDate} remindersByDate={remindersByDate} todayStr={todayStr} onMonthClick={(m) => { const d = new Date(currentDate); d.setMonth(m); setCurrentDate(d); setViewMode("month"); }} />}
        </div>

        {/* Reminder Panel */}
        {showReminderPanel && (
          <aside className="cal-panel">
            <div className="cal-panel-header">
              <span className="cal-panel-title">{panelTitle}</span>
              {selectedDate && <button className="cal-panel-clear" onClick={() => setSelectedDate(null)}>Show all</button>}
            </div>
            <div className="cal-panel-list">
              {panelReminders.length === 0 && (
                <div className="cal-empty">
                  <span style={{ fontSize: 32 }}>🎉</span>
                  <p>No reminders{selectedDate ? " on this day" : ""}!</p>
                </div>
              )}
              {panelReminders.map((r) => (
                <ReminderCard key={r.id} reminder={r} onToggle={() => toggleComplete(r.id)} />
              ))}
            </div>
            {!selectedDate && reminders.filter(r => r.completed).length > 0 && (
              <div className="cal-panel-completed">
                <p className="cal-completed-label">Completed</p>
                {reminders.filter(r => r.completed).map((r) => (
                  <ReminderCard key={r.id} reminder={r} onToggle={() => toggleComplete(r.id)} />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Add Reminder Modal ─────────────────── */}
      {showAddModal && (
        <div className="cal-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-header">
              <h2>Add Reminder</h2>
              <button className="cal-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="cal-modal-body">
              <label className="cal-field-label">Title *</label>
              <input className="cal-input" placeholder="e.g. Call with client" value={newReminder.title} onChange={(e) => setNewReminder(p => ({ ...p, title: e.target.value }))} />
              <label className="cal-field-label">Description</label>
              <textarea className="cal-input cal-textarea" placeholder="Add a note..." value={newReminder.description} onChange={(e) => setNewReminder(p => ({ ...p, description: e.target.value }))} />
              <div className="cal-modal-row">
                <div className="cal-modal-col">
                  <label className="cal-field-label">Date</label>
                  <input type="date" className="cal-input" value={newReminder.date} onChange={(e) => setNewReminder(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="cal-modal-col">
                  <label className="cal-field-label">Time</label>
                  <input type="time" className="cal-input" value={newReminder.time} onChange={(e) => setNewReminder(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>
              <label className="cal-field-label">Priority</label>
              <div className="cal-priority-btns">
                {(["low", "medium", "high"] as ReminderPriority[]).map((p) => (
                  <button key={p} className={`cal-priority-btn ${p}${newReminder.priority === p ? " selected" : ""}`} onClick={() => setNewReminder(prev => ({ ...prev, priority: p }))}>
                    {priorityLabel(p)}
                  </button>
                ))}
              </div>
            </div>
            <div className="cal-modal-footer">
              <button className="cal-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="cal-btn-primary" onClick={addReminder}>Add Reminder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reminder Card ─────────────────────────────────────────────────────────────
function ReminderCard({ reminder, onToggle }: { reminder: Reminder; onToggle: () => void }) {
  return (
    <div className={`cal-reminder-card${reminder.completed ? " done" : ""}`} style={{ "--accent": reminder.color } as React.CSSProperties}>
      <div className="cal-reminder-left">
        <button className="cal-check" onClick={onToggle} style={{ borderColor: reminder.color, background: reminder.completed ? reminder.color : "transparent" }}>
          {reminder.completed && <span>✓</span>}
        </button>
        <div className="cal-reminder-info">
          <span className="cal-reminder-title">{reminder.title}</span>
          {reminder.description && <span className="cal-reminder-desc">{reminder.description}</span>}
          <span className="cal-reminder-meta">
            <span className="cal-reminder-time">🕐 {reminder.time}</span>
            <span className={`cal-priority-pill ${reminder.priority}`}>{priorityLabel(reminder.priority)}</span>
          </span>
        </div>
      </div>
      <div className="cal-reminder-date-badge">{reminder.date.slice(5).replace("-", "/")}</div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ currentDate, remindersByDate, todayStr, onDayClick, selectedDate }: {
  currentDate: Date; remindersByDate: Record<string, Reminder[]>; todayStr: string;
  onDayClick: (d: string) => void; selectedDate: string | null;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const d = new Date(year, month, dayNum);
    return isoDate(d);
  });

  return (
    <div className="cal-month">
      <div className="cal-month-header">
        {DAYS_SHORT.map((d) => <div key={d} className="cal-month-dayname">{d}</div>)}
      </div>
      <div className="cal-month-grid">
        {cells.map((dateS, i) => {
          if (!dateS) return <div key={i} className="cal-month-cell empty" />;
          const isToday = dateS === todayStr;
          const isSelected = dateS === selectedDate;
          const events = remindersByDate[dateS] ?? [];
          return (
            <div key={dateS} className={`cal-month-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}`} onClick={() => onDayClick(dateS)}>
              <span className="cal-day-num">{Number(dateS.split("-")[2])}</span>
              <div className="cal-day-events">
                {events.slice(0, 3).map((r) => (
                  <div key={r.id} className={`cal-event-pill${r.completed ? " done" : ""}`} style={{ background: r.color }}>
                    {r.time} {r.title}
                  </div>
                ))}
                {events.length > 3 && <div className="cal-event-more">+{events.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ currentDate, remindersByDate, todayStr, onDayClick, selectedDate }: {
  currentDate: Date; remindersByDate: Record<string, Reminder[]>; todayStr: string;
  onDayClick: (d: string) => void; selectedDate: string | null;
}) {
  const weekDates = getWeekDates(currentDate);
  return (
    <div className="cal-week">
      <div className="cal-week-header">
        <div className="cal-week-timecol" />
        {weekDates.map((d) => {
          const ds = isoDate(d);
          const isToday = ds === todayStr;
          return (
            <div key={ds} className={`cal-week-daycol-header${isToday ? " today" : ""}${selectedDate === ds ? " selected" : ""}`} onClick={() => onDayClick(ds)}>
              <span className="cal-week-dayname">{DAYS_SHORT[d.getDay()]}</span>
              <span className="cal-week-daynum">{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      <div className="cal-week-body">
        {HOURS.map((h) => (
          <div key={h} className="cal-week-row">
            <div className="cal-week-time">{formatHour(h)}</div>
            {weekDates.map((d) => {
              const ds = isoDate(d);
              const events = (remindersByDate[ds] ?? []).filter(r => parseInt(r.time.split(":")[0]) === h);
              return (
                <div key={ds} className="cal-week-cell">
                  {events.map((r) => (
                    <div key={r.id} className="cal-week-event" style={{ background: r.color }}>
                      {r.time} {r.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({ currentDate, remindersByDate, todayStr }: {
  currentDate: Date; remindersByDate: Record<string, Reminder[]>; todayStr: string;
}) {
  const ds = isoDate(currentDate);
  const events = remindersByDate[ds] ?? [];
  return (
    <div className="cal-day">
      <div className="cal-day-heading">
        <span className={`cal-day-big-num${ds === todayStr ? " today" : ""}`}>{currentDate.getDate()}</span>
        <span className="cal-day-big-month">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
      </div>
      <div className="cal-day-timeline">
        {HOURS.map((h) => {
          const hourEvents = events.filter(r => parseInt(r.time.split(":")[0]) === h);
          return (
            <div key={h} className="cal-day-row">
              <div className="cal-day-hour">{formatHour(h)}</div>
              <div className="cal-day-slot">
                {hourEvents.map((r) => (
                  <div key={r.id} className="cal-day-event" style={{ borderLeftColor: r.color, background: `${r.color}18` }}>
                    <span className="cal-day-event-time">{r.time}</span>
                    <span className="cal-day-event-title">{r.title}</span>
                    {r.description && <span className="cal-day-event-desc">{r.description}</span>}
                    <span className={`cal-priority-pill ${r.priority}`}>{priorityLabel(r.priority)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Year View ─────────────────────────────────────────────────────────────────
function YearView({ currentDate, remindersByDate, todayStr, onMonthClick }: {
  currentDate: Date; remindersByDate: Record<string, Reminder[]>; todayStr: string;
  onMonthClick: (month: number) => void;
}) {
  const year = currentDate.getFullYear();
  return (
    <div className="cal-year">
      {MONTHS.map((monthName, mi) => {
        const daysInMonth = getDaysInMonth(year, mi);
        const firstDay = getFirstDayOfMonth(year, mi);
        const cells = Array.from({ length: 42 }, (_, i) => {
          const dayNum = i - firstDay + 1;
          if (dayNum < 1 || dayNum > daysInMonth) return null;
          return dayNum;
        });
        return (
          <div key={mi} className="cal-year-month" onClick={() => onMonthClick(mi)}>
            <div className="cal-year-month-name">{monthName}</div>
            <div className="cal-year-grid">
              {DAYS_SHORT.map(d => <div key={d} className="cal-year-dayname">{d[0]}</div>)}
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="cal-year-cell empty" />;
                const dStr = `${year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasEvents = (remindersByDate[dStr]?.length ?? 0) > 0;
                const isToday = dStr === todayStr;
                return (
                  <div key={dStr} className={`cal-year-cell${isToday ? " today" : ""}${hasEvents ? " has-events" : ""}`}>
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
