import { CreateTeamRequest } from "@orelia/common";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateTeamDto implements CreateTeamRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
