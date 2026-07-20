import { CreateDealDocumentRequest, DocumentType } from "@orelia/common";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

export class CreateDealDocumentDto implements CreateDealDocumentRequest {
  @IsEnum(DocumentType)
  docType!: DocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;
}
