import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Industry } from "../tenants/entities/industry.entity";

@Injectable()
export class IndustriesService {
  constructor(
    @InjectRepository(Industry)
    private readonly industriesRepo: Repository<Industry>,
  ) {}

  async findAll(): Promise<Industry[]> {
    return this.industriesRepo.find({ order: { name: "ASC" } });
  }
}
