import { CompanyResponse, ContactResponse, PERMISSIONS, RelationshipPartyResponse } from "@orelia/common";
import { Body, Controller, Delete, Get, Logger, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { Company } from "../companies/entities/company.entity";
import { Contact } from "../contacts/entities/contact.entity";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateRelationshipPartyCompanyDto } from "./dto/create-relationship-party-company.dto";
import { CreateRelationshipPartyContactDto } from "./dto/create-relationship-party-contact.dto";
import { UpdateRelationshipPartyCompanyDto } from "./dto/update-relationship-party-company.dto";
import { UpdateRelationshipPartyContactDto } from "./dto/update-relationship-party-contact.dto";
import { RelationshipCompanyContactMap } from "./entities/relationship-company-contact-map.entity";
import { RelationshipPartiesService } from "./relationship-parties.service";

const ANY_RELATIONSHIP_PERMISSION = [
  PERMISSIONS.RELATIONSHIP_VIEW,
  PERMISSIONS.RELATIONSHIP_CREATE,
  PERMISSIONS.RELATIONSHIP_UPDATE,
  PERMISSIONS.RELATIONSHIP_DELETE,
];

@Controller("relationship-types/:relationshipTypeId/parties")
export class RelationshipPartiesController {
  private readonly logger = new Logger(RelationshipPartiesController.name);

