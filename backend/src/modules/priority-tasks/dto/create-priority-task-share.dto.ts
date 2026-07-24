import { CreatePriorityTaskShareRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class CreatePriorityTaskShareDto implements CreatePriorityTaskShareRequest {
  @IsUUID()
  userId!: string;
}
