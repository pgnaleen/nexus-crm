import { MovePriorityTaskRequest, PriorityTaskQuadrant } from "@orelia/common";
import { IsEnum, IsInt, Min } from "class-validator";

export class MovePriorityTaskDto implements MovePriorityTaskRequest {
  @IsEnum(PriorityTaskQuadrant)
  quadrant!: PriorityTaskQuadrant;

  @IsInt()
  @Min(0)
  index!: number;
}
