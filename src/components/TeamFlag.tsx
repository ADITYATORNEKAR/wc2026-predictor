import { TEAM_FLAG_CODES, getFlagCdnWidth } from "@/lib/flags";

interface TeamFlagProps {
  team: string;
  size?: number; // px width, default 20
  className?: string;
}

export default function TeamFlag({ team, size = 20, className }: TeamFlagProps) {
  const code = TEAM_FLAG_CODES[team];
  if (!code) return null;

  return (
    <img
      src={`https://flagcdn.com/w${getFlagCdnWidth(size)}/${code}.png`}
      alt={`${team} flag`}
      width={size}
      height={Math.round(size * 0.75)}
      style={{ display: "inline-block", borderRadius: "2px", verticalAlign: "middle" }}
      className={className}
    />
  );
}
