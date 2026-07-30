import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(3001),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  // Off by default — raw SQL logging is a deliberate opt-in for debugging a
  // specific query, not the default terminal experience. The [HTTP] request
  // logger (RequestLoggerMiddleware) covers day-to-day route/data visibility.
  DB_LOGGING: Joi.boolean().default(false),
  // RDS (and most managed Postgres) rejects unencrypted connections by
  // default -- off for the local docker-compose Postgres container, which
  // has no SSL configured at all.
  DB_SSL: Joi.boolean().default(false),

  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

  // Comma-separated list of allowed origins for cookie-credentialed requests.
  CORS_ORIGIN: Joi.string().default("http://localhost:3000"),

  // Shared app S3 bucket -- nightly DB backups (backups/orelia/ prefix)
  // AND every user-facing file upload (logo, deal documents, employee
  // photo/CV, certification evidence -- under each tenant's own {slug}/
  // folder, see core/storage/storage.constants.ts) both use this one bucket,
  // key prefix is what keeps them apart. All optional at the schema level (so a fresh
  // clone still boots): backups log a warning and no-op when unset, but any
  // upload attempted while unset fails loudly instead (see S3Service).
  // .empty("") treats the blank values from .env.example (e.g. `AWS_REGION=`) as
  // unset — plain .optional() would still reject them ("is not allowed to be empty").
  AWS_REGION: Joi.string().empty("").optional(),
  AWS_ACCESS_KEY_ID: Joi.string().empty("").optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().empty("").optional(),
  S3_BACKUPS_BUCKET: Joi.string().empty("").optional(),
  BACKUP_RETENTION_DAYS: Joi.number().default(7),
  NIGHTLY_BACKUP_HOUR: Joi.number().min(0).max(23).default(2),
  PG_DUMP_PATH: Joi.string().default("pg_dump"),
  NIGHTLY_BACKUP_DISABLED: Joi.boolean().default(false),

  // Transactional email (SendGrid) -- currently just the "welcome, here's
  // your login" email sent when a User is created (see MailService). Same
  // optional-at-schema-level posture as the S3 vars above: unset means a
  // fresh clone still boots, MailService just no-ops with a warning log
  // instead of failing the user-creation request that triggered it.
  SENDGRID_API_KEY: Joi.string().empty("").optional(),
  MAIL_FROM_ADDRESS: Joi.string().empty("").optional(),
  MAIL_FROM_NAME: Joi.string().default("ORELIA CRM"),
  // Used to build the login link in the welcome email -- the frontend's own
  // public origin, not the backend's (NEXT_PUBLIC_API_URL is the reverse).
  APP_BASE_URL: Joi.string().default("http://localhost:3000"),
});
