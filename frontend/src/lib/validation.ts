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

export function validate(value: string, validators: Validator[]): string | undefined {
  for (const validator of validators) {
    const error = validator(value);
    if (error) {
      return error;
    }
  }
  return undefined;
}
