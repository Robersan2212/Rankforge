import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AuditHeading } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<
  AuditHeading["level"],
  { badge: string; indent: number }
> = {
  h1: { badge: "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300", indent: 0 },
  h2: { badge: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300", indent: 1 },
  h3: { badge: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-300", indent: 2 },
  h4: { badge: "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-300", indent: 3 },
  h5: { badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300", indent: 4 },
  h6: { badge: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-300", indent: 5 },
};

interface HeadingTreeProps {
  headings: AuditHeading[];
}

export function HeadingTree({ headings }: HeadingTreeProps) {
  return (
    <Card className="border-border bg-card ring-border">
      <CardHeader>
        <CardTitle>Heading Structure</CardTitle>
      </CardHeader>
      <CardContent>
        {headings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No headings found.</p>
        ) : (
          <ul className="space-y-2">
            {headings.map((heading, i) => {
              const style = LEVEL_STYLES[heading.level];
              return (
                <li
                  key={`${heading.level}-${i}-${heading.text.slice(0, 20)}`}
                  className="flex items-start gap-2"
                  style={{ paddingLeft: `${style.indent * 1.25}rem` }}
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-mono text-xs uppercase",
                      style.badge
                    )}
                  >
                    {heading.level}
                  </Badge>
                  <span className="text-sm leading-relaxed">{heading.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
