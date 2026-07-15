import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMainAndSubStages1784098715314 implements MigrationInterface {
    name = 'CreateMainAndSubStages1784098715314'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "main_stages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "position" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_7710eb957af79cc86424e1ee65b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sub_stages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "is_won" boolean NOT NULL DEFAULT false, "is_lost" boolean NOT NULL DEFAULT false, "main_stage_id" uuid NOT NULL, CONSTRAINT "PK_3ee5de74181ecc2638a1a947ca8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "main_stages" ADD CONSTRAINT "FK_6ab9601f5c6ec9d130e89224496" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sub_stages" ADD CONSTRAINT "FK_ea432d5b5bce0b0bcac0bfc583b" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sub_stages" ADD CONSTRAINT "FK_f258827cc02e356dc8bd6b17dcc" FOREIGN KEY ("main_stage_id") REFERENCES "main_stages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sub_stages" DROP CONSTRAINT "FK_f258827cc02e356dc8bd6b17dcc"`);
        await queryRunner.query(`ALTER TABLE "sub_stages" DROP CONSTRAINT "FK_ea432d5b5bce0b0bcac0bfc583b"`);
        await queryRunner.query(`ALTER TABLE "main_stages" DROP CONSTRAINT "FK_6ab9601f5c6ec9d130e89224496"`);
        await queryRunner.query(`DROP TABLE "sub_stages"`);
        await queryRunner.query(`DROP TABLE "main_stages"`);
    }

}
