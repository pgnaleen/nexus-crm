import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { Department } from "./entities/department.entity";
import { DepartmentsRepository } from "./departments.repository";

@Injectable()
export class DepartmentsService {
  constructor(private readonly departmentsRepo: DepartmentsRepository) {}

  async findAll(): Promise<Department[]> {
    return this.departmentsRepo.findScoped({ order: { name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<Department> {
    const department = await this.departmentsRepo.findOneScoped({ where: { id } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  async create(dto: CreateDepartmentDto, userId: string): Promise<Department> {
    const department = this.departmentsRepo.createScoped({ ...dto, createdBy: userId });
    return this.departmentsRepo.saveScoped(department);
  }

  async update(id: string, dto: UpdateDepartmentDto, userId: string): Promise<Department> {
    const department = await this.findOneOrFail(id);
    Object.assign(department, dto, { updatedBy: userId });
    await this.departmentsRepo.saveScoped(department);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response.
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const department = await this.findOneOrFail(id);
    await this.departmentsRepo.softRemoveScoped(department);
  }
}
