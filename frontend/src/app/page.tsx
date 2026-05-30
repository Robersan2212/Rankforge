"use client";

import { useCallback, useState } from "react";
import { AiSummaryCard } from "@/components/ai-summary-card";
import { AuditInput } from "@/components/audit-input";
import { AuditSkeleton } from "@/components/audit-skeleton";
import { HeadingTree } from "@/components/heading-tree";
import { IssuesList } from "@/components/issues-list";
import { MetaTagsCard } from "@/components/meta-tags-card";
import { ScoreGauge } from "@/components/score-gauge";
import { StatsRow } from "@/components/stats-row";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { AuditApiError, isValidAuditUrl, runAudit } from "@/lib/api";
import type { AuditResult } from "@/lib/types";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

  const handleAudit = useCallback(async () => {
    setError(null);

    if (!isValidAuditUrl(url)) {
      setError("Please enter a valid http or https URL.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await runAudit(url.trim());
      setResult(data);
    } catch (err) {
      const message =
        err instanceof AuditApiError
          ? err.message
          : "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const showHero = !result && !loading;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <p className="font-mono text-xs tracking-[0.2em] text-primary sm:text-sm">
            ◆ RANKFORGE
          </p>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 text-center">
          <h1 className="font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
            SEO Page Auditor
          </h1>
          {showHero && (
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
              Paste any URL to get a full SEO audit with scoring, heading
              analysis, and AI-powered recommendations.
            </p>
          )}
        </div>

        <section className="mb-8">
          <AuditInput
            url={url}
            onUrlChange={setUrl}
            onSubmit={handleAudit}
            loading={loading}
          />
        </section>

        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertTitle>Audit failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && <AuditSkeleton />}

        {result && !loading && (
          <div className="animate-fade-in-up space-y-8">
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 pt-6">
                <ScoreGauge score={result.seo_score} />
                <p className="max-w-full truncate px-4 font-mono text-sm text-muted-foreground">
                  {result.url}
                </p>
                <CardDescription className="text-xs">
                  Crawled {new Date(result.crawled_at).toLocaleString()}
                </CardDescription>
              </CardContent>
            </Card>

            <StatsRow
              wordCount={result.word_count}
              links={result.links}
              images={result.images}
            />

            <MetaTagsCard meta={result.meta} />
            <HeadingTree headings={result.headings} />
            <IssuesList issues={result.issues} />
            <AiSummaryCard summary={result.ai_summary} />
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Rankforge Prototype · FR-02 SEO Page Auditor
      </footer>
    </div>
  );
}
