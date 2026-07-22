import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Industry } from "../tenants/entities/industry.entity";

@Injectable()
export class IndustriesService {
  private readonly logger = new Logger(IndustriesService.name);

  constructor(
    @InjectRepository(Industry)
    private readonly industriesRepo: Repository<Industry>,
  ) {}

  async findAll(): Promise<Industry[]> {
    this.logger.debug("findAll called");
    try {
      const results = await this.industriesRepo.find({ order: { name: "ASC" } });
      this.logger.debug(`findAll returning ${results.length} row(s)`);
      return results;
    } catch (err) {
      this.logger.error(`findAll failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
