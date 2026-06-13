"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders children at document.body so fixed-position overlays center on the
// viewport, unaffected by transformed ancestors (e.g. page-transition wrappers).
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
