import { CreatePriorityTaskRequest, PriorityTaskQuadrant } from "@orelia/common";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreatePriorityTaskDto implements CreatePriorityTaskRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsEnum(PriorityTaskQuadrant)
  quadrant!: PriorityTaskQuadrant;
}
