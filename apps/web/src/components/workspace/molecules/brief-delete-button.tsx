"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BriefDeleteButtonProps {
  projectId: string;
  briefId: string;
  redirectTo?: string;
  className?: string;
  variant?: "icon" | "button";
}

export function BriefDeleteButton({
  projectId,
  briefId,
  redirectTo,
  className,
  variant = "icon",
}: BriefDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    if (!window.confirm("Delete this brief? This cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/briefs/${briefId}`,
        { method: "DELETE" }
      );

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail;
        window.alert(
          typeof detail === "string" ? detail : "Could not delete this brief."
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
      window.alert("Could not delete this brief. Try again.");
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
        {deleting ? "Deleting…" : "Delete brief"}
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
      aria-label="Delete brief"
      className={cn(
        "shrink-0 text-muted-foreground hover:text-destructive",
        className
      )}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
