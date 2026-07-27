import { AcceptPriorityTaskRequest, PriorityTaskQuadrant } from "@orelia/common";
import { IsEnum } from "class-validator";

// Story 1.8 -- the quadrant the acceptor drops the task into on their board.
export class AcceptPriorityTaskDto implements AcceptPriorityTaskRequest {
  @IsEnum(PriorityTaskQuadrant)
  quadrant!: PriorityTaskQuadrant;
}
