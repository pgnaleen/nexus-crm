import { IsOptional, IsString, MaxLength } from "class-validator";

// Shared by all 4 uploads.controller.ts routes -- none of them have an
// owning record yet at upload time (logo/photo/CV/certification are all
// uploaded before the Company/Employee/Certification row exists), so this
// is the only source of a human-readable name for the S3 key. Optional: if
// omitted (e.g. the file was picked before the name field was typed),
// uploadAndRespond() falls back to the original filename, then a generic
// per-type label.
export class UploadDisplayNameDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;
}
