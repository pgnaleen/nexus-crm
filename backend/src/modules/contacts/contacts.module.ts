import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Contact } from "./entities/contact.entity";
import { ContactsRepository } from "./contacts.repository";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [TypeOrmModule.forFeature([Contact])],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsRepository, ContactsService],
})
export class ContactsModule {}
