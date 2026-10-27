"use client";

import { useEffect } from "react";
import { toast } from "./ui/Toast";

interface SnackbarProps {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

/**
 * Mantém a API antiga das telas e mostra o aviso pelo sonner (Toaster no layout raiz).
 * Fecha o estado do pai logo em seguida, para a mesma mensagem poder aparecer de novo.
 */
export default function CustomSnackbar({ open, message, severity, onClose }: SnackbarProps) {
  useEffect(() => {
    if (!open || !message) return;
    // O id evita o aviso em dobro quando o StrictMode roda o efeito duas vezes.
    toast[severity](message, { id: `${severity}:${message}` });
    onClose();
  }, [open, message, severity, onClose]);

  return null;
}
