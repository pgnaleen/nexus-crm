import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmployeesModule } from "../employees/employees.module";
import { RbacModule } from "../rbac/rbac.module";
import { Tenant } from "../tenants/entities/tenant.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { User } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  // Tenant is registered here too (already registered in TenantsModule) to
  // avoid importing the whole TenantsModule just for an existence check --
  // same pattern RbacModule uses.
  // EmployeesModule: Story 1.6 -- the User <-> Employee link lives on
  // employees.user_id and is only ever written from User Management, via
  // EmployeesService.linkToUser/unlinkFromUser.
  imports: [TypeOrmModule.forFeature([User, RefreshToken, Tenant]), RbacModule, EmployeesModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  // UsersService: needed by PickersModule for the Priority Tracker Share/
  // Delegate user picker (findPicker). TypeOrmModule: pre-existing re-export
  // so other modules can @InjectRepository(User) etc. without importing the
  // whole UsersModule dependency chain.
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
