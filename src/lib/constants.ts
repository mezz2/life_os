// Shared constants safe to import from both client and server.

export const BUCKET_ORDER = [
  "Emergency Fund",
  "Savings",
  "US Equities",
  "AUS Equities",
  "Global Equities",
  "Crypto",
  "Super",
];

export const BUCKET_COLORS: Record<string, string> = {
  "Emergency Fund": "#34d399",
  Savings: "#22d3ee",
  "US Equities": "#818cf8",
  "AUS Equities": "#f472b6",
  "Global Equities": "#fbbf24",
  Crypto: "#fb923c",
  Super: "#a78bfa",
};

// Palette for spending-category trends (assigned by index, stable order).
export const CATEGORY_COLORS = [
  "#34d399",
  "#22d3ee",
  "#818cf8",
  "#f472b6",
  "#fbbf24",
  "#fb923c",
  "#a78bfa",
  "#60a5fa",
];
