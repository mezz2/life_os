-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subcategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "categoryId" TEXT NOT NULL,
    "valueId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subcategory_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "Value" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Subcategory" ("categoryId", "group", "id", "name", "sortOrder") SELECT "categoryId", "group", "id", "name", "sortOrder" FROM "Subcategory";
DROP TABLE "Subcategory";
ALTER TABLE "new_Subcategory" RENAME TO "Subcategory";
CREATE INDEX "Subcategory_categoryId_idx" ON "Subcategory"("categoryId");
CREATE INDEX "Subcategory_valueId_idx" ON "Subcategory"("valueId");
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
