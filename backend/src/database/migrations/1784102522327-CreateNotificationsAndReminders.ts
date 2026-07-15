import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsAndReminders1784102522327 implements MigrationInterface {
    name = 'CreateNotificationsAndReminders1784102522327'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."reminders_repeat_type_enum" AS ENUM('none', 'daily', 'weekly', 'monthly')`);
        await queryRunner.query(`CREATE TYPE "public"."reminders_status_enum" AS ENUM('pending', 'sent', 'dismissed', 'completed')`);
        await queryRunner.query(`CREATE TABLE "reminders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "title" character varying NOT NULL, "remind_at" TIMESTAMP WITH TIME ZONE NOT NULL, "repeat_type" "public"."reminders_repeat_type_enum" NOT NULL DEFAULT 'none', "remindable_type" character varying, "remindable_id" uuid, "status" "public"."reminders_status_enum" NOT NULL DEFAULT 'pending', "notify_before_minutes" integer, CONSTRAINT "PK_38715fec7f634b72c6cf7ea4893" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('deal_update', 'review_request', 'mention', 'system')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'system', "link_url" character varying, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reminders" ADD CONSTRAINT "FK_de7f323194f85398815441bd3a6" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reminders" ADD CONSTRAINT "FK_586e0b8e419125be507701cee2a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_d93ddd7e1b890535ecafbb334ec" FOREIGN KEY ("tenant_id") REFERENCES "tenants_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_d93ddd7e1b890535ecafbb334ec"`);
        await queryRunner.query(`ALTER TABLE "reminders" DROP CONSTRAINT "FK_586e0b8e419125be507701cee2a"`);
        await queryRunner.query(`ALTER TABLE "reminders" DROP CONSTRAINT "FK_de7f323194f85398815441bd3a6"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "reminders"`);
        await queryRunner.query(`DROP TYPE "public"."reminders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."reminders_repeat_type_enum"`);
    }

}
