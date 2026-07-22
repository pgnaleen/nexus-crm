import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface S3ObjectSummary {
  key: string;
  lastModified?: Date;
  size?: number;
}

// Single S3 integration boundary for the backup feature. Nothing else in this
// module talks to the AWS SDK directly. Resilient by design: if S3_BACKUPS_BUCKET
// is unset, isEnabled() is false and callers skip the backup instead of crashing.
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket?: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("S3_BACKUPS_BUCKET");
    this.client = new S3Client({ region: this.config.get<string>("AWS_REGION") });
  }

  isEnabled(): boolean {
    return !!this.bucket;
  }

  async putObject(key: string, buffer: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
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
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async listObjects(prefix: string): Promise<S3ObjectSummary[]> {
    const out: S3ObjectSummary[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const obj of page.Contents ?? []) {
        out.push({ key: obj.Key!, lastModified: obj.LastModified, size: obj.Size });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
}
