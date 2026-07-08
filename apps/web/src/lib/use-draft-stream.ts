"use client";

import { useCallback, useRef, useState } from "react";

export type DraftStreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "done"
  | "error";

export interface DraftStreamDonePayload {
  draft_id: string;
  word_count: number;
  time_to_first_token_ms: number | null;
}

export interface DraftStreamErrorPayload {
  code: string;
  message: string;
}

interface UseDraftStreamOptions {
  projectId: string;
  onToken: (text: string) => void;
  onDone?: (payload: DraftStreamDonePayload) => void;
  onError?: (payload: DraftStreamErrorPayload) => void;
}

interface UseDraftStreamResult {
  status: DraftStreamStatus;
  chunkCount: number;
  timeToFirstTokenMs: number | null;
  error: DraftStreamErrorPayload | null;
  startGeneration: (body: {
    brief_id: string;
    draft_id?: string;
  }) => Promise<void>;
  abort: () => void;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export function useDraftStream({
  projectId,
  onToken,
  onDone,
  onError,
}: UseDraftStreamOptions): UseDraftStreamResult {
  const [status, setStatus] = useState<DraftStreamStatus>("idle");
  const [chunkCount, setChunkCount] = useState(0);
  const [timeToFirstTokenMs, setTimeToFirstTokenMs] = useState<number | null>(
    null
  );
  const [error, setError] = useState<DraftStreamErrorPayload | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const firstTokenRef = useRef<number | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const startGeneration = useCallback(
    async (body: { brief_id: string; draft_id?: string }) => {
      abort();
      setStatus("connecting");
      setChunkCount(0);
      setTimeToFirstTokenMs(null);
      setError(null);
      firstTokenRef.current = null;
      startTimeRef.current = performance.now();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/projects/${projectId}/drafts/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            detail?: string;
          };
          const errPayload: DraftStreamErrorPayload = {
            code: "http_error",
            message: payload.detail ?? "Generation request failed.",
          };
          setError(errPayload);
          setStatus("error");
          onError?.(errPayload);
          return;
        }

        if (!response.body) {
          const errPayload: DraftStreamErrorPayload = {
            code: "no_stream",
            message: "No response stream received.",
          };
          setError(errPayload);
          setStatus("error");
          onError?.(errPayload);
          return;
        }

        setStatus("streaming");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let localChunkCount = 0;

        let finished = false;
        let errored = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            if (!block.trim()) continue;
            const parsed = parseSseBlock(block);
            if (!parsed) continue;

            const payload = JSON.parse(parsed.data) as Record<string, unknown>;

            if (parsed.event === "token" && typeof payload.text === "string") {
              if (firstTokenRef.current === null) {
                firstTokenRef.current = performance.now();
                const ttft = Math.round(
                  firstTokenRef.current - startTimeRef.current
                );
                setTimeToFirstTokenMs(ttft);
                console.info(`[FR-06] time to first token: ${ttft}ms`);
              }
              localChunkCount += 1;
              setChunkCount(localChunkCount);
              onToken(payload.text);
            } else if (parsed.event === "done") {
              finished = true;
              setStatus("done");
              onDone?.(payload as unknown as DraftStreamDonePayload);
            } else if (parsed.event === "error") {
              errored = true;
              const errPayload = payload as unknown as DraftStreamErrorPayload;
              setError(errPayload);
              setStatus("error");
              onError?.(errPayload);
            }
          }
        }

        if (!finished && !errored) {
          setStatus("done");
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("idle");
          return;
        }
        const errPayload: DraftStreamErrorPayload = {
          code: "network_error",
          message:
            err instanceof Error ? err.message : "Generation failed unexpectedly.",
        };
        setError(errPayload);
        setStatus("error");
        onError?.(errPayload);
      } finally {
        abortRef.current = null;
      }
    },
    [projectId, onToken, onDone, onError, abort]
  );

  return {
    status,
    chunkCount,
    timeToFirstTokenMs,
    error,
    startGeneration,
    abort,
  };
}
