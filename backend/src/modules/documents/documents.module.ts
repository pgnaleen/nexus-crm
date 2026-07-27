import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Document } from "./entities/document.entity";
import { DocumentsRepository } from "./documents.repository";
import { DocumentsService } from "./documents.service";

// No controller of its own -- every owner type (deals, certifications,
// employees, companies) keeps its own existing routes/API shape; they just
// import this module and delegate to DocumentsService underneath. See
// documents.service.ts for the replace-vs-add-vs-remove policy per owner type.
@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [DocumentsRepository, DocumentsService],
  exports: [DocumentsRepository, DocumentsService],
})
export class DocumentsModule {}
