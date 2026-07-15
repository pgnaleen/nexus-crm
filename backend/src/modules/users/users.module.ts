import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RefreshToken } from "./entities/refresh-token.entity";
import { User } from "./entities/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
