import { DealNoteResponse, PERMISSIONS } from "@orelia/common";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CreateDealNoteDto } from "./dto/create-deal-note.dto";
import { UpdateDealNoteDto } from "./dto/update-deal-note.dto";
import { DealNote } from "./entities/deal-note.entity";
import { DealNotesService } from "./deal-notes.service";

@Controller("deals/:dealId/notes")
export class DealNotesController {
  constructor(private readonly dealNotesService: DealNotesService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_VIEW])
  @Get()
  async findAll(@Param("dealId", ParseUUIDPipe) dealId: string): Promise<DealNoteResponse[]> {
    const notes = await this.dealNotesService.findAll(dealId);
    return notes.map((note) => this.toResponse(note));
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Post()
  async create(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Body() dto: CreateDealNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealNoteResponse> {
    const note = await this.dealNotesService.create(dealId, dto, user.sub);
    return this.toResponse(note);
  }

  // DEALS_UPDATE gates who can reach this route at all; the author-only
  // check (403 if the caller didn't write the note) happens inside the
  // service, since it's an ownership rule, not a resource permission.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Patch(":noteId")
  async update(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateDealNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealNoteResponse> {
    const note = await this.dealNotesService.update(dealId, noteId, dto, user.sub);
    return this.toResponse(note);
  }

  // Same DEALS_UPDATE gate as update(); the author-only check (403 if the
  // caller didn't write the note) happens inside the service.
  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.DEALS_UPDATE])
  @Delete(":noteId")
  async remove(
    @Param("dealId", ParseUUIDPipe) dealId: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.dealNotesService.remove(dealId, noteId, user.sub);
    return { success: true };
  }

  private toResponse(note: DealNote): DealNoteResponse {
    return {
      id: note.id,
      dealId: note.dealId,
      // Deleted notes stay in the list as a tombstone, but their content
      // never leaves the server once deleted.
      text: note.deletedAt ? null : note.text,
      authorId: note.createdBy ?? null,
      authorName: note.authorUser?.displayName ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      deletedAt: note.deletedAt ? note.deletedAt.toISOString() : null,
    };
  }
}
