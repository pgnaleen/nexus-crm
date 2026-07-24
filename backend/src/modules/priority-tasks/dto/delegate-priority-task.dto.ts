import { DelegatePriorityTaskRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class DelegatePriorityTaskDto implements DelegatePriorityTaskRequest {
  @IsUUID()
  userId!: string;
}
