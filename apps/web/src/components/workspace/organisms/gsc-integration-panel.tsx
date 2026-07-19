"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteConfirmDialog } from "@/components/workspace/molecules/delete-confirm-dialog";
import type { GscConnectionStatus } from "@/lib/types";
import { formatShortDate } from "@/lib/format-date";

interface GscIntegrationPanelProps {
  projectId: string;
}

function formatDate(value: string | null | undefined) {
  return formatShortDate(value);
}

function gscErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "no_properties":
      return "Google approved access, but that account has no Search Console properties. Verify your site in Google Search Console with this same Google account, then connect again.";
    case "access_denied":
      return "Google access was denied. Add your Google account as an OAuth test user, then try again.";
    default:
      return `Could not connect Google Search Console (${code}).`;
  }
}

export function GscIntegrationPanel({ projectId }: GscIntegrationPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<GscConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/auth/gsc/status?project_id=${encodeURIComponent(projectId)}`
      );
      if (!res.ok) {
        setStatus({ connected: false, status: "not_connected" });
        return;
      }
      setStatus((await res.json()) as GscConnectionStatus);
    } catch {
      setStatus({ connected: false, status: "not_connected" });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gscError = params.get("gsc_error");
    if (gscError) {
      setOauthMessage(gscErrorMessage(gscError));
    }
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/gsc/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.detail === "string"
            ? data.detail
            : "Could not disconnect Search Console."
        );
        return;
      }
      setDisconnectOpen(false);
      await loadStatus();
      router.refresh();
    } catch {
      setError("Could not disconnect Search Console.");
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected === true;
  const needsReconnect = status?.needs_reconnect === true;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium">Google Search Console</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect to import real impressions, clicks, CTR, and position into
          audit reports.
        </p>
      </div>

      {status?.schema_missing && (
        <p className="text-sm text-amber-700" role="alert">
          Database migration missing. Run{" "}
          <code className="text-xs">supabase db push</code> to apply{" "}
          <code className="text-xs">0008_gsc_integration.sql</code>.
        </p>
      )}

      {oauthMessage && (
        <p className="text-sm text-amber-700" role="alert">
          {oauthMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Checking connection…</p>
      ) : connected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Connected
            </span>
            {status?.property_url && (
              <span className="text-xs text-muted-foreground truncate">
                {status.property_url}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Connected {formatDate(status?.connected_at)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-3.5"
            onClick={() => setDisconnectOpen(true)}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              needsReconnect
                ? "bg-amber-500/10 text-amber-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {needsReconnect ? "Reconnect required" : "Not connected"}
          </span>
          <div>
            <a
              href={`/api/auth/gsc/start?project_id=${encodeURIComponent(projectId)}`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "rounded-full px-3.5"
              )}
            >
              {needsReconnect
                ? "Reconnect Google Search Console"
                : "Connect Google Search Console"}
            </a>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={disconnectOpen}
        onOpenChange={(open) => {
          if (!disconnecting) setDisconnectOpen(open);
        }}
        title="Disconnect Google Search Console?"
        description="This revokes Rankforge access at Google and removes stored tokens for this project."
        error={error}
        confirmLabel="Disconnect"
        onConfirm={() => void handleDisconnect()}
        loading={disconnecting}
      />
    </div>
  );
}
