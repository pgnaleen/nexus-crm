import { CreateMainStageRequest } from "@orelia/common";
import { IsInt, IsString, MaxLength, MinLength } from "class-validator";

export class CreateMainStageDto implements CreateMainStageRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsInt()
  position!: number;
}
