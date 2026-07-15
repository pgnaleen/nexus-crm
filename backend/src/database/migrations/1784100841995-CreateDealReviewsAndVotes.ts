import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDealReviewsAndVotes1784100841995 implements MigrationInterface {
    name = 'CreateDealReviewsAndVotes1784100841995'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deal_reviews_review_type_enum" AS ENUM('legal', 'pricing', 'technical', 'executive', 'compliance')`);
        await queryRunner.query(`CREATE TYPE "public"."deal_reviews_decision_enum" AS ENUM('approved', 'rejected', 'pending')`);
        await queryRunner.query(`CREATE TABLE "deal_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "updated_by" uuid, "deleted_at" TIMESTAMP, "deal_id" uuid NOT NULL, "review_type" "public"."deal_reviews_review_type_enum" NOT NULL, "decision" "public"."deal_reviews_decision_enum" NOT NULL DEFAULT 'pending', "overall_comment" text, "decided_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3dc23b9a3035ae7999e053455bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."deal_review_votes_vote_enum" AS ENUM('approve', 'reject', 'abstain')`);
        await queryRunner.query(`CREATE TABLE "deal_review_votes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "review_id" uuid NOT NULL, "reviewer_id" uuid NOT NULL, "vote" "public"."deal_review_votes_vote_enum" NOT NULL, "comment" text, "voted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a54aa94babf14b0c3d9008d3f8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "deal_reviews" ADD CONSTRAINT "FK_578e490e2a15475c18974786cf1" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_review_votes" ADD CONSTRAINT "FK_3e139a1d01954f6545f2b072b80" FOREIGN KEY ("review_id") REFERENCES "deal_reviews"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "deal_review_votes" ADD CONSTRAINT "FK_a71d6b1d453008268137457ac27" FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "deal_review_votes" DROP CONSTRAINT "FK_a71d6b1d453008268137457ac27"`);
        await queryRunner.query(`ALTER TABLE "deal_review_votes" DROP CONSTRAINT "FK_3e139a1d01954f6545f2b072b80"`);
        await queryRunner.query(`ALTER TABLE "deal_reviews" DROP CONSTRAINT "FK_578e490e2a15475c18974786cf1"`);
        await queryRunner.query(`DROP TABLE "deal_review_votes"`);
        await queryRunner.query(`DROP TYPE "public"."deal_review_votes_vote_enum"`);
        await queryRunner.query(`DROP TABLE "deal_reviews"`);
        await queryRunner.query(`DROP TYPE "public"."deal_reviews_decision_enum"`);
        await queryRunner.query(`DROP TYPE "public"."deal_reviews_review_type_enum"`);
    }

}
