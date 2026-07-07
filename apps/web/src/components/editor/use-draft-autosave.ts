"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseDraftAutosaveOptions {
  projectId: string;
  draftId: string;
  title: string;
  content: string;
  briefId: string | null;
  debounceMs?: number;
  minIntervalMs?: number;
}

interface UseDraftAutosaveResult {
  saveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
}

export function useDraftAutosave({
  projectId,
  draftId,
  title,
  content,
  briefId,
  debounceMs = 2000,
  minIntervalMs = 5000,
}: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastSavedPayloadRef = useRef<string>("");
  const lastSaveTimeRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    const payload = JSON.stringify({ title, content, briefId });

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      lastSavedPayloadRef.current = payload;
      return;
    }

    if (payload === lastSavedPayloadRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const performSave = async () => {
      const now = Date.now();
      const sinceLast = now - lastSaveTimeRef.current;
      if (lastSaveTimeRef.current > 0 && sinceLast < minIntervalMs) {
        debounceTimerRef.current = setTimeout(
          performSave,
          minIntervalMs - sinceLast
        );
        return;
      }

      setSaveStatus("saving");

      try {
        const response = await fetch(
          `/api/projects/${projectId}/drafts/${draftId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.trim() || "Untitled draft",
              content,
              brief_id: briefId,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Save failed: ${response.status}`);
        }

        lastSavedPayloadRef.current = payload;
        lastSaveTimeRef.current = Date.now();
        setLastSavedAt(new Date());
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    };

    debounceTimerRef.current = setTimeout(performSave, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    projectId,
    draftId,
    title,
    content,
    briefId,
    debounceMs,
    minIntervalMs,
  ]);

  return { saveStatus, lastSavedAt };
}
