// Single source of truth for the timezone this app displays timestamps in --
// see spec-activity-log.md's Edge Case 18/14. Seven files already hardcode
// "Asia/Colombo" for display; this adds the missing other half, converting a
// picked wall-clock filter value back to UTC in the SAME zone, not the
// browser's own timezone. Without this, a viewer outside Sri Lanka who picks
// "since 09:00" gets rows from the wrong instant.
export const DISPLAY_TIMEZONE = "Asia/Colombo";

// Asia/Colombo has observed a fixed UTC+05:30 offset with no DST since 2006,
// so this can be plain offset arithmetic rather than needing a timezone
// library. If DISPLAY_TIMEZONE is ever changed to a DST-observing zone, this
// fixed-offset assumption stops being valid and needs revisiting.
const DISPLAY_TIMEZONE_OFFSET_MINUTES = 5 * 60 + 30;

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: DISPLAY_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Converts a <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm", a bare
// wall-clock string with no timezone info) into a UTC ISO string, treating
// the picked value as DISPLAY_TIMEZONE wall-clock time -- not the browser's
// local timezone, which is what naively passing it to `new Date(...)` would
// use.
export function wallClockToUtc(localDateTimeValue: string): string {
  const [datePart, timePart] = localDateTimeValue.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = (timePart ?? "").split(":").map(Number);
  const asUtcMillis =
    Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0) -
    DISPLAY_TIMEZONE_OFFSET_MINUTES * 60 * 1000;
  return new Date(asUtcMillis).toISOString();
}
