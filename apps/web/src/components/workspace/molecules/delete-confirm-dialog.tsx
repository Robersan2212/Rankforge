"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  /**
   * When set, the user must type this phrase exactly before Delete is enabled
   * (safer for destructive actions like deleting a whole project).
   */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
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
  confirmPhrase,
  confirmPhraseLabel = "Type the project name to confirm",
}: DeleteConfirmDialogProps) {
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    if (!open) setPhrase("");
  }, [open]);

  const phraseOk =
    !confirmPhrase || phrase.trim() === confirmPhrase.trim();

  async function handleConfirm() {
    if (!phraseOk) return;
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

        {confirmPhrase ? (
          <div className="space-y-2 px-1">
            <Label htmlFor="delete-confirm-phrase">{confirmPhraseLabel}</Label>
            <Input
              id="delete-confirm-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={confirmPhrase}
              autoComplete="off"
              disabled={loading}
              className="rounded-full"
            />
          </div>
        ) : null}

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-full px-3.5"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !phraseOk}
            className={cn(
              "rounded-full px-3.5 border-transparent bg-red-600 text-white hover:bg-red-700",
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
