import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env.NODE_ENV === "production"
        ? ["log", "warn", "error"]
        : ["log", "warn", "error", "debug", "verbose"],
  });

  // Behind the nginx reverse proxy, req.ip is otherwise the proxy's own
  // address, not the real client's -- needed for auth_events' ipAddress
  // (spec-activity-log.md section A). Defaults to 0 (don't trust any
  // X-Forwarded-For hop) deliberately: blindly trusting it lets any client
  // forge its own IP in the security log, which is worse than recording the
  // proxy's address. Only raise TRUST_PROXY_HOPS if a real reverse proxy
  // actually sits in front of this app in that environment.
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 0));

  app.use(cookieParser());
  // origin:true (reflect any requester) + credentials:true would let any
  // website make authenticated cross-origin requests using a logged-in
  // victim's cookies. Restrict to an explicit allow-list instead.
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
