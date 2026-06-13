"use client";

import { usePathname } from "next/navigation";

// Re-keys on navigation so the page content replays a subtle fade-up.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="anim-fade-up">
      {children}
    </div>
  );
}
