-- CreateTable
CREATE TABLE "UrgeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gaveIn" BOOLEAN NOT NULL DEFAULT false,
    "intensity" INTEGER,
    "trigger" TEXT,
    "note" TEXT,
    CONSTRAINT "UrgeLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UrgeLog_habitId_idx" ON "UrgeLog"("habitId");
