"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KeywordClusterJob } from "@/lib/types";

interface KeywordClusterPanelProps {
  projectId: string;
}

export function KeywordClusterPanel({ projectId }: KeywordClusterPanelProps) {
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<KeywordClusterJob | null>(null);
  const [, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function pollUntilDone(jobId: string) {
    const maxAttempts = 120;
    let attempts = 0;

    return new Promise<KeywordClusterJob>((resolve, reject) => {
      pollRef.current = setInterval(async () => {
        attempts += 1;
        if (attempts > maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          reject(new Error("Clustering timed out while waiting for results"));
          return;
        }

        try {
          const res = await fetch(
            `/api/projects/${projectId}/keywords/cluster/${jobId}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as KeywordClusterJob;
          if (
            data.status === "complete" ||
            data.status === "partial" ||
            data.status === "failed"
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            resolve(data);
          } else {
            setJob(data);
          }
        } catch {
          // keep polling
        }
      }, 3000);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setJob(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/keywords/cluster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedKeyword: seed.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.detail === "string"
            ? data.detail
            : `Failed to start clustering (${res.status})`
        );
        return;
      }

      const jobId = data.jobId as string;
      setJob({
        status: "pending",
        seedKeyword: seed.trim(),
        clusters: [],
        error: null,
      });
      const finalJob = await pollUntilDone(jobId);
      setJob(finalJob);
      startTransition(() => {
        // no-op refresh hook for future list views
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clustering failed");
    } finally {
      setLoading(false);
    }
  }

  const clusters = job?.clusters ?? [];
  const totalKeywords = clusters.reduce(
    (sum, cluster) => sum + cluster.keywords.length,
    0
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-sm font-medium">Semantic keyword clusters</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter a seed keyword to group related terms by meaning. Each keyword
            includes search volume and difficulty.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cluster-seed">Seed keyword</Label>
          <Input
            id="cluster-seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="content marketing tips"
            minLength={2}
            maxLength={100}
            required
            disabled={loading}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading || seed.trim().length < 2}>
          {loading ? "Clustering…" : "Generate clusters"}
        </Button>
      </form>

      {job && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {job.status}
            </span>
            <span>
              Seed: <span className="text-foreground">{job.seedKeyword}</span>
            </span>
            {(job.status === "complete" || job.status === "partial") && (
              <span>
                {totalKeywords} keywords · {clusters.length} clusters
              </span>
            )}
          </div>

          {job.error && (
            <p className="text-sm text-amber-700" role="alert">
              {job.error}
            </p>
          )}

          {(job.status === "pending" || job.status === "running") && (
            <p className="text-sm text-muted-foreground">
              Fetching related keywords, embedding, and clustering…
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {clusters.map((cluster) => (
              <div
                key={cluster.label}
                className="rounded-2xl border border-border bg-card p-5 space-y-3"
              >
                <h3 className="text-sm font-semibold">{cluster.label}</h3>
                <ul className="space-y-2">
                  {cluster.keywords.map((item) => (
                    <li
                      key={item.keyword}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 break-words">{item.keyword}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        Vol {item.searchVolume ?? "—"} · Diff{" "}
                        {item.difficulty ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
