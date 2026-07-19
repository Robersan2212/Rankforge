"use client";

import { useState } from "react";
import { KeywordClusterPanel } from "@/components/workspace/organisms/keyword-cluster-panel";
import { KeywordTrackerPanel } from "@/components/workspace/organisms/keyword-tracker-panel";
import { cn } from "@/lib/utils";
import type { TrackedKeyword } from "@/lib/types";

interface KeywordsSectionPanelProps {
  projectId: string;
  items: TrackedKeyword[];
}

type KeywordsTab = "rankings" | "clusters";

export function KeywordsSectionPanel({
  projectId,
  items,
}: KeywordsSectionPanelProps) {
  const [tab, setTab] = useState<KeywordsTab>("rankings");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setTab("rankings")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            tab === "rankings"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Rankings
        </button>
        <button
          type="button"
          onClick={() => setTab("clusters")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            tab === "clusters"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Clusters
        </button>
      </div>

      {tab === "rankings" ? (
        <KeywordTrackerPanel projectId={projectId} items={items} />
      ) : (
        <KeywordClusterPanel projectId={projectId} />
      )}
    </div>
  );
}
