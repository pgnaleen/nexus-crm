import { Module } from "@nestjs/common";
import { CompaniesModule } from "../companies/companies.module";
import { ContactsModule } from "../contacts/contacts.module";
import { DepartmentsModule } from "../departments/departments.module";
import { EmployeesModule } from "../employees/employees.module";
import { IndustriesModule } from "../industries/industries.module";
import { RbacModule } from "../rbac/rbac.module";
import { RelationshipTypesModule } from "../relationship-types/relationship-types.module";
import { PickersController } from "./pickers.controller";

@Module({
  imports: [
    CompaniesModule,
    ContactsModule,
    DepartmentsModule,
    EmployeesModule,
    IndustriesModule,
    RbacModule,
    RelationshipTypesModule,
  ],
  controllers: [PickersController],
})
export class PickersModule {}
