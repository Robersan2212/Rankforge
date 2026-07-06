"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  error,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  loading = false,
}: DeleteConfirmDialogProps) {
  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "border-transparent bg-red-600 text-white hover:bg-red-700",
              "focus-visible:border-red-600 focus-visible:ring-red-600/30",
              "dark:bg-red-600 dark:hover:bg-red-500"
            )}
          >
            {loading ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
