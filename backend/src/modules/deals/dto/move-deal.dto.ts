import { MoveDealStageRequest } from "@orelia/common";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// Exactly one of toStageId/toMainStageId is required -- enforced in
// DealsService.moveStage(), not here, same as the companyId/contactId XOR on
// Deal itself (a decorator-level XOR would need a custom validator for one
// case this codebase doesn't otherwise use).
export class MoveDealDto implements MoveDealStageRequest {
  @IsOptional()
  @IsUUID()
  toStageId?: string;

  @IsOptional()
  @IsUUID()
  toMainStageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
