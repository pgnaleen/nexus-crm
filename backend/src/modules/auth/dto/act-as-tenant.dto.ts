import { IsUUID } from "class-validator";

export class ActAsTenantDto {
  @IsUUID()
  tenantId!: string;
}
