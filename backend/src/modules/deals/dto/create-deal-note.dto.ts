import { CreateDealNoteRequest } from "@orelia/common";
import { IsString, MinLength } from "class-validator";

export class CreateDealNoteDto implements CreateDealNoteRequest {
  @IsString()
  @MinLength(1)
  text!: string;
}
