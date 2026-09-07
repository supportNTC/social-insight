-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('facebook', 'instagram', 'tiktok');

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('mock', 'facebook', 'instagram', 'tiktok');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('video', 'image', 'reel', 'carousel');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'success', 'partial', 'failed');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_ref" TEXT,
    "token_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "caption" TEXT,
    "permalink" TEXT,
    "thumbnail_url" TEXT,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_seconds" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_metrics_daily" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "views" INTEGER NOT NULL,
    "reach" INTEGER,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "saves" INTEGER,
    "avg_watch_seconds" DOUBLE PRECISION,
    "completion_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_metrics_daily" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "followers" INTEGER NOT NULL,
    "follower_delta" INTEGER,
    "views" INTEGER,
    "reach" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_weights" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "like_weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "comment_weight" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "share_weight" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "save_weight" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "metric_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_payloads" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider" "ProviderKind" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "sync_run_id" TEXT,

    CONSTRAINT "raw_payloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider" "ProviderKind" NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'running',
    "items_synced" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_is_active_idx" ON "accounts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_platform_external_id_key" ON "accounts"("platform", "external_id");

-- CreateIndex
CREATE INDEX "contents_account_id_published_at_idx" ON "contents"("account_id", "published_at");

-- CreateIndex
CREATE INDEX "contents_published_at_idx" ON "contents"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "contents_platform_external_id_key" ON "contents"("platform", "external_id");

-- CreateIndex
CREATE INDEX "content_metrics_daily_snapshot_date_idx" ON "content_metrics_daily"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "content_metrics_daily_content_id_snapshot_date_key" ON "content_metrics_daily"("content_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "account_metrics_daily_snapshot_date_idx" ON "account_metrics_daily"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "account_metrics_daily_account_id_snapshot_date_key" ON "account_metrics_daily"("account_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "raw_payloads_account_id_fetched_at_idx" ON "raw_payloads"("account_id", "fetched_at");

-- CreateIndex
CREATE INDEX "raw_payloads_provider_endpoint_fetched_at_idx" ON "raw_payloads"("provider", "endpoint", "fetched_at");

-- CreateIndex
CREATE INDEX "sync_runs_account_id_started_at_idx" ON "sync_runs"("account_id", "started_at");

-- CreateIndex
CREATE INDEX "sync_runs_status_started_at_idx" ON "sync_runs"("status", "started_at");

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_metrics_daily" ADD CONSTRAINT "content_metrics_daily_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_metrics_daily" ADD CONSTRAINT "account_metrics_daily_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- metric_weights is a singleton: exactly one row, always id = 1.
-- Prisma's schema language cannot express a CHECK constraint, so it is added here.
ALTER TABLE "metric_weights" ADD CONSTRAINT "metric_weights_singleton" CHECK ("id" = 1);
