-- AlterTable
ALTER TABLE "Post" ADD COLUMN "slug" TEXT;

-- Backfill existing rows (stable, unique)
UPDATE "Post" SET "slug" = 'post-' || "id"::text WHERE "slug" IS NULL;

CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

ALTER TABLE "Post" ALTER COLUMN "slug" SET NOT NULL;
