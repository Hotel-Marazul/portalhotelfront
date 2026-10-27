"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

// md: reserva aberta (520 px). lg: nova reserva em duas colunas (920 px).
export type SheetSize = "md" | "lg";

const SIZES: Record<SheetSize, string> = {
  md: "w-[min(520px,calc(100vw-16px))]",
  lg: "w-[min(920px,calc(100vw-16px))]",
};

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel?: string;
  // Fica à esquerda do botão de fechar: chips de status, ações do cabeçalho.
  headerAside?: ReactNode;
  footer?: ReactNode;
  size?: SheetSize;
  children: ReactNode;
}

// Abre por cima da tela de origem, encostado à direita. O corpo rola por dentro; cabeçalho e rodapé ficam fixos.
export default function Sheet({ open, onOpenChange, title, description, closeLabel = "Fechar", headerAside, footer, size = "md", children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1300] bg-overlay" />
        <Dialog.Content
          className={cx("fixed top-2 right-2 bottom-2 z-[1300] flex flex-col overflow-hidden rounded-panel bg-surface text-fg shadow-sheet", SIZES[size])}
          // Sem descrição, o Radix pede aria-describedby explícito.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="flex items-start gap-3 border-b border-rule px-6 pt-5 pb-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="m-0 text-[22px] leading-tight font-semibold tracking-[-0.02em]">{title}</Dialog.Title>
              {description && <Dialog.Description className="m-0 text-[13px] text-fg-2">{description}</Dialog.Description>}
            </div>
            {headerAside}
            <Dialog.Close
              aria-label={closeLabel}
              className="grid size-9 shrink-0 place-items-center rounded-control text-fg-2 transition-colors hover:bg-muted hover:text-fg"
            >
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-rule px-6 py-4">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
