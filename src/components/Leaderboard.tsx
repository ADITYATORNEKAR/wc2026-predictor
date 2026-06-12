interface LeaderboardEntry {
  name: string;
  points: number;
  matchPoints?: number;
  specialPoints?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

function getRankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="rounded-lg border border-[#00573F] bg-[#002820] p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-center gap-2 border-b border-[#00A651] pb-3">
        <span className="text-3xl">🏆</span>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[#FFD700]">
          Leaderboard
        </h2>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-sm text-white">No predictions yet.</p>
      ) : (
        <ul>
          {entries.map((entry, index) => {
            const rank = index + 1;
            return (
              <li
                key={entry.name}
                className={`flex items-center justify-between py-2 px-2 ${
                  index % 2 === 0 ? "bg-[#003B2B]" : "bg-[#002820]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg font-semibold text-white">
                    {getRankDisplay(rank)}
                  </span>
                  <span className="font-medium text-white">{entry.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-[family-name:var(--font-heading)] text-lg tracking-wide text-[#FFD700]">
                    {entry.points} pts
                  </span>
                  {(entry.matchPoints !== undefined || entry.specialPoints !== undefined) && (
                    <div className="text-[10px] text-[#94a3b8]">
                      {entry.matchPoints ?? 0} match + {entry.specialPoints ?? 0} bonus = {entry.points} pts
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
