import { spawn } from "child_process";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { S3Service } from "../../core/storage/s3.service";

// Own subdirectory, not the bare "db-backups/" root -- that root prefix is
// also where the predecessor Hisham-Project's job wrote its own dumps
// (db-backups/orel-kanban-*.dump) in the same shared bucket. A retention prune
// filters by age only, not filename, so sharing the literal prefix meant this
// job's cleanup swept up and permanently deleted that project's old dumps too.
const S3_PREFIX = "db-backups/orelia/";
const NIGHTLY_JOB_NAME = "nightly-db-backup";

// Nightly full-DB backup: pg_dump --format=custom piped straight to a Buffer
// (never local disk) and uploaded to S3, then old dumps beyond the retention
// window are pruned. Ported from the predecessor Hisham-Project's dbBackup.js,
// adapted to NestJS's DI/config/scheduling instead of raw env reads + setTimeout.
@Injectable()
export class DbBackupService implements OnModuleInit {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (this.config.get<boolean>("NIGHTLY_BACKUP_DISABLED")) {
      this.logger.warn("Nightly DB backup disabled (NIGHTLY_BACKUP_DISABLED=true)");
      return;
    }
    const hour = this.config.get<number>("NIGHTLY_BACKUP_HOUR") ?? 2;
    const job = new CronJob(`0 0 ${hour} * * *`, () => {
      this.runBackup().catch((e) => this.logger.error(`Nightly backup failed: ${e.message}`));
    });
    this.scheduler.addCronJob(NIGHTLY_JOB_NAME, job);
    job.start();
    this.logger.log(`Nightly DB backup scheduled for ${hour}:00 local time`);
  }

  // Take one full-DB backup now -> S3, then prune old dumps. Used by both the
  // nightly cron and the manual "backup now" endpoint.
  async runBackup(): Promise<boolean> {
    if (!this.s3.isEnabled()) {
      this.logger.warn("S3 not configured (S3_BACKUPS_BUCKET unset) — backup skipped");
      return false;
    }
    const dump = await this.dumpDatabase();
    const key = `${S3_PREFIX}orelia-${this.stamp(new Date())}.dump`;
    await this.s3.putObject(key, dump, "application/octet-stream");
    this.logger.log(`Uploaded ${key} (${(dump.length / 1048576).toFixed(2)} MB)`);
    await this.pruneOld();
    return true;
  }

  // pg_dump the whole DB to a Buffer (custom/compressed format). Password goes
  // via PGPASSWORD env var, never a command-line arg, so it never shows up in
  // a process listing.
  private dumpDatabase(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pgDump = this.config.get<string>("PG_DUMP_PATH") ?? "pg_dump";
      const args = [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        `--host=${this.config.get<string>("DB_HOST")}`,
        `--port=${this.config.get<number>("DB_PORT")}`,
        `--username=${this.config.get<string>("DB_USER")}`,
        `--dbname=${this.config.get<string>("DB_NAME")}`,
      ];
      const child = spawn(pgDump, args, {
        env: { ...process.env, PGPASSWORD: this.config.get<string>("DB_PASSWORD") ?? "" },
      });
      const chunks: Buffer[] = [];
      let stderr = "";
      child.stdout.on("data", (d) => chunks.push(d));
      child.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      child.on("error", (e: NodeJS.ErrnoException) =>
        reject(
          e.code === "ENOENT"
            ? new Error(`pg_dump not found (looked for "${pgDump}"); set PG_DUMP_PATH`)
            : e,
        ),
      );
      child.on("close", (code) => {
        if (code === 0) return resolve(Buffer.concat(chunks));
        reject(new Error(`pg_dump exited ${code}: ${stderr.trim().slice(0, 500)}`));
      });
    });
  }

  private async pruneOld(): Promise<void> {
    const retentionDays = this.config.get<number>("BACKUP_RETENTION_DAYS") ?? 7;
    const cutoff = Date.now() - retentionDays * 86400000;
    let objects;
    try {
      objects = await this.s3.listObjects(S3_PREFIX);
    } catch (e) {
      this.logger.error(`Retention list failed: ${(e as Error).message}`);
      return;
    }
    let deleted = 0;
    for (const obj of objects) {
      if (obj.lastModified && obj.lastModified.getTime() < cutoff) {
        try {
          await this.s3.deleteObject(obj.key);
          deleted++;
        } catch (e) {
          this.logger.error(`Failed to delete ${obj.key}: ${(e as Error).message}`);
        }
      }
    }
    if (deleted) {
      this.logger.log(`Retention: deleted ${deleted} dump(s) older than ${retentionDays}d`);
    }
  }

  private stamp(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
}
