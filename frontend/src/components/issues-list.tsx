import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AuditIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

const SEVERITY_BADGE: Record<
  AuditIssue["severity"],
  { label: string; className: string; variant?: "destructive" | "outline" }
> = {
  critical: {
    label: "Critical",
    className: "",
    variant: "destructive",
  },
  warning: {
    label: "Warning",
    className:
      "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    variant: "outline",
  },
  info: {
    label: "Info",
    className:
      "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    variant: "outline",
  },
};

interface IssuesListProps {
  issues: AuditIssue[];
}

export function IssuesList({ issues }: IssuesListProps) {
  const sorted = [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <Card className="border-border bg-card ring-border">
      <CardHeader>
        <CardTitle>Issues ({sorted.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-green-500">
            No issues — all rubric checks passed.
          </p>
        ) : (
          sorted.map((issue, index) => {
            const badge = SEVERITY_BADGE[issue.severity];
            return (
              <div
                key={`${issue.check}-${index}`}
                className="rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge
                    variant={badge.variant}
                    className={cn(badge.className)}
                  >
                    {badge.label}
                  </Badge>
                </div>
                <p className="text-sm">{issue.message}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {issue.fix}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
