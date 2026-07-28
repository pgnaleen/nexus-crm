import { registerDecorator, ValidationOptions } from "class-validator";
import { isValidPhoneNumber } from "libphonenumber-js";

// Shared across every DTO with a free-text phone column (contacts today;
// any future one follows the same pattern) -- mirrors the frontend's
// PhoneField + phoneNumber() validator in lib/validation.ts, same library,
// same semantics, so a number the form accepts never gets rejected by the
// API and vice versa. Accepts any libphonenumber-js-parseable international
// number, not just E.164, since this is also the API's own boundary check,
// not just a mirror of what the UI happens to submit.
export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isValidPhoneNumber",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === "string" && isValidPhoneNumber(value);
        },
        defaultMessage(): string {
          return `${propertyName} must be a valid phone number`;
        },
      },
    });
  };
}
