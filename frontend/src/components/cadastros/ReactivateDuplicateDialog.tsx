"use client";

import { useState } from "react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { apiErrorMessage } from "../../utils/api-error";
import { reactivateRecord, type DeactivatableKind } from "../../utils/deactivation";
import ConfirmDialog from "../ui/ConfirmDialog";
import { toast } from "../ui/Toast";

const COPY: Record<DeactivatableKind, { title: string; description: string; done: string }> = {
  client: { title: "Hóspede desativado", description: "Já existe um hóspede desativado com este CPF. Reative o cadastro dele para manter o histórico junto.", done: "Hóspede reativado." },
  room: { title: "Quarto desativado", description: "Já existe um quarto desativado com esse número. Reative o quarto em vez de cadastrar outro.", done: "Quarto reativado." },
  category: { title: "Categoria desativada", description: "Já existe uma categoria desativada com esse nome. Reative a categoria em vez de criar outra.", done: "Categoria reativada." },
};

interface ReactivateDuplicateDialogProps {
  kind: DeactivatableKind;
  /** Id do desativado que o cadastro encontrou; null fecha o aviso. */
  duplicateId: string | null;
  onClose: () => void;
  onReactivated: () => void;
}

// Só o gerente reativa; a recepção vê o aviso e chama o gerente.
export default function ReactivateDuplicateDialog({ kind, duplicateId, onClose, onReactivated }: ReactivateDuplicateDialogProps) {
  const isAdmin = useCurrentUser().user?.role === "admin";
  const [busy, setBusy] = useState(false);
  const copy = COPY[kind];

  async function reactivate() {
    if (!duplicateId) return;
    setBusy(true);
    try {
      await reactivateRecord(kind, duplicateId);
      toast.success(copy.done);
      onClose();
      onReactivated();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Não foi possível reativar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={duplicateId !== null}
      onOpenChange={(open) => { if (!open && !busy) onClose(); }}
      title={copy.title}
      description={isAdmin ? copy.description : `${copy.description} Peça ao gerente para reativar.`}
      confirmLabel={isAdmin ? "Reativar" : "Entendi"}
      busy={busy}
      onConfirm={() => (isAdmin ? void reactivate() : onClose())}
    />
  );
}
