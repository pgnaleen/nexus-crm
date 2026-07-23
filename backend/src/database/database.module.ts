import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        host: config.get<string>("DB_HOST"),
        port: config.get<number>("DB_PORT"),
        username: config.get<string>("DB_USER"),
        password: config.get<string>("DB_PASSWORD"),
        database: config.get<string>("DB_NAME"),
        // See DB_SSL in env.validation.ts -- RDS rejects unencrypted
        // connections; rejectUnauthorized: false skips CA validation rather
        // than pinning the AWS RDS CA bundle, a pragmatic tradeoff worth
        // revisiting once this is running for real.
        ssl: config.get<boolean>("DB_SSL") ? { rejectUnauthorized: false } : false,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        autoLoadEntities: true,
        logging: config.get<boolean>("DB_LOGGING"),
      }),
    }),
  ],
})
export class DatabaseModule {}
