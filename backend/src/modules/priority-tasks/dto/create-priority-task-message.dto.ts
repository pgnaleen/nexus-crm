import { CreatePriorityTaskMessageRequest } from "@orelia/common";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreatePriorityTaskMessageDto implements CreatePriorityTaskMessageRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}
