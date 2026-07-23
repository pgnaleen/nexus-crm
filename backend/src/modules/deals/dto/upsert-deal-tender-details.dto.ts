import { EvaluationType, SubmissionMode, UpsertDealTenderDetailsRequest } from "@orelia/common";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UpsertDealTenderDetailsDto implements UpsertDealTenderDetailsRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  tenderReference!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  issuingBody!: string;

  @IsOptional()
  @IsBoolean()
  bidBondRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bidBondAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  emdAmount?: number;

  @IsOptional()
  @IsEnum(SubmissionMode)
  submissionMode?: SubmissionMode;

  @IsOptional()
  @IsEnum(EvaluationType)
  evaluationType?: EvaluationType;
}
