import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { User } from "../users/entities/user.entity";
import { PriorityTaskDelegationTracker } from "./entities/priority-task-delegation-tracker.entity";
import { PriorityTaskShare } from "./entities/priority-task-share.entity";
import { PriorityTask } from "./entities/priority-task.entity";
import { PriorityTaskSharesController } from "./priority-task-shares.controller";
import { PriorityTaskSharesService } from "./priority-task-shares.service";
import { PriorityTasksController } from "./priority-tasks.controller";
import { PriorityTasksRepository } from "./priority-tasks.repository";
import { PriorityTasksService } from "./priority-tasks.service";

@Module({
  // User registered directly (not just via UsersModule) purely to resolve
  // a task's creator display name for Story 1.4's detail view, via a plain
  // @InjectRepository(User) -- UsersModule is imported separately, for
  // Story 1.5/1.6's Share/Delegate features, which need
  // UsersService.findOneOrFail to tenant-scope-validate who a task is
  // being shared/delegated to.
  imports: [
    TypeOrmModule.forFeature([PriorityTask, PriorityTaskShare, PriorityTaskDelegationTracker, User]),
    UsersModule,
  ],
  controllers: [PriorityTasksController, PriorityTaskSharesController],
  providers: [PriorityTasksService, PriorityTasksRepository, PriorityTaskSharesService],
})
export class PriorityTasksModule {}
