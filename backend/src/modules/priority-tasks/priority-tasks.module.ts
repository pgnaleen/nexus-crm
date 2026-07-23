import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { PriorityTask } from "./entities/priority-task.entity";
import { PriorityTasksController } from "./priority-tasks.controller";
import { PriorityTasksRepository } from "./priority-tasks.repository";
import { PriorityTasksService } from "./priority-tasks.service";

@Module({
  // User registered directly (not the whole UsersModule) purely to resolve
  // a task's creator display name for Story 1.4's detail view -- avoids
  // pulling in UsersModule's own RbacModule/EmployeesModule chain for a
  // single read-only lookup.
  imports: [TypeOrmModule.forFeature([PriorityTask, User])],
  controllers: [PriorityTasksController],
  providers: [PriorityTasksService, PriorityTasksRepository],
})
export class PriorityTasksModule {}
