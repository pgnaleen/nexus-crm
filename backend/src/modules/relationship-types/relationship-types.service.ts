import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateRelationshipTypeDto } from "./dto/create-relationship-type.dto";
import { UpdateRelationshipTypeDto } from "./dto/update-relationship-type.dto";
import { RelationshipType } from "./entities/relationship-type.entity";
import { RelationshipTypesRepository } from "./relationship-types.repository";

@Injectable()
export class RelationshipTypesService {
  constructor(private readonly relationshipTypesRepo: RelationshipTypesRepository) {}

  async findAll(): Promise<RelationshipType[]> {
    return this.relationshipTypesRepo.findScoped({ order: { name: "ASC" } });
  }

  async findOneOrFail(id: string): Promise<RelationshipType> {
    const type = await this.relationshipTypesRepo.findOneScoped({ where: { id } });
    if (!type) {
      throw new NotFoundException("Relationship type not found");
    }
    return type;
  }

  async create(dto: CreateRelationshipTypeDto, userId: string): Promise<RelationshipType> {
    const type = this.relationshipTypesRepo.createScoped({ ...dto, createdBy: userId });
    return this.relationshipTypesRepo.saveScoped(type);
  }

  async update(id: string, dto: UpdateRelationshipTypeDto, userId: string): Promise<RelationshipType> {
    const type = await this.findOneOrFail(id);
    Object.assign(type, dto, { updatedBy: userId });
    await this.relationshipTypesRepo.saveScoped(type);
    // Re-fetch rather than return the in-memory object -- Object.assign copies
    // omitted dto fields as explicit `undefined`, which would misreport
    // untouched columns as missing in the API response (see rbac.service.ts).
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const type = await this.findOneOrFail(id);
    await this.relationshipTypesRepo.softRemoveScoped(type);
  }
}
