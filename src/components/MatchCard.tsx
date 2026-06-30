import { Match, Prediction } from "@/lib/types";
import { getTeamRank } from "@/lib/rankings";
import { formatMatchDate } from "@/lib/dateUtils";
import TeamFlag from "./TeamFlag";
import PredictionDisplay from "./PredictionDisplay";
import ScoreDisplay from "./ScoreDisplay";

function RankBadge({ team }: { team: string }) {
  const rank = getTeamRank(team);
  if (!rank) return null;

  return (
    <span className="rounded bg-[#001a13] px-1 py-0.5 text-[9px] font-semibold text-white">
      #{rank}
    </span>
  );
}

function pointsBadgeClasses(points?: number): string {
  if (points === undefined) return "bg-gray-600 text-gray-200";
  if (points === 3) return "bg-[#00A651] text-white";
  return "bg-red-600 text-white";
}

function pointsBadgeLabel(points?: number): string {
  if (points === undefined) return "⏳ Pending";
  if (points === 3) return "✅ 3pts";
  return "❌ 0pts";
}

type LiveStatus = "upcoming" | "live" | "halftime" | "finished";

interface MatchCardProps {
  match: Match;
  onPredict?: () => void;
  userPrediction?: Prediction;
  liveStatus?: LiveStatus;
  liveHome?: number | null;
  liveAway?: number | null;
  displayClock?: string;
}

export default function MatchCard({
  match,
  onPredict,
  userPrediction,
  liveStatus,
  liveHome,
  liveAway,
  displayClock,
}: MatchCardProps) {
  const hasResult = match.actualHome !== undefined && match.actualAway !== undefined;
  const hasLiveScore = liveHome !== null && liveHome !== undefined && liveAway !== null && liveAway !== undefined;

  return (
    <div className="rounded-lg border border-[#00573F] border-l-4 border-l-[#00A651] bg-[#002820] p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-[#00A651] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {match.stage === "Group" ? `Group ${match.group}` : match.stage}
        </span>
        <div className="flex items-center gap-2">
          {liveStatus === "live" && (
            <span className="animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
              ● LIVE
            </span>
          )}
          {liveStatus === "halftime" && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
              HT
            </span>
          )}
          <span className="text-xs text-white">{formatMatchDate(match.matchDate)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center justify-end gap-2 text-right">
          {match.homeTeam ? (
            <>
              <span className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide text-white">
                {match.homeTeam}
              </span>
              <RankBadge team={match.homeTeam} />
              <TeamFlag team={match.homeTeam} size={20} />
            </>
          ) : (
            <span className="text-sm italic text-[#94a3b8]">{match.homeTeamPlaceholder ?? "TBD"}</span>
          )}
        </div>
        <span className="font-[family-name:var(--font-heading)] text-xl text-[#00A651]">vs</span>
        <div className="flex flex-1 items-center gap-2">
          {match.awayTeam ? (
            <>
              <TeamFlag team={match.awayTeam} size={20} />
              <span className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide text-white">
                {match.awayTeam}
              </span>
              <RankBadge team={match.awayTeam} />
            </>
          ) : (
            <span className="text-sm italic text-[#94a3b8]">{match.awayTeamPlaceholder ?? "TBD"}</span>
          )}
        </div>
      </div>

      {(liveStatus === "live" || liveStatus === "halftime") && hasLiveScore && (
        <div className="mt-3 text-center">
          <div className="text-3xl font-bold text-white">
            {liveHome} – {liveAway}
          </div>
          {liveStatus === "live" && displayClock && (
            <div className="mt-1 text-xs text-[#94a3b8]">{displayClock}</div>
          )}
        </div>
      )}

      {liveStatus === "finished" && match.actualHome === undefined && hasLiveScore && (
        <div className="mt-3 text-center font-[family-name:var(--font-heading)] text-lg tracking-wide text-[#FFD700]">
          FT {liveHome} – {liveAway}
        </div>
      )}

      {hasResult && (
        <div className="mt-3 text-center font-[family-name:var(--font-heading)] text-lg tracking-wide">
          <span className="text-[#FFD700]">RESULT: </span>
          <ScoreDisplay match={match} className="text-white" />
        </div>
      )}

      {userPrediction && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white">
          <PredictionDisplay prediction={userPrediction.prediction} match={match} size={20} />
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pointsBadgeClasses(userPrediction.points)}`}>
            {pointsBadgeLabel(userPrediction.points)}
          </span>
        </div>
      )}

      {onPredict && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onPredict}
            className="rounded-md bg-[#00A651] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#00A651]/80"
          >
            Predict
          </button>
        </div>
      )}
    </div>
  );
}
