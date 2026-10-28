"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import apiClient from "../../services/api";
import { apiErrorMessage } from "../../utils/api-error";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { toast } from "../ui/Toast";
import ClientFields from "./ClientFields";
import {
  clientPayload,
  emptyClientForm,
  validateClientForm,
  type ClientFormData,
  type ClientFormErrors,
} from "./nova-reserva-data";

export interface PickedClient {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone?: string;
}

interface ClientPickerProps {
  selected: PickedClient | null;
  onSelect: (client: PickedClient | null) => void;
  disabled?: boolean;
}

// Busca um cliente existente ou cadastra ali mesmo, com as regras do cadastro de hóspede.
export default function ClientPicker({ selected, onSelect, disabled }: ClientPickerProps) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PickedClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormData>(emptyClientForm);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [creating, setCreating] = useState(false);

  const term = search.trim();

  useEffect(() => {
    setResults([]);
    setSearchError(null);
    if (selected || mode !== "search" || term.length < 2) {
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      apiClient.get<{ items: PickedClient[] } | PickedClient[]>("/api/client", { params: { page: 1, pageSize: 6, search: term } })
        .then(({ data }) => { if (!cancelled) setResults(Array.isArray(data) ? data : data.items ?? []); })
        .catch((error) => { if (!cancelled) setSearchError(apiErrorMessage(error, "Não foi possível carregar os clientes.")); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [term, selected, mode]);

  const startNew = () => {
    // O que foi digitado na busca já vira nome ou telefone do cadastro.
    const digits = term.replace(/\D/g, "");
    setForm({ ...emptyClientForm, ...(digits.length >= 8 && digits.length === term.replace(/[\s()+-]/g, "").length ? { fone: term } : { fullName: term }) });
    setErrors({});
    setMode("new");
  };

  const create = async () => {
    if (creating) return;
    const found = validateClientForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setCreating(true);
    try {
      const { data } = await apiClient.post<PickedClient>("/api/client/create", clientPayload(form));
      toast.success("Cliente cadastrado.");
      onSelect({ id: data.id, fullName: data.fullName, cpf: data.cpf ?? "", email: data.email ?? "", fone: data.fone ?? form.fone });
      setMode("search");
      setSearch("");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Erro ao salvar hóspede."));
    } finally {
      setCreating(false);
    }
  };

  if (selected) {
    const contact = [selected.fone, selected.email].filter(Boolean).join(" · ");
    return (
      <div className="flex items-center gap-3 rounded-block bg-muted px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{selected.fullName}</span>
          <span className="truncate text-xs text-fg-2">
            {contact || "Sem contato cadastrado"}
            {selected.cpf ? <> · CPF <span className="font-mono">{selected.cpf}</span></> : " · CPF no check-in"}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onSelect(null)} disabled={disabled}>Trocar</Button>
      </div>
    );
  }

  if (mode === "new") {
    return (
      // Enter no cadastro cadastra o cliente, sem enviar a reserva.
      <div className="flex flex-col gap-3" onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); void create(); }
      }}>
        <ClientFields value={form} errors={errors} disabled={creating || disabled}
          onChange={(field, value) => {
            setForm((previous) => ({ ...previous, [field]: value }));
            setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
          }} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onClick={create} disabled={creating || disabled}>
            {creating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserPlus aria-hidden="true" />}
            Cadastrar cliente
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("search")} disabled={creating}>
            Já é cliente? Buscar por nome ou CPF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        icon={<Search />}
        type="search"
        aria-label="Buscar cliente por nome, e-mail, telefone ou CPF"
        placeholder="Buscar por nome, e-mail, telefone ou CPF"
        value={search}
        disabled={disabled}
        onChange={(event) => setSearch(event.target.value)}
      />
      {term.length >= 2 && (
        <div aria-live="polite" className="flex flex-col">
          {searching && <span className="py-2 text-[13px] text-fg-3">Buscando…</span>}
          {searchError && <span role="alert" className="py-2 text-[13px] text-danger">{searchError}</span>}
          {!searching && !searchError && results.length === 0 && (
            <span className="py-2 text-[13px] text-fg-3">Nenhum cliente encontrado.</span>
          )}
          {!searching && results.length > 0 && (
            <ul className="m-0 flex list-none flex-col p-0">
              {results.map((client) => (
                <li key={client.id} className="border-b border-rule last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(client)}
                    className="flex w-full items-center justify-between gap-3 rounded-bar px-2 py-2 text-left hover:bg-muted"
                  >
                    <span className="truncate text-sm">{client.fullName}</span>
                    <span className="shrink-0 truncate text-xs text-fg-3">{client.fone || client.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Button size="sm" variant="ghost" className="self-start" onClick={startNew} disabled={disabled}>
        <UserPlus aria-hidden="true" />
        Cliente novo? Cadastrar aqui
      </Button>
    </div>
  );
}
