import { Match, Prediction } from "@/lib/types";

const FLAG_MAP: Record<string, string> = {
  'Mexico': '🇲🇽',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Czechia': '🇨🇿',
  'Canada': '🇨🇦',
  'Bosnia and Herzegovina': '🇧🇦',
  'USA': '🇺🇸',
  'Paraguay': '🇵🇾',
  'Qatar': '🇶🇦',
  'Switzerland': '🇨🇭',
  'Brazil': '🇧🇷',
  'Morocco': '🇲🇦',
  'Haiti': '🇭🇹',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Australia': '🇦🇺',
  'Türkiye': '🇹🇷',
  'Germany': '🇩🇪',
  'Curaçao': '🇨🇼',
  'Netherlands': '🇳🇱',
  'Japan': '🇯🇵',
  'Ivory Coast': '🇨🇮',
  'Ecuador': '🇪🇨',
  'Sweden': '🇸🇪',
  'Tunisia': '🇹🇳',
  'Spain': '🇪🇸',
  'Cabo Verde': '🇨🇻',
  'Belgium': '🇧🇪',
  'Egypt': '🇪🇬',
  'Saudi Arabia': '🇸🇦',
  'Uruguay': '🇺🇾',
  'Iran': '🇮🇷',
  'New Zealand': '🇳🇿',
  'France': '🇫🇷',
  'Senegal': '🇸🇳',
  'Iraq': '🇮🇶',
  'Norway': '🇳🇴',
  'Argentina': '🇦🇷',
  'Algeria': '🇩🇿',
  'Austria': '🇦🇹',
  'Jordan': '🇯🇴',
  'Portugal': '🇵🇹',
  'DR Congo': '🇨🇩',
  'Uzbekistan': '🇺🇿',
  'Colombia': '🇨🇴',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Croatia': '🇭🇷',
  'Ghana': '🇬🇭',
  'Panama': '🇵🇦',
};

function getFlag(team: string): string {
  return FLAG_MAP[team] ?? "🏳️";
}

function formatMatchDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function pointsBadgeClasses(points?: number): string {
  if (points === undefined) return "bg-gray-600 text-gray-200";
  if (points === 3) return "bg-[#00A651] text-white";
  if (points === 1) return "bg-[#FFD700] text-black";
  return "bg-red-600 text-white";
}

function pointsBadgeLabel(points?: number): string {
  if (points === undefined) return "Pending";
  return `${points} pt${points === 1 ? "" : "s"}`;
}

interface MatchCardProps {
  match: Match;
  onPredict?: () => void;
  userPrediction?: Prediction;
}

export default function MatchCard({ match, onPredict, userPrediction }: MatchCardProps) {
  const hasResult = match.actualHome !== undefined && match.actualAway !== undefined;

  return (
    <div className="rounded-lg border border-[#00573F] border-l-4 border-l-[#00A651] bg-[#002820] p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-[#00A651] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {match.stage === "Group" ? `Group ${match.group}` : match.stage}
        </span>
        <span className="text-xs text-white">{formatMatchDate(match.matchDate)}</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center justify-end gap-2 text-right">
          <span className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide text-white">
            {match.homeTeam}
          </span>
          <span className="text-2xl">{getFlag(match.homeTeam)}</span>
        </div>
        <span className="font-[family-name:var(--font-heading)] text-xl text-[#00A651]">vs</span>
        <div className="flex flex-1 items-center gap-2">
          <span className="text-2xl">{getFlag(match.awayTeam)}</span>
          <span className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide text-white">
            {match.awayTeam}
          </span>
        </div>
      </div>

      {hasResult && (
        <div className="mt-3 text-center font-[family-name:var(--font-heading)] text-lg tracking-wide text-[#FFD700]">
          RESULT: {match.actualHome} - {match.actualAway}
        </div>
      )}

      {userPrediction && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white">
          <span>
            Your pick: {userPrediction.predictedHome} - {userPrediction.predictedAway}
          </span>
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
