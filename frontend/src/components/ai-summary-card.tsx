import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AiSummaryCardProps {
  summary: string;
}

export function AiSummaryCard({ summary }: AiSummaryCardProps) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 ring-1 ring-primary/20">
      <CardHeader>
        <CardTitle className="text-primary">AI Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="leading-relaxed text-foreground/90">{summary}</p>
      </CardContent>
    </Card>
  );
}
