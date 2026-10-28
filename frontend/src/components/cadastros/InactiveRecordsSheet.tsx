"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import apiClient from "../../services/api";
import { apiErrorMessage } from "../../utils/api-error";
import { reactivateRecord, type DeactivatableKind } from "../../utils/deactivation";
import type { Category, Client, Room } from "../../utils/models";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";

interface InactiveItem {
  id: string;
  title: string;
  detail: string;
}

const COPY: Record<DeactivatableKind, { title: string; empty: string; done: string }> = {
  client: { title: "Hóspedes desativados", empty: "Nenhum hóspede desativado.", done: "Hóspede reativado." },
  room: { title: "Quartos desativados", empty: "Nenhum quarto desativado.", done: "Quarto reativado." },
  category: { title: "Categorias desativadas", empty: "Nenhuma categoria desativada.", done: "Categoria reativada." },
};

// O backend só devolve desativados ao gerente, e só com includeInactive=true.
async function loadInactive(kind: DeactivatableKind): Promise<InactiveItem[]> {
  const params = { includeInactive: "true" };
  if (kind === "client") {
    const response = await apiClient.get<{ items: Client[] }>("/api/client", { params: { ...params, pageSize: 100 } });
    return response.data.items
      .filter((client) => client.active === false)
      .map((client) => ({ id: client.id, title: client.fullName, detail: client.fone || client.email || "" }));
  }
  if (kind === "room") {
    const response = await apiClient.get<Room[]>("/api/rooms", { params });
    return response.data
      .filter((room) => room.active === false)
      .map((room) => ({ id: room.id, title: `Quarto ${room.displayNumber ?? room.number}`, detail: room.type }));
  }
  const response = await apiClient.get<Category[]>("/api/Categories", { params });
  return response.data
    .filter((category) => category.active === false)
    .map((category) => ({ id: category.id, title: category.name, detail: "" }));
}

interface InactiveRecordsSheetProps {
  kind: DeactivatableKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReactivated: () => void;
}

export default function InactiveRecordsSheet({ kind, open, onOpenChange, onReactivated }: InactiveRecordsSheetProps) {
  const [items, setItems] = useState<InactiveItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const copy = COPY[kind];

  useEffect(() => {
    if (!open) return;
    let active = true;
    setItems(null);
    setError(null);
    loadInactive(kind)
      .then((loaded) => { if (active) setItems(loaded); })
      .catch((loadError) => { if (active) setError(apiErrorMessage(loadError, "Não foi possível carregar os desativados.")); });
    return () => { active = false; };
  }, [kind, open]);

  async function reactivate(item: InactiveItem) {
    setBusyId(item.id);
    try {
      await reactivateRecord(kind, item.id);
      setItems((current) => current?.filter((entry) => entry.id !== item.id) ?? current);
      toast.success(copy.done);
      onReactivated();
    } catch (reactivateError) {
      toast.error(apiErrorMessage(reactivateError, "Não foi possível reativar."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={copy.title} description="Desativados não aparecem para a recepção nem em novas reservas. O histórico continua guardado.">
      {error && <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}
      {!error && !items && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Carregando</span>
          {[0, 1, 2].map((row) => <span key={row} aria-hidden="true" className="h-11 animate-pulse rounded-bar bg-muted" />)}
        </div>
      )}
      {items && items.length === 0 && <p className="m-0 text-[13px] text-fg-3">{copy.empty}</p>}
      {items && items.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-t border-rule py-2.5 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.title}</span>
                {item.detail && <span className="truncate text-xs text-fg-3">{item.detail}</span>}
              </span>
              <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => void reactivate(item)}>
                <RotateCcw aria-hidden="true" />
                {busyId === item.id ? "Reativando…" : "Reativar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
