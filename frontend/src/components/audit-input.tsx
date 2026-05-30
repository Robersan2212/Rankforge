"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuditInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export function AuditInput({
  url,
  onUrlChange,
  onSubmit,
  loading = false,
}: AuditInputProps) {
  return (
    <form
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Input
        type="url"
        placeholder="Enter URL to audit..."
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        disabled={loading}
        className="h-12 flex-1 rounded-lg border-border bg-card px-4 font-mono text-sm shadow-sm focus-visible:ring-primary/40"
      />
      <Button
        type="submit"
        disabled={loading}
        className="h-12 shrink-0 rounded-lg px-8 font-medium shadow-sm"
      >
        {loading ? "Auditing…" : "Run Audit"}
      </Button>
    </form>
  );
}
