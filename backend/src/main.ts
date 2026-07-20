import "reflect-metadata";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { UPLOAD_DIR } from "./modules/uploads/uploads.constants";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env.NODE_ENV === "production"
        ? ["log", "warn", "error"]
        : ["log", "warn", "error", "debug", "verbose"],
  });

  // Uploaded files are served directly by Express, bypassing the "api"
  // global prefix below -- URLs are just /uploads/<file>, not /api/uploads/<file>.
  app.useStaticAssets(join(process.cwd(), UPLOAD_DIR), { prefix: "/uploads" });

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
