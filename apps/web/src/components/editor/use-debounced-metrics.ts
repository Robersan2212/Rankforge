"use client";

import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { computeSeoMetrics, type SeoMetrics } from "@/lib/seo-metrics";

export interface MetricsConfig {
  primaryKeyword: string;
  semanticKeywords: string[];
  targetWordCount?: number;
}

export interface EditorMetricsState {
  text: string;
  json: JSONContent;
}

const EMPTY_METRICS: SeoMetrics = computeSeoMetrics({
  text: "",
  docJson: { type: "doc", content: [] },
  primaryKeyword: "",
  semanticKeywords: [],
});

export function useDebouncedMetrics(
  state: EditorMetricsState,
  config: MetricsConfig,
  debounceMs = 300
): SeoMetrics {
  const [metrics, setMetrics] = useState<SeoMetrics>(EMPTY_METRICS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setMetrics(
        computeSeoMetrics({
          text: state.text,
          docJson: state.json,
          primaryKeyword: config.primaryKeyword,
          semanticKeywords: config.semanticKeywords,
          targetWordCount: config.targetWordCount,
        })
      );
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    state.text,
    state.json,
    config.primaryKeyword,
    config.semanticKeywords,
    config.targetWordCount,
    debounceMs,
  ]);

  return metrics;
}
