"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/workspace/molecules/delete-confirm-dialog";
import { cn } from "@/lib/utils";

interface DraftDeleteButtonProps {
  projectId: string;
  draftId: string;
  redirectTo?: string;
  className?: string;
  variant?: "icon" | "button";
}

export function DraftDeleteButton({
  projectId,
  draftId,
  redirectTo,
  className,
  variant = "icon",
}: DraftDeleteButtonProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/drafts/${draftId}`,
        { method: "DELETE" }
      );

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail;
        setError(
          typeof detail === "string" ? detail : "Could not delete this draft."
        );
        return;
      }

      setDialogOpen(false);
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
      setError("Could not delete this draft. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!deleting) {
      setDialogOpen(open);
      if (!open) {
        setError(null);
      }
    }
  }

  const trigger =
    variant === "button" ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={deleting || isPending}
        className={cn("text-destructive hover:text-destructive", className)}
      >
        <Trash2 className="size-4 mr-2" />
        Delete draft
      </Button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setDialogOpen(true)}
        disabled={deleting || isPending}
        aria-label="Delete draft"
        className={cn(
          "shrink-0 text-muted-foreground hover:text-destructive",
          className
        )}
      >
        <Trash2 className="size-4" />
      </Button>
    );

  return (
    <>
      {trigger}
      <DeleteConfirmDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        title="Delete draft?"
        description="This draft will be permanently removed. This cannot be undone."
        error={error}
        confirmLabel="Delete draft"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
