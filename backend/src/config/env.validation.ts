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

  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

  // Comma-separated list of allowed origins for cookie-credentialed requests.
  CORS_ORIGIN: Joi.string().default("http://localhost:3000"),
});
