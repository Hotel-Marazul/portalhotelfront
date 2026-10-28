"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Select from "../ui/Select";

interface LinkCandidate {
  id: string;
  fullName: string;
  fone: string;
  match: "phone" | "name";
}

interface LinkContactDialogProps {
  open: boolean;
  contactId: string;
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkContactDialog({ open, contactId, onClose, onLinked }: LinkContactDialogProps) {
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    setError(null);
    setLoading(true);
    api.get<{ candidates: LinkCandidate[] }>(`/api/whatsapp/contacts/${contactId}/link-candidates`)
      .then((response) => setCandidates(response.data.candidates))
      .catch(() => setError("Não foi possível carregar candidatos."))
      .finally(() => setLoading(false));
  }, [contactId, open]);

  const link = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/whatsapp/contacts/${contactId}/link`, { clientId: selectedId });
      onLinked();
      onClose();
    } catch {
      setError("Não foi possível vincular o contato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1350] bg-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[1350] flex w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-panel bg-surface p-6 text-fg shadow-sheet">
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="m-0 text-[17px] font-semibold">Vincular contato</Dialog.Title>
            <Dialog.Description className="m-0 text-sm text-fg-2">Escolha o hóspede correspondente a este número.</Dialog.Description>
          </div>
          {loading ? <p className="m-0 text-sm text-fg-2">Carregando candidatos…</p> : candidates.length ? (
            <Field label="Hóspede">
              <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                <option value="">Selecione</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} · {candidate.fone} ({candidate.match === "phone" ? "telefone" : "nome"})
                  </option>
                ))}
              </Select>
            </Field>
          ) : !error && <p className="m-0 text-sm text-fg-2">Nenhum candidato encontrado.</p>}
          {error && <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={saving}>Cancelar</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => void link()} disabled={!selectedId || saving || loading}>
              {saving ? "Vinculando…" : "Vincular"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
