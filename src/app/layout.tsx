import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import Link from "next/link";
import EmailGate from "@/components/EmailGate";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WC2026 Predictor",
  description: "Predict FIFA World Cup 2026 match results and climb the leaderboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#003B2B] text-white">
        <header className="sticky top-0 z-50 bg-[#002820] shadow-lg">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src="/citizens-logo.png"
                  alt="Citizens Bank"
                  style={{ height: "32px", filter: "brightness(0) invert(1)" }}
                />
                <span style={{ color: "#FFD700", fontFamily: "Bebas Neue", fontSize: "20px", letterSpacing: "2px" }}>
                  WORLD CUP PREDICTOR
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-6 font-[family-name:var(--font-body)] text-sm font-medium">
              <Link href="/" className="text-white transition hover:text-[#00A651]">
                Home
              </Link>
              <Link href="/predict" className="text-white transition hover:text-[#00A651]">
                Predict
              </Link>
              <Link href="/standings" className="text-white transition hover:text-[#00A651]">
                Standings
              </Link>
              <Link href="/bracket" className="text-white transition hover:text-[#00A651]">
                Bracket
              </Link>
              <Link href="/leaderboard" className="text-white transition hover:text-[#00A651]">
                Leaderboard
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 font-[family-name:var(--font-body)]">
          <EmailGate>{children}</EmailGate>
        </main>
      </body>
    </html>
  );
}
