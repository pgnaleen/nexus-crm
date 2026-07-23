import { UpdatePriorityTaskRequest } from "@orelia/common";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePriorityTaskDto implements UpdatePriorityTaskRequest {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
