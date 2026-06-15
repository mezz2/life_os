-- AlterTable
ALTER TABLE "Habit" ADD COLUMN "rewardBundle" TEXT;

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "url" TEXT,
    "note" TEXT,
    "valueId" TEXT,
    "goalId" TEXT,
    "raw" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reference_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "Value" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reference_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reference_valueId_idx" ON "Reference"("valueId");

-- CreateIndex
CREATE INDEX "Reference_goalId_idx" ON "Reference"("goalId");
