// Shared between create/update-relationship-party-contact.dto.ts so both
// stay in lockstep -- mirrors the frontend's identical checks in
// frontend/src/lib/validation.ts (linkedInUrl) and
// frontend/src/lib/timezones.ts (TIMEZONES), same rules on both sides of
// the API boundary.

// Deliberately scoped to linkedin.com rather than a generic URL check --
// this field is specifically "LinkedIn", not "any link".
export const LINKEDIN_URL_REGEX = /^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/.+/i;

// The full IANA timezone database, straight from the runtime -- no
// dataset/library to keep in sync. Computed once at module load.
export const VALID_TIMEZONES: string[] = Intl.supportedValuesOf("timeZone");
