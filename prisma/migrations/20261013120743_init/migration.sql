-- CreateTable
CREATE TABLE "Evidence" (
    "investigationId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "service" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "waveNumber" INTEGER NOT NULL,
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("investigationId","id")
);

-- CreateTable
CREATE TABLE "InvestigationRevision" (
    "id" SERIAL NOT NULL,
    "investigationId" TEXT NOT NULL,
    "waveNumber" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL,
    "clock" TIMESTAMP(3) NOT NULL,
    "delta" JSONB NOT NULL,
    "state" JSONB NOT NULL,
    "rejectedClaims" JSONB NOT NULL,
    "trace" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_investigationId_waveNumber_idx" ON "Evidence"("investigationId", "waveNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationRevision_investigationId_waveNumber_key" ON "InvestigationRevision"("investigationId", "waveNumber");
