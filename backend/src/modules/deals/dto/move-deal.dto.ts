import { MoveDealStageRequest } from "@orelia/common";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class MoveDealDto implements MoveDealStageRequest {
  @IsUUID()
  toStageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
