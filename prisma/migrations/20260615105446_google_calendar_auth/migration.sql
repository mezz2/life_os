-- CreateTable
CREATE TABLE "GoogleCalendarAuth" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiry" DATETIME,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "email" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
