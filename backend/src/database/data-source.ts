import "reflect-metadata";
import * as dotenv from "dotenv";
import { DataSource, DataSourceOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // See DB_SSL in env.validation.ts -- RDS rejects unencrypted connections;
  // rejectUnauthorized: false skips CA validation rather than pinning the
  // AWS RDS CA bundle, a pragmatic tradeoff worth revisiting once this is
  // running for real.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [__dirname + "/../modules/**/entities/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  migrationsTableName: "typeorm_migrations",
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
