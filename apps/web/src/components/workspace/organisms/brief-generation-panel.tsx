"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { BriefDeleteButton } from "@/components/workspace/molecules/brief-delete-button";
import { ListRow } from "@/components/workspace/molecules/list-row";
import { isGeneratedBriefContent } from "@/lib/brief-types";
import { SECTION_CONFIG } from "@/lib/workspace";
import type { Audit, Brief, CompetitorAnalysis } from "@/lib/types";

interface BriefGenerationPanelProps {
  projectId: string;
  briefs: Brief[];
  audits: Audit[];
  competitorAnalyses: CompetitorAnalysis[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function readyAnalyses(analyses: CompetitorAnalysis[]) {
  return analyses.filter((a) => a.status === "completed" || a.status === "partial");
}

export function BriefGenerationPanel({
  projectId,
  briefs,
  audits,
  competitorAnalyses,
}: BriefGenerationPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const config = SECTION_CONFIG.briefs;

  const [auditId, setAuditId] = useState(audits[0]?.id ?? "");
  const [analysisId, setAnalysisId] = useState(
    readyAnalyses(competitorAnalyses)[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const readyCompetitors = readyAnalyses(competitorAnalyses);
  const canGenerate = auditId.length > 0 && analysisId.length > 0;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/briefs/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: auditId,
          competitor_analysis_id: analysisId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        setError(
          typeof detail === "string"
            ? detail
            : `Brief generation failed (${res.status})`
        );
        return;
      }

      startTransition(() => {
        router.push(`/project/${projectId}/briefs/${data.id}`);
      });
    } catch {
      setError("Could not generate brief. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleGenerate}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="text-sm font-medium">Generate content brief</h2>
        <p className="text-sm text-muted-foreground">
          Synthesizes a page audit and competitor analysis into a structured
          brief with headings, keywords, and FAQs.
        </p>

        {audits.length === 0 || readyCompetitors.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {audits.length === 0
              ? "Run a page audit first."
              : "Complete a competitor analysis first."}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="brief-audit">Page audit</Label>
              <select
                id="brief-audit"
                value={auditId}
                onChange={(e) => setAuditId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {audits.map((audit) => (
                  <option key={audit.id} value={audit.id}>
                    {audit.url} · {formatDate(audit.created_at)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-competitor">Competitor analysis</Label>
              <select
                id="brief-competitor"
                value={analysisId}
                onChange={(e) => setAnalysisId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {readyCompetitors.map((analysis) => (
                  <option key={analysis.id} value={analysis.id}>
                    {analysis.keyword} · {analysis.status} ·{" "}
                    {formatDate(analysis.created_at)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || isPending || !canGenerate}
        >
          {loading ? "Generating brief…" : isPending ? "Loading…" : "Generate brief"}
        </Button>
      </form>

      {briefs.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">
              {config.label} ({briefs.length})
            </h2>
          </div>
          <div className="space-y-1 p-3">
            {briefs.map((brief) => {
              const content = isGeneratedBriefContent(brief.content)
                ? brief.content
                : null;
              const subtitle = content
                ? `${content.target_word_count} words · ${content.semantic_keywords.length} keywords · ${formatDate(brief.created_at)}`
                : formatDate(brief.created_at);

              return (
                <ListRow
                  key={brief.id}
                  title={brief.keyword}
                  subtitle={subtitle}
                  initials={config.label.slice(0, 2).toUpperCase()}
                  href={`/project/${projectId}/briefs/${brief.id}`}
                  trailing={
                    <BriefDeleteButton
                      projectId={projectId}
                      briefId={brief.id}
                    />
                  }
                />
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={config.icon}
          title="No briefs yet"
          description="Generate an AI brief from an audit and competitor analysis."
        />
      )}
    </div>
  );
}
