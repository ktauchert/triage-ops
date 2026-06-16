-- AlterTable
ALTER TABLE "vcs_connections" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
