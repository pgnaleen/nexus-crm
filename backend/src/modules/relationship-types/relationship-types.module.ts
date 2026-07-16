import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { RelationshipType } from "./entities/relationship-type.entity";
import { RelationshipTypesController } from "./relationship-types.controller";
import { RelationshipTypesRepository } from "./relationship-types.repository";
import { RelationshipTypesService } from "./relationship-types.service";

@Module({
  imports: [TypeOrmModule.forFeature([RelationshipType]), RbacModule],
  controllers: [RelationshipTypesController],
  providers: [RelationshipTypesService, RelationshipTypesRepository],
})
export class RelationshipTypesModule {}
