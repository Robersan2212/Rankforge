import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricVariant = "lavender" | "blue" | "default";

interface MetricCardProps {
  label: string;
  value: number | string;
  delta?: string;
  icon?: LucideIcon;
  variant?: MetricVariant;
  className?: string;
}

const variantStyles: Record<MetricVariant, string> = {
  lavender: "bg-metric-lavender",
  blue: "bg-metric-blue",
  default: "bg-card ring-1 ring-border",
};

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  variant = "default",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl p-5",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {delta && (
          <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
        )}
      </div>
    </div>
  );
}
