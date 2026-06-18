-- CreateTable
CREATE TABLE "HabitStack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HabitStackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stackId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "HabitStackItem_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "HabitStack" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HabitStackItem_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HabitStackItem_stackId_idx" ON "HabitStackItem"("stackId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitStackItem_stackId_habitId_key" ON "HabitStackItem"("stackId", "habitId");
