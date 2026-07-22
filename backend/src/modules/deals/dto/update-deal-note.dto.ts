import { UpdateDealNoteRequest } from "@orelia/common";
import { IsString, MinLength } from "class-validator";

export class UpdateDealNoteDto implements UpdateDealNoteRequest {
  @IsString()
  @MinLength(1)
  text!: string;
}
