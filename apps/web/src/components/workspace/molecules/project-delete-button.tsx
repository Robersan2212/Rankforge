"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/workspace/molecules/delete-confirm-dialog";
import { cn } from "@/lib/utils";

interface ProjectDeleteButtonProps {
  projectId: string;
  projectName: string;
  className?: string;
}

export function ProjectDeleteButton({
  projectId,
  projectName,
  className,
}: ProjectDeleteButtonProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail;
        setError(
          typeof detail === "string"
            ? detail
            : "Could not delete this project."
        );
        return;
      }

      setDialogOpen(false);
      startTransition(() => {
        router.push("/dashboard");
        router.refresh();
      });
    } catch {
      setError("Could not delete this project. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!deleting) {
      setDialogOpen(open);
      if (!open) setError(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setDialogOpen(true)}
        disabled={deleting || isPending}
        aria-label="Delete project"
        title="Delete project"
        className={cn(
          "shrink-0 rounded-full text-muted-foreground hover:text-destructive",
          className
        )}
      >
        <Trash2 className="size-4" />
      </Button>

      <DeleteConfirmDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        title="Delete this project?"
        description={`This permanently deletes “${projectName}” and all of its audits, briefs, drafts, keywords, competitor analyses, clusters, and Search Console data. This cannot be undone.`}
        error={error}
        confirmLabel="Delete project"
        confirmPhrase={projectName}
        confirmPhraseLabel="Type the project name to confirm"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
