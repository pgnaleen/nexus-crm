import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

const SENSITIVE_KEYS = ["password", "token", "accessToken", "refreshToken"];

function redact(body: unknown): unknown {
  if (!body || typeof body !== "object") {
    return body;
  }
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.includes(key)) {
      clone[key] = "[REDACTED]";
    }
  }
  return clone;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, originalUrl, query, body } = req;

    res.on("finish", () => {
      const duration = Date.now() - start;
      const parts = [`${method} ${originalUrl}`, `${res.statusCode}`, `+${duration}ms`];

      if (query && Object.keys(query).length > 0) {
        parts.push(`query=${JSON.stringify(query)}`);
      }
      if (body && Object.keys(body).length > 0) {
        parts.push(`body=${JSON.stringify(redact(body))}`);
      }

      this.logger.log(parts.join(" "));
    });

    next();
  }
}
