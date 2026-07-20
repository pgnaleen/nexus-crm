import { ContactPickerResponse, PERMISSIONS } from "@orelia/common";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { ContactsService } from "./contacts.service";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission([PERMISSIONS.CONTACTS_READ])
  @Get("picker")
  async findPicker(@Query("companyId") companyId?: string): Promise<ContactPickerResponse[]> {
    const contacts = await this.contactsService.findPicker(companyId);
    return contacts.map((contact) => ({
      id: contact.id,
      fullName: contact.fullName,
      companyId: contact.companyId ?? null,
    }));
  }
}
