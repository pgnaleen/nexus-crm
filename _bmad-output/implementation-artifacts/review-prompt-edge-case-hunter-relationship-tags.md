Invoke the `bmad-review-edge-case-hunter` skill on this diff:

## New file: backend/src/modules/relationship-types/dto/add-relationship-tag.dto.ts

```ts
import { AddRelationshipTagRequest } from "@orelia/common";
import { IsUUID } from "class-validator";

export class AddRelationshipTagDto implements AddRelationshipTagRequest {
  @IsUUID()
  relationshipTypeId!: string;
}
```

## New file: backend/src/modules/relationship-types/relationship-tags.controller.ts

```ts
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
```

## New file: frontend/src/components/ui/RelationshipHubDiagram.tsx

```tsx
"use client";

export interface RelationshipHubDiagramSpoke {
  id: string;
  label: string;
  isActive: boolean;
}

interface RelationshipHubDiagramProps {
  centerLabel: string;
  spokes: RelationshipHubDiagramSpoke[];
  emptyLabel: string;
}

const VIEW_WIDTH = 420;
const VIEW_HEIGHT = 260;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const RADIUS = 92;
const CENTER_NODE_WIDTH = 148;
const CENTER_NODE_HEIGHT = 46;
const SPOKE_NODE_WIDTH = 116;
const SPOKE_NODE_HEIGHT = 38;

export function RelationshipHubDiagram({ centerLabel, spokes, emptyLabel }: RelationshipHubDiagramProps) {
  const positions = spokes.map((spoke, index) => {
    const angle = (2 * Math.PI * index) / spokes.length - Math.PI / 2;
    return {
      ...spoke,
      x: CENTER_X + RADIUS * Math.cos(angle),
      y: CENTER_Y + RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        style={{ maxHeight: spokes.length === 0 ? 140 : 280 }}
        role="img"
        aria-label={centerLabel}
      >
        {positions.map((spoke) => (
          <line
            key={`line-${spoke.id}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={spoke.x}
            y2={spoke.y}
            stroke={spoke.isActive ? "var(--color-crm-primary)" : "var(--color-border)"}
            strokeWidth={2}
          />
        ))}

        <foreignObject
          x={CENTER_X - CENTER_NODE_WIDTH / 2}
          y={CENTER_Y - CENTER_NODE_HEIGHT / 2}
          width={CENTER_NODE_WIDTH}
          height={CENTER_NODE_HEIGHT}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-crm-primary bg-crm-primary-tint px-2 text-center text-[12.5px] font-semibold leading-tight text-crm-text">
            {centerLabel}
          </div>
        </foreignObject>

        {positions.map((spoke) => (
          <foreignObject
            key={`node-${spoke.id}`}
            x={spoke.x - SPOKE_NODE_WIDTH / 2}
            y={spoke.y - SPOKE_NODE_HEIGHT / 2}
            width={SPOKE_NODE_WIDTH}
            height={SPOKE_NODE_HEIGHT}
          >
            <div
              className={`flex h-full w-full items-center justify-center overflow-hidden rounded-md border px-2 text-center text-[11.5px] font-medium leading-tight ${
                spoke.isActive
                  ? "border-crm-primary/40 bg-white text-crm-text"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]"
              }`}
              title={spoke.label}
            >
              {spoke.label}
            </div>
          </foreignObject>
        ))}
      </svg>

      {spokes.length === 0 && <p className="text-[13px] text-[var(--color-text-muted)]">{emptyLabel}</p>}
    </div>
  );
}
```

## Modified: common/src/contracts/relationship-parties.contracts.ts

```diff
@@ -23,3 +23,22 @@
   company: CompanyResponse | null;
   contact: ContactResponse | null;
 }
+
+export interface RelationshipTagResponse {
+  mapId: string;
+  relationshipTypeId: string;
+  relationshipTypeName: string;
+  isActive: boolean;
+}
+
+export interface AddRelationshipTagRequest {
+  relationshipTypeId: string;
+}
```

## Modified: backend/src/modules/relationship-types/relationship-parties.service.ts (new methods appended; nothing above this point changed)

```diff
@@ -529,6 +529,183 @@ export class RelationshipPartiesService {
     }
   }

