import Link from "next/link";
import LiveMatchGrid from "@/components/LiveMatchGrid";
import TopLeaderboard from "@/components/TopLeaderboard";
import { MATCHES } from "@/lib/matches";

export default function Home() {
  return (
    <div className="bg-[#003B2B]">
      <section className="bg-gradient-to-b from-[#002820] to-[#003B2B]">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-5xl tracking-wide text-[#FFD700] sm:text-7xl">
            FIFA WORLD CUP 2026 PREDICTOR
          </h1>
          <p className="mt-3 text-lg text-white">USA · Canada · Mexico</p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/predict"
              className="rounded-md bg-[#00A651] px-6 py-3 font-semibold text-white transition hover:bg-[#00A651]/80"
            >
              Make Predictions
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-md border border-white bg-transparent px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#002820] px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#00A651]">
            Top Predictors
          </h2>
          <TopLeaderboard />
        </div>
      </section>

      <section className="bg-[#002820] px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#00A651]">
            Matches
          </h2>
          <LiveMatchGrid initialMatches={MATCHES} />
          <p className="mt-4 text-center text-xs text-[#94a3b8]">
            ⚡ Live scores powered by ESPN
          </p>
        </div>
      </section>
    </div>
  );
}
