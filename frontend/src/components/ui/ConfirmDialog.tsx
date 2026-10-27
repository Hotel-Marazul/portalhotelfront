"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" para ações que não voltam atrás, como cancelar uma reserva. */
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
}

// Pergunta curta antes de uma ação irreversível. O foco começa em "Voltar".
export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Voltar", tone = "primary", busy = false, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1350] bg-overlay" />
        <Dialog.Content
          role="alertdialog"
          className="fixed top-1/2 left-1/2 z-[1350] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-panel bg-surface p-6 text-fg shadow-sheet"
        >
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="m-0 text-[17px] font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="m-0 text-sm leading-relaxed text-fg-2">{description}</Dialog.Description>
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={busy} autoFocus>{cancelLabel}</Button>
            </Dialog.Close>
            <Button variant={tone === "danger" ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
              {busy ? "Aguarde…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
