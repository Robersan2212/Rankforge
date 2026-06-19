import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { cn } from "@/lib/utils";

interface SeoChartPanelProps {
  title?: string;
  description?: string;
  className?: string;
}

export function SeoChartPanel({
  title = "SEO performance",
  description = "SEO performance trends will appear here (FR-02).",
  className,
}: SeoChartPanelProps) {
  return (
    <div className={cn("rounded-2xl ring-1 ring-border", className)}>
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <div className="p-5">
        <EmptyState
          icon={LineChart}
          title="No performance data"
          description={description}
          className="border-none bg-transparent py-10"
        />
      </div>
    </div>
  );
}
