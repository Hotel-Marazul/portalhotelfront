"use client";

import { useEffect, useState } from "react";
import { api } from "../../services/api";
import styles from "./whatsapp.module.css";

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

  if (!open) return null;

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
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="link-contact-title">
        <h2 id="link-contact-title">Vincular contato</h2>
        <p>Escolha o hóspede correspondente a este número.</p>
        {loading ? <p>Carregando candidatos…</p> : candidates.length ? (
          <label className={styles.dialogField}>
            <span>Hóspede</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Selecione</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName} · {candidate.fone} ({candidate.match === "phone" ? "telefone" : "nome"})
                </option>
              ))}
            </select>
          </label>
        ) : <p>Nenhum candidato encontrado.</p>}
        {error && <p className={styles.dialogError} role="alert">{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.detailActionSecondary} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.detailAction} onClick={() => void link()} disabled={!selectedId || saving || loading}>
            {saving ? "Vinculando…" : "Vincular"}
          </button>
        </div>
      </section>
    </div>
  );
}
