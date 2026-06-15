-- CreateTable
CREATE TABLE "Value" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "term" TEXT NOT NULL DEFAULT 'short',
    "kind" TEXT NOT NULL DEFAULT 'financial',
    "targetAmount" REAL,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "targetDate" DATETIME,
    "linkedBucket" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueId" TEXT,
    CONSTRAINT "Goal_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "Value" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Goal" ("createdAt", "currentAmount", "id", "linkedBucket", "name", "notes", "sortOrder", "targetAmount", "targetDate", "term") SELECT "createdAt", "currentAmount", "id", "linkedBucket", "name", "notes", "sortOrder", "targetAmount", "targetDate", "term" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";
CREATE INDEX "Goal_valueId_idx" ON "Goal"("valueId");
CREATE TABLE "new_Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "identityStatement" TEXT,
    "type" TEXT NOT NULL DEFAULT 'build',
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "targetCount" INTEGER,
    "weekdays" TEXT,
    "cue" TEXT,
    "craving" TEXT,
    "response" TEXT,
    "reward" TEXT,
    "twoMinVersion" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalId" TEXT,
    "valueId" TEXT,
    CONSTRAINT "Habit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Habit_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "Value" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("archived", "cadence", "craving", "createdAt", "cue", "id", "identityStatement", "name", "response", "reward", "sortOrder", "targetCount", "twoMinVersion", "type", "weekdays") SELECT "archived", "cadence", "craving", "createdAt", "cue", "id", "identityStatement", "name", "response", "reward", "sortOrder", "targetCount", "twoMinVersion", "type", "weekdays" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE INDEX "Habit_goalId_idx" ON "Habit"("goalId");
CREATE INDEX "Habit_valueId_idx" ON "Habit"("valueId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Value_name_key" ON "Value"("name");
