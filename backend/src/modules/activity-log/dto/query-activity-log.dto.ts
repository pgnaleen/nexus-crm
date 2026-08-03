import { ActivityLogQuery } from "@orelia/common";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

// The global ValidationPipe runs forbidNonWhitelisted: true, so every
// accepted query param must be declared here or the request 400s. Repeated
// params (?modules=a&modules=b) arrive as a real array; a single occurrence
// arrives as a bare string -- this is the first endpoint in the app to
// accept either, so both shapes are normalized to string[] here rather than
// leaving every caller to handle it twice.
function toStringArray({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value as string];
}

// Deep OFFSET pagination degrades linearly and an unbounded page number is a
// trivial self-DoS -- reject past this with "narrow the date range" rather
// than silently scanning ever further into the table.
export const MAX_ACTIVITY_LOG_PAGE = 500;
export const MAX_ACTIVITY_LOG_PAGE_SIZE = 100;

export class QueryActivityLogDto implements ActivityLogQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACTIVITY_LOG_PAGE)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACTIVITY_LOG_PAGE_SIZE)
  pageSize?: number;

  // Already converted to UTC client-side from the picked Asia/Colombo
  // wall-clock value -- see frontend/src/lib/format-datetime.ts.
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsIn(["insert", "update", "delete"], { each: true })
  actions?: string[];

  @IsOptional()
  @IsString()
  search?: string;

  // Both only ever honored server-side for a genuine System-tenant session
  // (ActivityLogService.isPlatformSession()) -- a non-platform caller
  // sending either is silently ignored, never trusted at face value.
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  allTenants?: boolean;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
