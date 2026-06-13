import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";
import { ThemeProvider } from "@/components/Theme";
import { SelectOnFocus } from "@/components/SelectOnFocus";

// Runs before any Next.js code (injected into <head>) so the saved theme is
// applied before paint — no flash of the wrong mode.
const themeScript = `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LifeOS — Finances",
  description: "Personal finance command centre",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ThemeProvider>
          <SelectOnFocus />
          <div className="md:flex min-h-screen">
            <aside
              className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r"
              style={{ background: "var(--color-surface)" }}
            >
              <Nav />
            </aside>
            <main className="flex-1 min-w-0 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
