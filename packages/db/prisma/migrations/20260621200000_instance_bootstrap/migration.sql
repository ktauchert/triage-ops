-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "setup_complete" BOOLEAN NOT NULL DEFAULT false,
    "setup_completed_at" TIMESTAMP(3),
    "setup_completed_by_user_id" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioned_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "invited_by_user_id" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "user_id" TEXT,

    CONSTRAINT "provisioned_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provisioned_users_email_key" ON "provisioned_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "provisioned_users_user_id_key" ON "provisioned_users"("user_id");

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_setup_completed_by_user_id_fkey" FOREIGN KEY ("setup_completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioned_users" ADD CONSTRAINT "provisioned_users_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioned_users" ADD CONSTRAINT "provisioned_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default settings row
INSERT INTO "app_settings" ("id", "setup_complete")
VALUES ('default', false);

-- Existing installs: treat as already set up when users exist
UPDATE "app_settings"
SET
    "setup_complete" = true,
    "setup_completed_at" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users" LIMIT 1);
