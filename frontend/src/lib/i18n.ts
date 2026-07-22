import en from "@/locales/en.json";

type Dictionary = { [key: string]: string | Dictionary };

// Only English exists today. When a second language is added, this becomes a
// lookup keyed by the active locale (cookie/param) instead of a constant.
const dictionary: Dictionary = en;

/**
 * Looks up a dot-path key (e.g. "departments.dialog.saveButton") in the active
 * locale dictionary and interpolates any {placeholder} tokens from `vars`.
 * Falls back to the raw key itself if the path doesn't resolve, so a missing
 * translation is visibly wrong in the UI rather than silently blank.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");
  let current: string | Dictionary = dictionary;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return key;
    }
    const next: string | Dictionary | undefined = current[part];
    if (next === undefined) return key;
    current = next;
  }

  if (typeof current !== "string") return key;

  if (!vars) return current;
  return current.replace(/\{(\w+)\}/g, (match, token) =>
    token in vars ? String(vars[token]) : match,
  );
}
