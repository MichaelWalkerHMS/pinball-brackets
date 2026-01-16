interface MatchPlayIndicatorProps {
  isLinked: boolean;
  matchPlayId?: string | null;
}

export default function MatchPlayIndicator({ isLinked, matchPlayId }: MatchPlayIndicatorProps) {
  const tooltipText = isLinked
    ? "This tournament is on Match Play, so results will be synced automatically!"
    : "Results will be entered manually by an admin and may not be accessible until after the tournament is complete.";

  const matchPlayUrl = matchPlayId
    ? `https://app.matchplay.events/tournaments/${matchPlayId}`
    : undefined;

  const content = (
    <>
      {/* Indicator circle */}
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${
          isLinked
            ? "bg-[rgb(var(--color-success-icon))]"
            : "bg-[rgb(var(--color-text-muted))]"
        }`}
        aria-hidden="true"
      />
      {/* Label text */}
      <span
        className={`text-xs whitespace-nowrap ${
          isLinked
            ? "text-[rgb(var(--color-success-text))]"
            : "text-[rgb(var(--color-text-muted))]"
        }`}
      >
        {isLinked ? "Match Play Synced" : "Match Play Not Synced"}
      </span>
      {/* Tooltip */}
      <div className="absolute left-0 top-full mt-1.5 hidden group-hover:block z-10 px-2 py-1 text-xs bg-[rgb(var(--color-bg-primary))] border border-[rgb(var(--color-border-primary))] rounded shadow-lg max-w-[200px] whitespace-normal">
        {tooltipText}
      </div>
    </>
  );

  if (matchPlayUrl) {
    return (
      <a
        href={matchPlayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex items-center gap-1.5 hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="relative group flex items-center gap-1.5">
      {content}
    </div>
  );
}
