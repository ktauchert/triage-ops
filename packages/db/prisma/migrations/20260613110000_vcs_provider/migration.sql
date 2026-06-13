-- CreateEnum
CREATE TYPE "VcsProvider" AS ENUM ('GITLAB', 'GITHUB');

-- RenameTable
ALTER TABLE "gitlab_connections" RENAME TO "vcs_connections";

-- AlterTable
ALTER TABLE "vcs_connections" ADD COLUMN "provider" "VcsProvider" NOT NULL DEFAULT 'GITLAB';

ALTER TABLE "projects" RENAME COLUMN "gitlabProjectId" TO "externalProjectId";
ALTER TABLE "projects" ALTER COLUMN "externalProjectId" DROP NOT NULL;

-- DropIndex
DROP INDEX "projects_connectionId_gitlabProjectId_key";

-- CreateIndex
CREATE UNIQUE INDEX "projects_connectionId_pathWithNamespace_key" ON "projects"("connectionId", "pathWithNamespace");
