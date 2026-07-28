import { isValidPhoneNumber } from "libphonenumber-js";

export type Validator = (value: string) => string | undefined;

export function required(message = "This field is required"): Validator {
  return (value) => (value.trim().length === 0 ? message : undefined);
}

export function minLength(min: number, message?: string): Validator {
  return (value) => (value.length < min ? (message ?? `Must be at least ${min} characters`) : undefined);
}

export function pattern(regex: RegExp, message: string): Validator {
  return (value) => (value.length > 0 && !regex.test(value) ? message : undefined);
}

export function email(message = "Must be a valid email address"): Validator {
  return (value) => (value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? message : undefined);
}

// `min` and `value` are both "YYYY-MM-DD" strings (the format <input
// type="date"> uses), so lexicographic comparison is a valid date comparison.
export function minDate(min: string, message: string): Validator {
  return (value) => (value.length > 0 && value < min ? message : undefined);
}

// For a numeric <input>'s string value -- the `min=` HTML attribute alone
// doesn't block submission (nothing in this codebase calls
// form.reportValidity(), and handleSubmit always preventDefault()s first),
// so it's decorative without this.
export function min(minValue: number, message: string): Validator {
  return (value) => (value.length > 0 && Number(value) < minValue ? message : undefined);
}

// Mirrors PASSWORD_STRENGTH_REGEX in backend/src/modules/users/dto/password-policy.ts
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export function strongPassword(
  message = "Must include an uppercase letter, a lowercase letter, a number, and a special character"
): Validator {
  return (value) => (value.length > 0 && !PASSWORD_STRENGTH_REGEX.test(value) ? message : undefined);
}

// PhoneField stores E.164 (react-phone-number-input's `international` mode),
// so this is checking a format our own input already produces -- catches an
// incomplete number (e.g. too few digits) the widget doesn't block on its own.
export function phoneNumber(message = "Must be a valid phone number"): Validator {
  return (value) => (value.length > 0 && !isValidPhoneNumber(value) ? message : undefined);
}

// Deliberately scoped to linkedin.com rather than a generic URL check --
// this field is specifically "LinkedIn", not "any link". Protocol optional
// (accepts "linkedin.com/in/jane" as well as "https://www.linkedin.com/in/jane").
const LINKEDIN_URL_REGEX = /^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/.+/i;

export function linkedInUrl(message = "Must be a valid LinkedIn URL"): Validator {
  return (value) => (value.length > 0 && !LINKEDIN_URL_REGEX.test(value) ? message : undefined);
}

export function validate(value: string, validators: Validator[]): string | undefined {
  for (const validator of validators) {
    const error = validator(value);
    if (error) {
      return error;
    }
  }
  return undefined;
}
