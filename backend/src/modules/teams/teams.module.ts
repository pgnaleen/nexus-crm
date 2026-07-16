import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RbacModule } from "../rbac/rbac.module";
import { Team } from "./entities/team.entity";
import { TeamsController } from "./teams.controller";
import { TeamsRepository } from "./teams.repository";
import { TeamsService } from "./teams.service";

@Module({
  imports: [TypeOrmModule.forFeature([Team]), RbacModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
})
export class TeamsModule {}
