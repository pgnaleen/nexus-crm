import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SIGNED_URL_EXPIRES_IN_SECONDS } from "./storage.constants";

export interface S3ObjectSummary {
  key: string;
  lastModified?: Date;
  size?: number;
}

// Single S3 integration boundary for the whole app -- DB backups and every
// user-facing file upload (logo, deal documents, employee photo/CV,
// certification evidence) all go through this one client, same bucket
// (S3_BACKUPS_BUCKET), distinguished only by key prefix (see
// storage.constants.ts). Registered globally via CoreModule.
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);

  // Lazily created: the S3Client constructor itself throws "Region is
  // missing" when AWS_REGION is unset, which would crash app startup on any
  // machine without this config (e.g. local dev on .env.example defaults).
  // Only built on first real use.
  private client?: S3Client;
  private readonly bucket?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("S3_BACKUPS_BUCKET");
  }

  isEnabled(): boolean {
    return !!this.bucket && !!this.config.get<string>("AWS_REGION");
  }

  // Uploads are a core feature, not an optional nightly job -- unlike the
  // backup path's isEnabled()-then-skip posture, a write attempted without
  // S3 configured must fail loudly with a clear message, not silently no-op
  // or bubble up as a cryptic SDK error.
  private requireEnabled(): void {
    if (!this.isEnabled()) {
      throw new InternalServerErrorException(
        "File storage is not configured (AWS_REGION/S3_BACKUPS_BUCKET unset)",
      );
    }
  }

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({ region: this.config.get<string>("AWS_REGION") });
    }
    return this.client;
  }

  async putObject(key: string, buffer: Buffer, contentType?: string): Promise<void> {
    this.requireEnabled();
    this.logger.debug(`putObject called for key ${key} (${buffer.length} bytes)`);
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType ?? "application/octet-stream",
        ServerSideEncryption: "AES256",
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.requireEnabled();
    this.logger.debug(`deleteObject called for key ${key}`);
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async listObjects(prefix: string): Promise<S3ObjectSummary[]> {
    this.requireEnabled();
    const out: S3ObjectSummary[] = [];
    let token: string | undefined;
    do {
      const page = await this.getClient().send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const obj of page.Contents ?? []) {
        out.push({ key: obj.Key!, lastModified: obj.LastModified, size: obj.Size });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  // Generates a fresh, short-lived signed GET URL from a stored key -- never
  // persisted anywhere, always regenerated at response-build time (see every
  // controller's toResponse()). Returns null for a null/undefined key (no
  // file set) or when storage isn't configured, rather than throwing --
  // unlike the write path above, a misconfigured read must not take down an
  // entire list/detail endpoint that happens to include a file field.
  async getSignedGetUrl(
    key: string | undefined | null,
    expiresInSeconds: number = SIGNED_URL_EXPIRES_IN_SECONDS,
  ): Promise<string | null> {
    if (!key) return null;
    if (!this.isEnabled()) {
      this.logger.warn(`getSignedGetUrl: storage not configured, returning null for key ${key}`);
      return null;
    }
    // @aws-sdk/s3-request-presigner and @aws-sdk/client-s3 pull in slightly
    // different resolved versions of internal @smithy/* packages in this
    // monorepo's dependency tree, which TS sees as structurally distinct
    // `Client` types (a private field mismatch) despite being runtime-
    // compatible -- a known, common friction point across AWS SDK v3
    // package versions. The cast is narrowly scoped to this one call.
    return getSignedUrl(
      this.getClient() as unknown as Parameters<typeof getSignedUrl>[0],
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  // Best-effort delete for a replace/remove flow -- a failed delete here must
  // never fail the caller's real save/delete operation (same posture as
  // AuditLogService.record()); it just orphans one object in S3, logged as a
  // warning for later cleanup rather than surfaced to the user.
  async deleteObjectBestEffort(key: string | undefined | null): Promise<void> {
    if (!key) return;
    try {
      await this.deleteObject(key);
      this.logger.debug(`deleteObjectBestEffort: removed ${key}`);
    } catch (err) {
      this.logger.warn(`deleteObjectBestEffort failed for ${key}: ${(err as Error).message}`);
    }
  }
}
