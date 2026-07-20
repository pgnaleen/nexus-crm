// Shared by CreateUserDto and ResetPasswordDto so both enforce identical
// rules -- length alone isn't a meaningful strength requirement.
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_STRENGTH_MESSAGE =
  "Must include an uppercase letter, a lowercase letter, a number, and a special character";
