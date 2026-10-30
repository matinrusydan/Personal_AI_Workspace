-- AlterTable connected_accounts
ALTER TABLE "connected_accounts" ADD COLUMN "display_name" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "username" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'CONNECTED',
ADD COLUMN "last_verified_at" TIMESTAMP(3),
ADD COLUMN "last_tested_at" TIMESTAMP(3),
ADD COLUMN "last_error_code" TEXT,
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "access_token_ciphertext" TEXT,
ALTER COLUMN "refresh_token_ciphertext" DROP NOT NULL,
ADD COLUMN "telegram_bot_id" TEXT,
ADD COLUMN "telegram_user_id" TEXT,
ADD COLUMN "telegram_chat_id" TEXT;

-- CreateIndex
CREATE INDEX "connected_accounts_owner_id_provider_idx" ON "connected_accounts"("owner_id", "provider");

-- CreateTable oauth_transactions
CREATE TABLE "oauth_transactions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "state_hash" TEXT NOT NULL,
    "binding_hash" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_ciphertext" TEXT,
    "verifier_ciphertext" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "oauth_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable telegram_pairing_challenges
CREATE TABLE "telegram_pairing_challenges" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "bot_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "manual_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "telegram_pairing_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable telegram_bot_states
CREATE TABLE "telegram_bot_states" (
    "bot_id" TEXT NOT NULL,
    "next_offset" BIGINT NOT NULL DEFAULT 0,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_states_pkey" PRIMARY KEY ("bot_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_transactions_provider_state_hash_key" ON "oauth_transactions"("provider", "state_hash");
CREATE INDEX "oauth_transactions_owner_id_status_idx" ON "oauth_transactions"("owner_id", "status");
CREATE INDEX "oauth_transactions_expires_at_idx" ON "oauth_transactions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_pairing_challenges_token_hash_key" ON "telegram_pairing_challenges"("token_hash");
CREATE INDEX "telegram_pairing_challenges_owner_id_status_idx" ON "telegram_pairing_challenges"("owner_id", "status");
CREATE INDEX "telegram_pairing_challenges_expires_at_idx" ON "telegram_pairing_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_pairing_challenges" ADD CONSTRAINT "telegram_pairing_challenges_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_pairing_challenges" ADD CONSTRAINT "telegram_pairing_challenges_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
