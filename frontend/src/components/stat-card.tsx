import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <Card className="border-border bg-card p-0 ring-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="font-mono text-2xl font-semibold">{value}</p>
        {subtitle && (
          <CardDescription className="mt-1">{subtitle}</CardDescription>
        )}
      </CardContent>
    </Card>
  );
}