  constructor(private readonly partiesService: RelationshipPartiesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(ANY_RELATIONSHIP_PERMISSION)
  @Get()
  async findAll(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
  ): Promise<RelationshipPartyResponse[]> {
    this.logger.debug(`GET /relationship-types/${relationshipTypeId}/parties called`);
    try {
      const parties = await this.partiesService.findAllForType(relationshipTypeId);
      this.logger.debug(`GET /relationship-types/${relationshipTypeId}/parties returning ${parties.length} row(s)`);
      return parties.map((party) => this.toResponse(party));
    } catch (err) {
      this.logger.error(`GET /relationship-types/${relationshipTypeId}/parties failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_CREATE])
  @Post("companies")
  async addCompany(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Body() dto: CreateRelationshipPartyCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipPartyResponse> {
    this.logger.debug(`POST .../parties/companies called for type ${relationshipTypeId} by ${user.sub}`);
    try {
      const party = await this.partiesService.addCompany(relationshipTypeId, dto, user.sub);
      this.logger.debug(`POST .../parties/companies succeeded, party ${party.id}`);
      return this.toResponse(party);
    } catch (err) {
      this.logger.error(`POST .../parties/companies failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_CREATE])
  @Post("contacts")
  async addContact(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Body() dto: CreateRelationshipPartyContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipPartyResponse> {
    this.logger.debug(`POST .../parties/contacts called for type ${relationshipTypeId} by ${user.sub}`);
    try {
      const party = await this.partiesService.addContact(relationshipTypeId, dto, user.sub);
      this.logger.debug(`POST .../parties/contacts succeeded, party ${party.id}`);
      return this.toResponse(party);
    } catch (err) {
      this.logger.error(`POST .../parties/contacts failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_UPDATE])
  @Patch("companies/:mapId")
  async updateCompany(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Param("mapId", ParseUUIDPipe) mapId: string,
    @Body() dto: UpdateRelationshipPartyCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipPartyResponse> {
    this.logger.debug(`PATCH .../parties/companies/${mapId} called by ${user.sub}`);
    try {
      const party = await this.partiesService.updateCompany(relationshipTypeId, mapId, dto, user.sub);
      this.logger.debug(`PATCH .../parties/companies/${mapId} succeeded`);
      return this.toResponse(party);
    } catch (err) {
      this.logger.error(`PATCH .../parties/companies/${mapId} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_UPDATE])
  @Patch("contacts/:mapId")
  async updateContact(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Param("mapId", ParseUUIDPipe) mapId: string,
    @Body() dto: UpdateRelationshipPartyContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipPartyResponse> {
    this.logger.debug(`PATCH .../parties/contacts/${mapId} called by ${user.sub}`);
    try {
      const party = await this.partiesService.updateContact(relationshipTypeId, mapId, dto, user.sub);
      this.logger.debug(`PATCH .../parties/contacts/${mapId} succeeded`);
      return this.toResponse(party);
    } catch (err) {
      this.logger.error(`PATCH .../parties/contacts/${mapId} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_UPDATE])
  @Patch(":mapId/disable")
  async disable(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Param("mapId", ParseUUIDPipe) mapId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipPartyResponse> {
    this.logger.debug(`PATCH .../parties/${mapId}/disable called by ${user.sub}`);
    try {
      const party = await this.partiesService.setActive(relationshipTypeId, mapId, false, user.sub);
      this.logger.debug(`PATCH .../parties/${mapId}/disable succeeded`);
      return this.toResponse(party);
    } catch (err) {
      this.logger.error(`PATCH .../parties/${mapId}/disable failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_UPDATE])
  @Patch(":mapId/enable")
  async enable(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Param("mapId", ParseUUIDPipe) mapId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelationshipPartyResponse> {
    this.logger.debug(`PATCH .../parties/${mapId}/enable called by ${user.sub}`);
    try {
      const party = await this.partiesService.setActive(relationshipTypeId, mapId, true, user.sub);
      this.logger.debug(`PATCH .../parties/${mapId}/enable succeeded`);
      return this.toResponse(party);
    } catch (err) {
      this.logger.error(`PATCH .../parties/${mapId}/enable failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.RELATIONSHIP_DELETE])
  @Delete(":mapId")
  async remove(
    @Param("relationshipTypeId", ParseUUIDPipe) relationshipTypeId: string,
    @Param("mapId", ParseUUIDPipe) mapId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    this.logger.debug(`DELETE .../parties/${mapId} called by ${user.sub}`);
    try {
      await this.partiesService.remove(relationshipTypeId, mapId, user.sub);
      this.logger.debug(`DELETE .../parties/${mapId} succeeded`);
      return { success: true };
    } catch (err) {
      this.logger.error(`DELETE .../parties/${mapId} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  private toResponse(party: RelationshipCompanyContactMap): RelationshipPartyResponse {
    return {
      id: party.id,
      relationshipTypeId: party.relationshipTypeId,
      kind: party.companyId ? "company" : "contact",
      isActive: party.isActive,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
      company: party.company ? this.toCompanyResponse(party.company) : null,
      contact: party.contact ? this.toContactResponse(party.contact) : null,
    };
  }

  private toCompanyResponse(company: Company): CompanyResponse {
    return {
      id: company.id,
      tenantId: company.tenantId,
      name: company.name,
      url: company.url ?? null,
      logo: company.logo ?? null,
      brands: company.brands ?? null,
      industryId: company.industryId ?? null,
      subIndustry: company.subIndustry ?? null,
      accountTier: company.accountTier ?? null,
      employeeCount: company.employeeCount ?? null,
      revenueBand: company.revenueBand ?? null,
      annualSpend: company.annualSpend != null ? Number(company.annualSpend) : null,
      sector: company.sector ?? null,
      stockTicker: company.stockTicker ?? null,
      fiscalYearEnd: company.fiscalYearEnd ?? null,
      region: company.region ?? null,
      country: company.country ?? null,
      hqCityAddress: company.hqCityAddress ?? null,
      branches: company.branches ?? null,
      parentCompanyId: company.parentCompanyId ?? null,
      parentCompanyName: company.parentCompanyName ?? null,
      credit: company.credit ?? null,
      territoryOwnerId: company.territoryOwnerId ?? null,
      territoryNotes: company.territoryNotes ?? null,
    };
  }

  private toContactResponse(contact: Contact): ContactResponse {
    return {
      id: contact.id,
      tenantId: contact.tenantId,
      companyId: contact.companyId ?? null,
      fullName: contact.fullName,
      title: contact.title ?? null,
      department: contact.department ?? null,
      roleBuying: contact.roleBuying ?? null,
      email: contact.email ?? null,
      mobileNo: contact.mobileNo ?? null,
      directPhoneNo: contact.directPhoneNo ?? null,
      linkedIn: contact.linkedIn ?? null,
      preferredChannels: contact.preferredChannels ?? null,
      languages: contact.languages ?? null,
      country: contact.country ?? null,
      timezone: contact.timezone ?? null,
      relationshipOwner: contact.relationshipOwner ?? null,
      photoUrl: contact.photoUrl ?? null,
      dob: contact.dob ?? null,
      userId: contact.userId ?? null,
    };
  }
}
