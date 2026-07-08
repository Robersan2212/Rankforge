interface ScoreBarProps {
  score: number;
  max?: number;
}

export function ScoreBar({ score, max = 100 }: ScoreBarProps) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
        {score}/{max}
      </span>
    </div>
  );
}
