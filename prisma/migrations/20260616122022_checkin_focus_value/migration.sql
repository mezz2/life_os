-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "energy" INTEGER NOT NULL,
    "mood" INTEGER NOT NULL,
    "sleepHours" REAL,
    "note" TEXT,
    "focusValueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyCheckin_focusValueId_fkey" FOREIGN KEY ("focusValueId") REFERENCES "Value" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyCheckin" ("createdAt", "date", "energy", "id", "mood", "note", "sleepHours") SELECT "createdAt", "date", "energy", "id", "mood", "note", "sleepHours" FROM "DailyCheckin";
DROP TABLE "DailyCheckin";
ALTER TABLE "new_DailyCheckin" RENAME TO "DailyCheckin";
CREATE UNIQUE INDEX "DailyCheckin_date_key" ON "DailyCheckin"("date");
CREATE INDEX "DailyCheckin_date_idx" ON "DailyCheckin"("date");
CREATE INDEX "DailyCheckin_focusValueId_idx" ON "DailyCheckin"("focusValueId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
