"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

interface ScoreGaugeProps {
  score: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 50) return "Needs Work";
  return "Poor";
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const { resolvedTheme } = useTheme();
  const [animated, setAnimated] = useState(0);
  const trackFill =
    resolvedTheme === "light" ? "hsl(240 6% 90%)" : "hsl(240 4% 16%)";

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    let frame: number;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(score * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = scoreColor(animated);
  const data = [{ name: "score", value: animated, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[180px] w-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="85%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={14}
          >
            <RadialBar
              background={{ fill: trackFill }}
              dataKey="value"
              cornerRadius={8}
              max={100}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span
            className="font-mono text-5xl font-bold tabular-nums"
            style={{ color }}
          >
            {animated}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p
        className="mt-1 text-lg font-medium"
        style={{ color }}
      >
        {scoreLabel(animated)}
      </p>
    </div>
  );
}
