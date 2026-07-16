import { UpdateTeamRequest } from "@orelia/common";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateTeamDto implements UpdateTeamRequest {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}
