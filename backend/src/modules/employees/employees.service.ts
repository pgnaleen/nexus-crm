import { Injectable, Logger } from "@nestjs/common";
import { Employee } from "./entities/employee.entity";
import { EmployeesRepository } from "./employees.repository";

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly employeesRepo: EmployeesRepository) {}

  async findPicker(): Promise<Employee[]> {
    this.logger.debug("findPicker called");
    try {
      const results = await this.employeesRepo.findScoped({ order: { fullName: "ASC" } });
      this.logger.debug(`findPicker returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findPicker failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
