-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('weighted_engagement', 'followers', 'course_conversions');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "platform" "Platform",
    "month" DATE NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_conversion_entries" (
    "id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "platform" "Platform",
    "count" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "course_conversion_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_month_idx" ON "goals"("month");

-- CreateIndex
CREATE UNIQUE INDEX "goals_metric_platform_month_key" ON "goals"("metric", "platform", "month");

-- CreateIndex
CREATE INDEX "course_conversion_entries_entry_date_idx" ON "course_conversion_entries"("entry_date");
