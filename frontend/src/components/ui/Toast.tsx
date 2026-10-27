"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

// Monta uma vez no layout; as telas chamam toast.success, toast.error, toast.warning ou toast.info.
export default function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      duration={6000}
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Fechar aviso",
        classNames: {
          toast: "flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-block border border-border-soft bg-surface py-3 pr-10 pl-4 text-sm text-fg shadow-sheet",
          title: "font-medium",
          description: "mt-0.5 text-[13px] text-fg-2",
          icon: "mt-0.5 shrink-0 [&_svg]:size-4",
          success: "[&_[data-icon]]:text-accent",
          info: "[&_[data-icon]]:text-fg-2",
          warning: "[&_[data-icon]]:text-warn",
          error: "[&_[data-icon]]:text-danger",
          actionButton: "ml-auto shrink-0 rounded-control bg-fg px-3 py-1.5 text-[13px] font-medium text-on-dark",
          cancelButton: "shrink-0 rounded-control px-3 py-1.5 text-[13px] text-fg-2 hover:bg-muted",
          closeButton: "absolute top-2 right-2 grid size-7 place-items-center rounded-bar text-fg-3 hover:bg-muted hover:text-fg [&_svg]:size-3.5",
        },
      }}
    />
  );
}
