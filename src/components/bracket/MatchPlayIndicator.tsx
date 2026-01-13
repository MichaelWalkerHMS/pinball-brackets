interface MatchPlayIndicatorProps {
  isLinked: boolean;
}

export default function MatchPlayIndicator({ isLinked }: MatchPlayIndicatorProps) {
  const tooltipText = isLinked
    ? "This tournament is on Match Play, so results will be synced automatically!"
    : "This tournament is not linked to Match Play. Results must be entered manually.";

  return (
    <div className="relative group flex items-center gap-1.5">
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
        {isLinked ? "MatchPlay Linked" : "MatchPlay Not Linked"}
      </span>
      {/* Tooltip */}
      <div className="absolute left-0 top-full mt-1.5 hidden group-hover:block z-10 px-2 py-1 text-xs bg-[rgb(var(--color-bg-primary))] border border-[rgb(var(--color-border-primary))] rounded shadow-lg max-w-[200px] whitespace-normal">
        {tooltipText}
      </div>
    </div>
  );
}