+  async findTagsForCompany(companyId: string): Promise<RelationshipCompanyContactMap[]> {
+    this.logger.debug(`findTagsForCompany called for company ${companyId}`);
+    try {
+      const company = await this.companiesRepo.findOneScoped({ where: { id: companyId } });
+      if (!company) {
+        this.logger.debug(`findTagsForCompany: company ${companyId} not found`);
+        throw new NotFoundException("Company not found");
+      }
+      const tags = await this.partiesRepo.findScoped({
+        where: { companyId },
+        relations: ["relationshipType"],
+        order: { createdAt: "ASC" },
+      });
+      this.logger.debug(`findTagsForCompany returning ${tags.length} tag(s) for company ${companyId} (active+inactive)`);
+      return tags;
+    } catch (err) {
+      this.logger.error(`findTagsForCompany failed for company ${companyId}: ${(err as Error).message}`, (err as Error).stack);
+      throw err;
+    }
+  }
+
+  async findTagsForContact(contactId: string): Promise<RelationshipCompanyContactMap[]> {
+    this.logger.debug(`findTagsForContact called for contact ${contactId}`);
+    try {
+      const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
+      if (!contact) {
+        this.logger.debug(`findTagsForContact: contact ${contactId} not found`);
+        throw new NotFoundException("Contact not found");
+      }
+      const tags = await this.partiesRepo.findScoped({
+        where: { contactId },
+        relations: ["relationshipType"],
+        order: { createdAt: "ASC" },
+      });
+      this.logger.debug(`findTagsForContact returning ${tags.length} tag(s) for contact ${contactId} (active+inactive)`);
+      return tags;
+    } catch (err) {
+      this.logger.error(`findTagsForContact failed for contact ${contactId}: ${(err as Error).message}`, (err as Error).stack);
+      throw err;
+    }
+  }
+
+  async linkExistingCompanyToType(
+    companyId: string,
+    relationshipTypeId: string,
+    userId: string,
+  ): Promise<RelationshipCompanyContactMap> {
+    this.logger.debug(`linkExistingCompanyToType called for company ${companyId} -> type ${relationshipTypeId} by ${userId}`);
+    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
+    const company = await this.companiesRepo.findOneScoped({ where: { id: companyId } });
+    if (!company) {
+      this.logger.debug(`linkExistingCompanyToType: company ${companyId} not found`);
+      throw new NotFoundException("Company not found");
+    }
+
+    const existing = await this.partiesRepo.findOneScoped({ where: { companyId, relationshipTypeId } });
+    if (existing?.isActive) {
+      this.logger.debug(`Blocked: company ${companyId} already actively tagged under type ${relationshipTypeId}`);
+      throw new ConflictException("This company is already tagged under this relationship type");
+    }
+
+    try {
+      if (existing) {
+        this.logger.debug(`Reactivating disabled tag ${existing.id} for company ${companyId} -> type ${relationshipTypeId}`);
+        return await this.setActive(relationshipTypeId, existing.id, true, userId);
+      }
+
+      this.logger.debug(`No existing tag found, creating new tag for company ${companyId} -> type ${relationshipTypeId}`);
+      const party = this.partiesRepo.createScoped({ relationshipTypeId, companyId, createdBy: userId });
+      const saved = await this.partiesRepo.saveScoped(party);
+      this.logger.debug(`linkExistingCompanyToType succeeded, new tag ${saved.id}`);
+
+      await this.auditLogService.record({
+        entityType: "relationship_company_contact_map",
+        entityId: saved.id,
+        action: "insert",
+        actorId: userId,
+        changes: { relationshipTypeId, companyId },
+      });
+
+      return this.findOneOrFail(relationshipTypeId, saved.id);
+    } catch (err) {
+      this.logger.error(`linkExistingCompanyToType failed for company ${companyId} -> type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
+      throw err;
+    }
+  }
+
+  async linkExistingContactToType(
+    contactId: string,
+    relationshipTypeId: string,
+    userId: string,
+  ): Promise<RelationshipCompanyContactMap> {
+    this.logger.debug(`linkExistingContactToType called for contact ${contactId} -> type ${relationshipTypeId} by ${userId}`);
+    await this.relationshipTypesService.findOneOrFail(relationshipTypeId);
+    const contact = await this.contactsRepo.findOneScoped({ where: { id: contactId } });
+    if (!contact) {
+      this.logger.debug(`linkExistingContactToType: contact ${contactId} not found`);
+      throw new NotFoundException("Contact not found");
+    }
+    if (contact.companyId) {
+      this.logger.debug(`Blocked: contact ${contactId} belongs to company ${contact.companyId}, cannot tag independently`);
+      throw new BadRequestException("This contact belongs to a company -- tag the company instead of the contact directly");
+    }
+
+    const existing = await this.partiesRepo.findOneScoped({ where: { contactId, relationshipTypeId } });
+    if (existing?.isActive) {
+      this.logger.debug(`Blocked: contact ${contactId} already actively tagged under type ${relationshipTypeId}`);
+      throw new ConflictException("This contact is already tagged under this relationship type");
+    }
+
+    try {
+      if (existing) {
+        this.logger.debug(`Reactivating disabled tag ${existing.id} for contact ${contactId} -> type ${relationshipTypeId}`);
+        return await this.setActive(relationshipTypeId, existing.id, true, userId);
+      }
+
+      this.logger.debug(`No existing tag found, creating new tag for contact ${contactId} -> type ${relationshipTypeId}`);
+      const party = this.partiesRepo.createScoped({ relationshipTypeId, contactId, createdBy: userId });
+      const saved = await this.partiesRepo.saveScoped(party);
+      this.logger.debug(`linkExistingContactToType succeeded, new tag ${saved.id}`);
+
+      await this.auditLogService.record({
+        entityType: "relationship_company_contact_map",
+        entityId: saved.id,
+        action: "insert",
+        actorId: userId,
+        changes: { relationshipTypeId, contactId },
+      });
+
+      return this.findOneOrFail(relationshipTypeId, saved.id);
+    } catch (err) {
+      this.logger.error(`linkExistingContactToType failed for contact ${contactId} -> type ${relationshipTypeId}: ${(err as Error).message}`, (err as Error).stack);
+      throw err;
+    }
+  }
+
   // Previously this only soft-deleted the relationship_company_contact_map
```

## Modified: backend/src/modules/relationship-types/relationship-types.module.ts

```diff
@@ -13,6 +13,7 @@ import { RelationshipType } from "./entities/relationship-type.entity";
 import { RelationshipPartiesController } from "./relationship-parties.controller";
 import { RelationshipPartiesRepository } from "./relationship-parties.repository";
 import { RelationshipPartiesService } from "./relationship-parties.service";
+import { RelationshipTagsController } from "./relationship-tags.controller";
 import { RelationshipTypesController } from "./relationship-types.controller";
 import { RelationshipTypesRepository } from "./relationship-types.repository";
 import { RelationshipTypesService } from "./relationship-types.service";
@@ -30,7 +31,7 @@ import { RelationshipTypesService } from "./relationship-types.service";
     RbacModule,
     DocumentsModule,
   ],
-  controllers: [RelationshipTypesController, RelationshipPartiesController],
+  controllers: [RelationshipTypesController, RelationshipPartiesController, RelationshipTagsController],
   providers: [
     RelationshipTypesService,
     RelationshipTypesRepository,
```

## Modified: frontend/src/lib/api/relationship-parties.ts

```diff
@@ -1,8 +1,10 @@
 import type {
+  AddRelationshipTagRequest,
   ContactResponse,
   CreateContactRequest,
   CreateRelationshipPartyCompanyRequest,
   RelationshipPartyResponse,
+  RelationshipTagResponse,
   UpdateCompanyRequest,
   UpdateContactRequest,
 } from "@orelia/common";
@@ -116,3 +118,34 @@ export function deleteRelationshipParty(
     method: "DELETE",
   });
 }
+
+export function listCompanyTags(companyId: string): Promise<RelationshipTagResponse[]> {
+  return apiFetch<RelationshipTagResponse[]>(`/relationship-parties/companies/${companyId}/tags`);
+}
+
+export function addCompanyTag(
+  companyId: string,
+  payload: AddRelationshipTagRequest,
+): Promise<RelationshipTagResponse> {
+  return apiFetch<RelationshipTagResponse>(`/relationship-parties/companies/${companyId}/tags`, {
+    method: "POST",
+    body: JSON.stringify(payload),
+  });
+}
+
+export function listContactTags(contactId: string): Promise<RelationshipTagResponse[]> {
+  return apiFetch<RelationshipTagResponse[]>(`/relationship-parties/contacts/${contactId}/tags`);
+}
+
+export function addContactTag(
+  contactId: string,
+  payload: AddRelationshipTagRequest,
+): Promise<RelationshipTagResponse> {
+  return apiFetch<RelationshipTagResponse>(`/relationship-parties/contacts/${contactId}/tags`, {
+    method: "POST",
+    body: JSON.stringify(payload),
+  });
+}
```

## Modified: frontend/src/locales/en.json (isolated hunk -- this file has other unrelated pending edits elsewhere from a different in-progress task; only this hunk is part of this feature)

```diff
@@ -433,6 +433,23 @@
       "systemRoleHelp": "Flag this as the tenant's Customer or Partner type to make it available in the Deal's Customer/Partners pickers."
     }
   },
+  "relationshipTags": {
+    "tabLabel": "Relationships",
+    "emptyState": "No relationship type tags yet.",
+    "companyOwnedNote": "Tags are managed on this contact's company record.",
+    "add": {
+      "label": "Add relationship type",
+      "placeholder": "Select a relationship type...",
+      "searchPlaceholder": "Search relationship types...",
+      "emptyLabel": "No untagged relationship types available",
+      "button": "Add tag"
+    },
+    "errors": {
+      "loadFailed": "Failed to load relationship tags",
+      "duplicateTag": "This is already tagged under this relationship type",
+      "addFailed": "Failed to add relationship type tag"
+    }
+  },
   "addDealDialog": {
```

## Modified: frontend/src/app/[tenant]/(dashboard)/relationships/[id]/_components/CompanyFormDialog.tsx

```diff
@@ -16,14 +16,19 @@ import type {
   ContactResponse,
   EmployeePickerResponse,
   IndustryResponse,
+  RelationshipTagResponse,
+  RelationshipTypeResponse,
 } from "@orelia/common";
 import {
+  addCompanyTag,
   createRelationshipPartyCompany,
   createRelationshipPartyContact,
   deleteCompanyContact,
   listCompanyContacts,
+  listCompanyTags,
   updateRelationshipPartyCompany,
 } from "@/lib/api/relationship-parties";
+import { listRelationshipTypes } from "@/lib/api/relationship-types";
 import { uploadLogo } from "@/lib/api/uploads";
 import { ApiError } from "@/lib/api/client";
 import { Dialog } from "@/components/ui/Dialog";
@@ -31,10 +36,13 @@ import { Button } from "@/components/ui/Button";
 import { TextField } from "@/components/ui/TextField";
 import { CustomSelect } from "@/components/ui/CustomSelect";
 import { CountrySelect } from "@/components/ui/CountrySelect";
+import { SearchSelect } from "@/components/ui/SearchSelect";
+import { RelationshipHubDiagram } from "@/components/ui/RelationshipHubDiagram";
 import { Spinner } from "@/components/ui/Spinner";
 import { EditIcon, PlusIcon, TrashIcon, UploadCloudIcon } from "@/components/ui/icons";
 import { useConfirm, useAlert } from "@/components/providers/DialogProvider";
 import { min, minLength, required, validate } from "@/lib/validation";
+import { t } from "@/lib/i18n";
 import { ContactFields, type ContactFieldsValue } from "./ContactFields";
 import { ContactFormDialog } from "./ContactFormDialog";

@@ -197,7 +205,7 @@ function toFormState(company?: CompanyResponse): FormState {
   };
 }

-type TabId = "details" | "business" | "contacts";
+type TabId = "details" | "business" | "contacts" | "relationships";

 interface CompanyFormDialogProps {
   mode: "create" | "edit" | "view";
@@ -214,6 +222,10 @@ interface CompanyFormDialogProps {
   canUpdate?: boolean;
   canDelete?: boolean;
+  canCreate?: boolean;
   onClose: () => void;
   onSaved: () => void;
 }
@@ -229,6 +241,7 @@ export function CompanyFormDialog({
   companies,
   canUpdate = false,
   canDelete = false,
+  canCreate = false,
   onClose,
   onSaved,
 }: CompanyFormDialogProps) {
@@ -279,6 +292,84 @@ export function CompanyFormDialog({
     };
   }, [mode, mapId, relationshipTypeId]);

+  const [tags, setTags] = useState<RelationshipTagResponse[]>([]);
+  const [isLoadingTags, setIsLoadingTags] = useState(mode !== "create");
+  const [relationshipTypeOptions, setRelationshipTypeOptions] = useState<RelationshipTypeResponse[]>([]);
+  const [selectedTagTypeId, setSelectedTagTypeId] = useState("");
+  const [isAddingTag, setIsAddingTag] = useState(false);
+  const [tagError, setTagError] = useState<string | null>(null);
+
+  useEffect(() => {
+    if (mode === "create" || !company) return;
+    let cancelled = false;
+    setIsLoadingTags(true);
+    listCompanyTags(company.id)
+      .then((rows) => {
+        if (!cancelled) setTags(rows);
+      })
+      .catch(() => {
+        if (!cancelled) setTagError(t("relationshipTags.errors.loadFailed"));
+      })
+      .finally(() => {
+        if (!cancelled) setIsLoadingTags(false);
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, [mode, company]);
+
+  useEffect(() => {
+    if (mode !== "edit" || !canCreate) return;
+    let cancelled = false;
+    listRelationshipTypes()
+      .then((rows) => {
+        if (!cancelled) setRelationshipTypeOptions(rows);
+      })
+      .catch(() => {
+        // Non-fatal -- the add-tag picker just stays empty; existing tags
+        // still render fine from the effect above.
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, [mode, canCreate]);
+
+  async function refreshTags() {
+    if (!company) return;
+    try {
+      const rows = await listCompanyTags(company.id);
+      setTags(rows);
+    } catch {
+      // Non-fatal -- the just-added tag already succeeded; the list will
+      // catch up next time this dialog opens.
+    }
+  }
+
+  async function handleAddTag() {
+    if (!company || !selectedTagTypeId) return;
+    setTagError(null);
+    setIsAddingTag(true);
+    try {
+      await addCompanyTag(company.id, { relationshipTypeId: selectedTagTypeId });
+      setSelectedTagTypeId("");
+      await refreshTags();
+    } catch (err) {
+      if (err instanceof ApiError) {
+        setTagError(err.status === 409 ? t("relationshipTags.errors.duplicateTag") : err.message);
+      } else {
+        setTagError(t("relationshipTags.errors.addFailed"));
+      }
+    } finally {
+      setIsAddingTag(false);
+    }
+  }
+
   const confirm = useConfirm();
   const { showError } = useAlert();

@@ -497,6 +588,12 @@ export function CompanyFormDialog({
     companies.filter((c) => c.id !== company?.id).map((c) => ({ value: c.id, label: c.name })),
   );

+  const tagSpokes = tags.map((tag) => ({ id: tag.mapId, label: tag.relationshipTypeName, isActive: tag.isActive }));
+  const taggedTypeIds = new Set(tags.map((tag) => tag.relationshipTypeId));
+  const addTagOptions = relationshipTypeOptions
+    .filter((type) => !taggedTypeIds.has(type.id))
+    .map((type) => ({ value: type.id, label: type.name }));
+
   return (
     <Dialog
       open
@@ -533,6 +630,15 @@ export function CompanyFormDialog({
           >
             Contacts{contacts.length + existingContacts.length > 0 ? ` (${contacts.length + existingContacts.length})` : ""}
           </button>
+          {mode !== "create" && (
+            <button
+              type="button"
+              className={`dialog-tab${activeTab === "relationships" ? " dialog-tab-active" : ""}`}
+              onClick={() => setActiveTab("relationships")}
+            >
+              {t("relationshipTags.tabLabel")}
+            </button>
+          )}
         </div>

         {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}
@@ -915,6 +1021,50 @@ export function CompanyFormDialog({
           </div>
         )}

+        {/* -- Tab 4: Relationships -- */}
+        {activeTab === "relationships" && (
+          <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
+            {isLoadingTags ? (
+              <Spinner size={20} />
+            ) : (
+              <RelationshipHubDiagram
+                centerLabel={values.name}
+                spokes={tagSpokes}
+                emptyLabel={t("relationshipTags.emptyState")}
+              />
+            )}
+
+            {!isViewOnly && canCreate && (
+              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
+                {tagError && <p className="mb-2 text-[12.5px] text-[var(--color-danger)]">{tagError}</p>}
+                <div className="flex items-end gap-2.5">
+                  <div className="flex-1">
+                    <SearchSelect
+                      label={t("relationshipTags.add.label")}
+                      value={selectedTagTypeId}
+                      onChange={setSelectedTagTypeId}
+                      options={addTagOptions}
+                      placeholder={t("relationshipTags.add.placeholder")}
+                      searchPlaceholder={t("relationshipTags.add.searchPlaceholder")}
+                      emptyLabel={t("relationshipTags.add.emptyLabel")}
+                      disabled={isAddingTag}
+                    />
+                  </div>
+                  <Button
+                    type="button"
+                    variant="secondary"
+                    onClick={handleAddTag}
+                    isLoading={isAddingTag}
+                    disabled={!selectedTagTypeId}
+                  >
+                    <PlusIcon size={14} /> {t("relationshipTags.add.button")}
+                  </Button>
+                </div>
+              </div>
+            )}
+          </div>
+        )}
+
         <div className="mt-2 flex justify-end gap-2.5">
           <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
             {isViewOnly ? "Close" : "Cancel"}
```

## Modified: frontend/src/app/[tenant]/(dashboard)/relationships/[id]/_components/ContactFormDialog.tsx

```diff
@@ -1,17 +1,30 @@
 "use client";

-import { useState, type FormEvent } from "react";
-import type { CompanyPickerResponse, ContactResponse } from "@orelia/common";
+import { useEffect, useState, type FormEvent } from "react";
+import type {
+  CompanyPickerResponse,
+  ContactResponse,
+  RelationshipTagResponse,
+  RelationshipTypeResponse,
+} from "@orelia/common";
 import {
+  addContactTag,
   createRelationshipPartyContact,
+  listContactTags,
   updateCompanyContact,
   updateRelationshipPartyContact,
 } from "@/lib/api/relationship-parties";
+import { listRelationshipTypes } from "@/lib/api/relationship-types";
 import { ApiError } from "@/lib/api/client";
 import { Dialog } from "@/components/ui/Dialog";
 import { Button } from "@/components/ui/Button";
 import { CustomSelect } from "@/components/ui/CustomSelect";
+import { SearchSelect } from "@/components/ui/SearchSelect";
+import { RelationshipHubDiagram } from "@/components/ui/RelationshipHubDiagram";
+import { Spinner } from "@/components/ui/Spinner";
+import { PlusIcon } from "@/components/ui/icons";
 import { email as emailValidator, linkedInUrl, minLength, phoneNumber, required, validate } from "@/lib/validation";
+import { t } from "@/lib/i18n";
 import { ContactFields, type ContactFieldsValue } from "./ContactFields";

 interface FormState extends ContactFieldsValue {
@@ -34,6 +47,8 @@ function toFormState(contact?: ContactResponse): FormState {
   };
 }

+type TabId = "details" | "relationships";
+
 interface ContactFormDialogProps {
   mode: "create" | "edit" | "view";
   relationshipTypeId: string;
@@ -46,6 +61,9 @@ interface ContactFormDialogProps {
   companyContext?: { companyMapId: string; contactId: string };
   contact?: ContactResponse;
   companies: CompanyPickerResponse[];
+  canCreate?: boolean;
   onClose: () => void;
   onSaved: () => void;
 }
@@ -58,15 +76,100 @@ export function ContactFormDialog({
   companyContext,
   contact,
   companies,
+  canCreate = false,
   onClose,
   onSaved,
 }: ContactFormDialogProps) {
   const isViewOnly = mode === "view";
+  const [activeTab, setActiveTab] = useState<TabId>("details");
   const [values, setValues] = useState<FormState>(() => toFormState(contact));
   const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
   const [formError, setFormError] = useState<string | null>(null);
   const [isSaving, setIsSaving] = useState(false);

+  const showRelationshipsTab = mode !== "create" && !companyContext && !!contact;
+
+  const [tags, setTags] = useState<RelationshipTagResponse[]>([]);
+  const [isLoadingTags, setIsLoadingTags] = useState(showRelationshipsTab);
+  const [relationshipTypeOptions, setRelationshipTypeOptions] = useState<RelationshipTypeResponse[]>([]);
+  const [selectedTagTypeId, setSelectedTagTypeId] = useState("");
+  const [isAddingTag, setIsAddingTag] = useState(false);
+  const [tagError, setTagError] = useState<string | null>(null);
+
+  useEffect(() => {
+    if (!showRelationshipsTab || !contact) return;
+    let cancelled = false;
+    setIsLoadingTags(true);
+    listContactTags(contact.id)
+      .then((rows) => {
+        if (!cancelled) setTags(rows);
+      })
+      .catch(() => {
+        if (!cancelled) setTagError(t("relationshipTags.errors.loadFailed"));
+      })
+      .finally(() => {
+        if (!cancelled) setIsLoadingTags(false);
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, [showRelationshipsTab, contact]);
+
+  useEffect(() => {
+    if (mode !== "edit" || !canCreate || !showRelationshipsTab) return;
+    let cancelled = false;
+    listRelationshipTypes()
+      .then((rows) => {
+        if (!cancelled) setRelationshipTypeOptions(rows);
+      })
+      .catch(() => {
+        // Non-fatal -- the add-tag picker just stays empty; existing tags
+        // still render fine from the effect above.
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, [mode, canCreate, showRelationshipsTab]);
+
+  async function refreshTags() {
+    if (!contact) return;
+    try {
+      const rows = await listContactTags(contact.id);
+      setTags(rows);
+    } catch {
+      // Non-fatal -- the just-added tag already succeeded; the list will
+      // catch up next time this dialog opens.
+    }
+  }
+
+  async function handleAddTag() {
+    if (!contact || !selectedTagTypeId) return;
+    setTagError(null);
+    setIsAddingTag(true);
+    try {
+      await addContactTag(contact.id, { relationshipTypeId: selectedTagTypeId });
+      setSelectedTagTypeId("");
+      await refreshTags();
+    } catch (err) {
+      if (err instanceof ApiError) {
+        setTagError(err.status === 409 ? t("relationshipTags.errors.duplicateTag") : err.message);
+      } else {
+        setTagError(t("relationshipTags.errors.addFailed"));
+      }
+    } finally {
+      setIsAddingTag(false);
+    }
+  }
+
   function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
     setValues((current) => ({ ...current, [field]: value }));
   }
@@ -92,7 +195,11 @@ export function ContactFormDialog({
       if (linkedInError) nextErrors.linkedIn = linkedInError;
     }
     setErrors(nextErrors);
-    return Object.keys(nextErrors).length === 0;
+    if (Object.keys(nextErrors).length > 0) {
+      setActiveTab("details");
+      return false;
+    }
+    return true;
   }

   async function handleSubmit(event: FormEvent) {
@@ -153,6 +260,12 @@ export function ContactFormDialog({
     ...companies.map((c) => ({ value: c.id, label: c.name })),
   ];

+  const tagSpokes = tags.map((tag) => ({ id: tag.mapId, label: tag.relationshipTypeName, isActive: tag.isActive }));
+  const taggedTypeIds = new Set(tags.map((tag) => tag.relationshipTypeId));
+  const addTagOptions = relationshipTypeOptions
+    .filter((type) => !taggedTypeIds.has(type.id))
+    .map((type) => ({ value: type.id, label: type.name }));
+
   return (
     <Dialog
       open
@@ -164,33 +277,101 @@ export function ContactFormDialog({
             : "Edit Person"
       }
       onClose={onClose}
-      maxWidth="560px"
+      maxWidth="680px"
     >
       <form onSubmit={handleSubmit}>
+        {showRelationshipsTab && (
+          <div className="dialog-tabs">
+            <button
+              type="button"
+              className={`dialog-tab${activeTab === "details" ? " dialog-tab-active" : ""}`}
+              onClick={() => setActiveTab("details")}
+            >
+              Person Details
+            </button>
+            <button
+              type="button"
+              className={`dialog-tab${activeTab === "relationships" ? " dialog-tab-active" : ""}`}
+              onClick={() => setActiveTab("relationships")}
+            >
+              {t("relationshipTags.tabLabel")}
+            </button>
+          </div>
+        )}
+
         {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

-        <ContactFields
-          values={values}
-          errors={errors}
-          fullNameRequired
-          disabled={isViewOnly}
-          onChange={(field, value) => setField(field, value as never)}
-        />
-
-        {!companyContext && (
-          <div className="mb-[18px]">
-            <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Company</label>
-            <CustomSelect
-              fullWidth
-              label=""
-              value={values.companyId}
-              onChange={(val) => setField("companyId", val)}
-              options={companyOptions}
+        {/* -- Tab 1: Details -- */}
+        {(!showRelationshipsTab || activeTab === "details") && (
+          <div className="h-[480px] overflow-y-auto pr-1">
+            <ContactFields
+              values={values}
+              errors={errors}
+              fullNameRequired
               disabled={isViewOnly}
+              onChange={(field, value) => setField(field, value as never)}
             />
-            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
-              Select a company only if this contact works under an organization. Leave as &quot;None&quot; to list them as an individual standalone person.
-            </p>
+
+            {!companyContext && (
+              <div className="mb-[18px]">
+                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Company</label>
+                <CustomSelect
+                  fullWidth
+                  label=""
+                  value={values.companyId}
+                  onChange={(val) => setField("companyId", val)}
+                  options={companyOptions}
+                  disabled={isViewOnly}
+                />
+                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
+                  Select a company only if this contact works under an organization. Leave as &quot;None&quot; to list them as an individual standalone person.
+                </p>
+              </div>
+            )}
+          </div>
+        )}
+
+        {/* -- Tab 2: Relationships -- */}
+        {showRelationshipsTab && activeTab === "relationships" && (
+          <div className="h-[480px] overflow-y-auto pr-1">
+            {isLoadingTags ? (
+              <Spinner size={20} />
+            ) : (
+              <RelationshipHubDiagram
+                centerLabel={values.fullName}
+                spokes={tagSpokes}
+                emptyLabel={t("relationshipTags.emptyState")}
+              />
+            )}
+
+            {!isViewOnly && canCreate && (
+              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
+                {tagError && <p className="mb-2 text-[12.5px] text-[var(--color-danger)]">{tagError}</p>}
+                <div className="flex items-end gap-2.5">
+                  <div className="flex-1">
+                    <SearchSelect
+                      label={t("relationshipTags.add.label")}
+                      value={selectedTagTypeId}
+                      onChange={setSelectedTagTypeId}
+                      options={addTagOptions}
+                      placeholder={t("relationshipTags.add.placeholder")}
+                      searchPlaceholder={t("relationshipTags.add.searchPlaceholder")}
+                      emptyLabel={t("relationshipTags.add.emptyLabel")}
+                      disabled={isAddingTag}
+                    />
+                  </div>
+                  <Button
+                    type="button"
+                    variant="secondary"
+                    onClick={handleAddTag}
+                    isLoading={isAddingTag}
+                    disabled={!selectedTagTypeId}
+                  >
+                    <PlusIcon size={14} /> {t("relationshipTags.add.button")}
+                  </Button>
+                </div>
+              </div>
+            )}
           </div>
         )}

```

## Modified: frontend/src/app/[tenant]/(dashboard)/relationships/[id]/_components/RelationshipViewWidget.tsx

```diff
@@ -403,6 +403,7 @@ export function RelationshipViewWidget({
           companies={companies}
           canUpdate={canUpdate}
           canDelete={canDelete}
+          canCreate={canCreate}
           onClose={() => setDialogState(null)}
           onSaved={handleSaved}
         />
@@ -416,6 +417,7 @@ export function RelationshipViewWidget({
           mapId={dialogState.party.id}
           contact={dialogState.party.contact}
           companies={companies}
+          canCreate={canCreate}
           onClose={() => setDialogState(null)}
           onSaved={handleSaved}
         />
```

## Modified: _bmad-output/implementation-artifacts/api-endpoint-registry.md (only the new section shown; the rest of this diff, involving `/deals` rows, belongs to unrelated concurrent work already in this tree and is intentionally excluded here)

```diff
+## Relationship Tags (`backend/src/modules/relationship-types/relationship-tags.controller.ts`)
+
+**New 2026-07-30**, added with the Relationships tab feature. Cross-relationship-type tag list/add for a
+single Company/Contact -- backs the Relationships tab on `CompanyFormDialog.tsx`/`ContactFormDialog.tsx`. Unlike the
+Relationship Parties section above (scoped to one relationship type's own admin page), these routes are keyed by
+the real Company/Contact id, since a party's tags span every relationship type it's tagged under. Reuses the
+existing `RELATIONSHIP_VIEW`/`RELATIONSHIP_CREATE` permissions -- no new permission keys.
+
+| # | Method | Endpoint | Type | Permission(s) | Purpose | Request Data | Response Data | Controller -> Service | Frontend Consumer(s) | Debug Logging | Notes |
+|---|---|---|---|---|---|---|---|---|---|---|---|
+| 1 | GET | `/relationship-parties/companies/:companyId/tags` | RBAC | any `RELATIONSHIP_*` | List every relationship type a Company is tagged under, active or disabled. | none | `RelationshipTagResponse[]` | `findCompanyTags` -> `relationship-parties.service.ts::findTagsForCompany` | `CompanyFormDialog.tsx` (Relationships tab) | v | Returns both active and inactive tags -- `RelationshipHubDiagram` renders the distinction (primary-red vs. grey spoke) rather than the API filtering them out. |
+| 2 | POST | `/relationship-parties/companies/:companyId/tags` | RBAC | `RELATIONSHIP_CREATE` | Tag an *existing* Company into an additional Relationship Type. If a disabled tag for the same pair already exists, reactivates it (via `setActive`) instead of creating a duplicate row. | body: `{relationshipTypeId}` | `RelationshipTagResponse` | `addCompanyTag` -> `relationship-parties.service.ts::linkExistingCompanyToType` | `CompanyFormDialog.tsx` (Relationships tab, edit mode) | v | 409 if already actively tagged. A brand-new row's audit entry is `entityType: "relationship_company_contact_map"`; a reactivation's audit entry stays `entityType: "relationship_party"` (`setActive`'s normal, pre-existing shape) -- deliberately different, not drift. |
+| 3 | GET | `/relationship-parties/contacts/:contactId/tags` | RBAC | any `RELATIONSHIP_*` | List every relationship type a Contact is tagged under, active or disabled. | none | `RelationshipTagResponse[]` | `findContactTags` -> `relationship-parties.service.ts::findTagsForContact` | `ContactFormDialog.tsx` (Relationships tab, standalone contacts only) | v | Always returns an empty list for a company-owned contact (they have no independent tag row). That's expected, not a bug. |
+| 4 | POST | `/relationship-parties/contacts/:contactId/tags` | RBAC | `RELATIONSHIP_CREATE` | Tag an *existing standalone* Contact into an additional Relationship Type. Same reactivate-vs-create-vs-409 behavior as #2. | body: `{relationshipTypeId}` | `RelationshipTagResponse` | `addContactTag` -> `relationship-parties.service.ts::linkExistingContactToType` | `ContactFormDialog.tsx` (Relationships tab, edit mode, standalone contacts only) | v | 400 `BadRequestException` if the contact belongs to a company (`contact.companyId` set). |
```
