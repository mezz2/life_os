-- CreateTable
CREATE TABLE "DailyCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "energy" INTEGER NOT NULL,
    "mood" INTEGER NOT NULL,
    "sleepHours" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckin_date_key" ON "DailyCheckin"("date");

-- CreateIndex
CREATE INDEX "DailyCheckin_date_idx" ON "DailyCheckin"("date");
