-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "shuffleBatch" TEXT;

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "rigidity" TEXT NOT NULL DEFAULT 'flexible',
    "durationMin" INTEGER NOT NULL,
    "minChunkMin" INTEGER NOT NULL DEFAULT 30,
    "energy" TEXT NOT NULL DEFAULT 'any',
    "days" TEXT,
    "startMin" INTEGER NOT NULL DEFAULT 360,
    "endMin" INTEGER NOT NULL DEFAULT 1320,
    "theme" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "habitId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeBlock_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TimeBlock_habitId_idx" ON "TimeBlock"("habitId");

-- CreateIndex
CREATE INDEX "CalendarEvent_shuffleBatch_idx" ON "CalendarEvent"("shuffleBatch");
