import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AuditMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MetaTagsCardProps {
  meta: AuditMeta;
}

function lengthColor(
  length: number,
  min: number,
  max: number
): string {
  if (length >= min && length <= max) return "text-green-500";
  if (length === 0) return "text-red-500";
  return "text-yellow-500";
}

export function MetaTagsCard({ meta }: MetaTagsCardProps) {
  return (
    <Card className="border-border bg-card ring-border">
      <CardHeader>
        <CardTitle>Meta Tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Title</span>
            <span
              className={cn(
                "font-mono text-xs",
                lengthColor(meta.title_length, 50, 60)
              )}
            >
              {meta.title_length} chars (50–60 optimal)
            </span>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm text-foreground">
            {meta.title || "(empty)"}
          </pre>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Description</span>
            <span
              className={cn(
                "font-mono text-xs",
                lengthColor(meta.description_length, 150, 160)
              )}
            >
              {meta.description_length} chars (150–160 optimal)
            </span>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm text-foreground whitespace-pre-wrap">
            {meta.description || "(empty)"}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
