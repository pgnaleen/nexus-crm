import { Injectable } from "@nestjs/common";
import { Employee } from "./entities/employee.entity";
import { EmployeesRepository } from "./employees.repository";

@Injectable()
export class EmployeesService {
  constructor(private readonly employeesRepo: EmployeesRepository) {}

  async findPicker(): Promise<Employee[]> {
    return this.employeesRepo.findScoped({ order: { fullName: "ASC" } });
  }
}
