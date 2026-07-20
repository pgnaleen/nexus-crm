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

// Mirrors PASSWORD_STRENGTH_REGEX in backend/src/modules/users/dto/password-policy.ts
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export function strongPassword(
  message = "Must include an uppercase letter, a lowercase letter, a number, and a special character"
): Validator {
  return (value) => (value.length > 0 && !PASSWORD_STRENGTH_REGEX.test(value) ? message : undefined);
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
