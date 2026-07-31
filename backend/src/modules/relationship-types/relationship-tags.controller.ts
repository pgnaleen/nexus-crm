import { PERMISSIONS, RelationshipTagResponse } from "@orelia/common";
import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { AddRelationshipTagDto } from "./dto/add-relationship-tag.dto";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";
import { RelationshipPartiesService } from "./relationship-parties.service";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

// Cross-relationship-type tag list/add for a single Company/Contact -- backs
// the Relationships tab on CompanyFormDialog/ContactFormDialog. Unlike
// RelationshipPartiesController (scoped to one relationship type's own
// admin page), these routes are keyed by the real Company/Contact id, since
// a party's tags span every relationship type it's tagged under. Reuses the
// existing RELATIONSHIP_VIEW/RELATIONSHIP_CREATE permissions -- no new
// permission keys, per CLAUDE.md's Permission Model rule.
@Controller("relationship-parties")
export class RelationshipTagsController {
  private readonly logger = new Logger(RelationshipTagsController.name);

  constructor(private readonly partiesService: RelationshipPartiesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Get("companies/:companyId/tags")
  async findCompanyTags(
    @Param("companyId", ParseUUIDPipe) companyId: string,
  ): Promise<RelationshipTagResponse[]> {
    this.logger.debug(`GET /relationship-parties/companies/${companyId}/tags called`);
    try {
      const tags = await this.partiesService.findTagsForCompany(companyId);
      const responses = tags.map((tag) => this.toTagResponse(tag));
      this.logger.debug(`GET /relationship-parties/companies/${companyId}/tags returning ${responses.length} row(s)`);
      return responses;
    } catch (err) {
      this.logger.error(`GET /relationship-parties/companies/${companyId}/tags failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_CREATE])
  @Post("companies/:companyId/tags")
  async addCompanyTag(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Body() dto: AddRelationshipTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipTagResponse> {
    this.logger.debug(`POST /relationship-parties/companies/${companyId}/tags called by ${user.sub} (relationshipTypeId=${dto.relationshipTypeId})`);
    try {
      const tag = await this.partiesService.linkExistingCompanyToType(companyId, dto.relationshipTypeId, user.sub);
      this.logger.debug(`POST /relationship-parties/companies/${companyId}/tags succeeded, tag ${tag.id}`);
      return this.toTagResponse(tag);
    } catch (err) {
      this.logger.error(`POST /relationship-parties/companies/${companyId}/tags failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Get("contacts/:contactId/tags")
  async findContactTags(
    @Param("contactId", ParseUUIDPipe) contactId: string,
  ): Promise<RelationshipTagResponse[]> {
    this.logger.debug(`GET /relationship-parties/contacts/${contactId}/tags called`);
    try {
      const tags = await this.partiesService.findTagsForContact(contactId);
      const responses = tags.map((tag) => this.toTagResponse(tag));
      this.logger.debug(`GET /relationship-parties/contacts/${contactId}/tags returning ${responses.length} row(s)`);
      return responses;
    } catch (err) {
      this.logger.error(`GET /relationship-parties/contacts/${contactId}/tags failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_CREATE])
  @Post("contacts/:contactId/tags")
  async addContactTag(
    @Param("contactId", ParseUUIDPipe) contactId: string,
    @Body() dto: AddRelationshipTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipTagResponse> {
    this.logger.debug(`POST /relationship-parties/contacts/${contactId}/tags called by ${user.sub} (relationshipTypeId=${dto.relationshipTypeId})`);
    try {
      const tag = await this.partiesService.linkExistingContactToType(contactId, dto.relationshipTypeId, user.sub);
      this.logger.debug(`POST /relationship-parties/contacts/${contactId}/tags succeeded, tag ${tag.id}`);
      return this.toTagResponse(tag);
    } catch (err) {
      this.logger.error(`POST /relationship-parties/contacts/${contactId}/tags failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toTagResponse(party: RelationshipCompanyContactMap): RelationshipTagResponse {
    return {
      mapId: party.id,
      relationshipTypeId: party.relationshipTypeId,
      relationshipTypeName: party.relationshipType?.name ?? "",
      isActive: party.isActive,
    };
  }
}
