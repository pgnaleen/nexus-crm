import { UpdatePriorityTaskMessageRequest } from "@orelia/common";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpdatePriorityTaskMessageDto implements UpdatePriorityTaskMessageRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}
