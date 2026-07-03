"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuditDeleteButtonProps {
  projectId: string;
  auditId: string;
  /** After delete, navigate here (e.g. audits list). Omit to only refresh. */
  redirectTo?: string;
  className?: string;
  variant?: "icon" | "button";
}

export function AuditDeleteButton({
  projectId,
  auditId,
  redirectTo,
  className,
  variant = "icon",
}: AuditDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this audit? This cannot be undone."
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/audits/${auditId}`,
        { method: "DELETE" }
      );

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail;
        window.alert(
          typeof detail === "string"
            ? detail
            : "Could not delete this audit."
        );
        return;
      }

      if (redirectTo) {
        startTransition(() => {
          router.push(redirectTo);
        });
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      window.alert("Could not delete this audit. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={deleting || isPending}
        className={cn("text-destructive hover:text-destructive", className)}
      >
        <Trash2 className="size-4 mr-2" />
        {deleting ? "Deleting…" : "Delete audit"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={deleting || isPending}
      aria-label="Delete audit"
      className={cn(
        "shrink-0 text-muted-foreground hover:text-destructive",
        className
      )}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
