import { CompetitorEntryRequest } from "@orelia/common";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CompetitorEntryDto implements CompetitorEntryRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(4000)
  details!: string;
}
