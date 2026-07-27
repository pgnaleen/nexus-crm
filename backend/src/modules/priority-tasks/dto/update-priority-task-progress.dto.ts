import { UpdatePriorityTaskProgressRequest } from "@orelia/common";
import { IsIn } from "class-validator";

// Story 1.7 -- only 0/10/20/.../100 are accepted. @IsIn is the whole
// validation: it rejects non-multiples of 10 and out-of-range values in one
// rule, even on a direct API call that bypasses the UI's stepped slider.
const VALID_PROGRESS_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export class UpdatePriorityTaskProgressDto implements UpdatePriorityTaskProgressRequest {
  @IsIn(VALID_PROGRESS_VALUES, { message: "progress must be one of 0, 10, 20, ..., 100" })
  progress!: number;
}
