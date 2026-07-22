import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BaseTenantRepository, TenantContextService } from "../../core/tenant";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";

@Injectable()
export class RelationshipPartiesRepository extends BaseTenantRepository<RelationshipCompanyContactMap> {
  constructor(
    @InjectRepository(RelationshipCompanyContactMap) repo: Repository<RelationshipCompanyContactMap>,
    tenantContext: TenantContextService,
  ) {
    super(repo, tenantContext);
  }

  async softRemoveScoped(party: RelationshipCompanyContactMap, actorId?: string): Promise<void> {
    if (party.tenantId !== this.tenantContext.getTenantId()) {
      throw new ForbiddenException("Entity does not belong to the current tenant");
    }
    await this.repo.softRemove(party);
    await this.repo.update(party.id, { deletedBy: actorId });
  }

  // Used to warn the user how many Company/Contact rows a Relationship Type
  // deletion will cascade-delete, before they confirm.
  countActiveForType(relationshipTypeId: string): Promise<number> {
    return this.queryBuilderScoped("party")
      .andWhere("party.relationship_type_id = :relationshipTypeId", { relationshipTypeId })
      .getCount();
  }

  // Same as above but for a whole list at once (one grouped query instead of
  // one count query per row) -- used to populate every row's dependentCount
  // in a Relationship Types list without an N+1.
  async countActiveGroupedByType(relationshipTypeIds: string[]): Promise<Map<string, number>> {
    if (relationshipTypeIds.length === 0) {
      return new Map();
    }
    const rows = await this.queryBuilderScoped("party")
      .select("party.relationship_type_id", "relationshipTypeId")
      .addSelect("COUNT(*)", "count")
      .andWhere("party.relationship_type_id IN (:...relationshipTypeIds)", { relationshipTypeIds })
      .groupBy("party.relationship_type_id")
      .getRawMany<{ relationshipTypeId: string; count: string }>();
    return new Map(rows.map((row) => [row.relationshipTypeId, Number(row.count)]));
  }
}
