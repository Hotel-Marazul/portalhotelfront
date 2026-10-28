"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import apiClient from "../../services/api";
import { apiErrorMessage } from "../../utils/api-error";
import { formatCurrency } from "../../utils/format";
import { formatReservationCalendarDate } from "../../utils/reservation";
import ModalHospede, { type HospedeSuccessClient } from "./ModalHospede";
import ModalNovaReserva, { type ReservationInitialValues } from "./ModalNovaReserva";
import { CommandBarTrigger } from "../command/CommandBar";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { cx } from "../ui/cx";
import GuestProfile from "../hospedes/GuestProfile";
import { guestSituation, initials, pageRangeLabel, stayTotals, type GuestClient, type SituationTone } from "../hospedes/hospedes-data";

interface ClientsResponse {
  items: GuestClient[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

const thClass = "sticky top-0 z-[1] bg-surface py-2 text-left text-xs font-medium text-fg-3";

const SITUATION_CLASS: Record<SituationTone, { text: string; dot: string }> = {
  staying: { text: "text-fg", dot: "bg-fg" },
  arriving: { text: "text-accent", dot: "bg-accent" },
  late: { text: "text-warn-fg", dot: "bg-warn" },
  future: { text: "text-fg-2", dot: "bg-fg-3" },
  none: { text: "text-fg-3", dot: "bg-border" },
};

// Tela Hóspedes: lista com busca à esquerda e a ficha do hóspede escolhido à direita.
export default function HospedesScreen() {
  const searchParams = useSearchParams();
  const linkedSearch = searchParams.get("busca") ?? "";
  const linkedClient = searchParams.get("cliente");

  const [filtro, setFiltro] = useState(linkedSearch);
  const [busca, setBusca] = useState(linkedSearch.trim());
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [hospedes, setHospedes] = useState<GuestClient[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(linkedClient);

  const [guestModal, setGuestModal] = useState<{ open: boolean; mode: "adicionar" | "editar"; id?: string }>({ open: false, mode: "adicionar" });
  const [reservationInitial, setReservationInitial] = useState<ReservationInitialValues | null>(null);
  const [reservationOpen, setReservationOpen] = useState(false);

  const requestIdRef = useRef(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const today = formatReservationCalendarDate(new Date());

  // A barra de busca do topo abre /cliente?cliente=<id>&busca=<nome>, inclusive com a tela já aberta.
  useEffect(() => {
    if (!linkedClient && !linkedSearch) return;
    setFiltro(linkedSearch);
    setBusca(linkedSearch.trim());
    setPage(1);
    if (linkedClient) setSelectedId(linkedClient);
  }, [linkedClient, linkedSearch]);

  useEffect(() => {
    const term = filtro.trim();
    if (term === busca) return;
    const timer = window.setTimeout(() => {
      setBusca(term);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filtro, busca]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    apiClient
      .get<ClientsResponse>("/api/client", { params: { page, limit: PAGE_SIZE, search: busca || undefined } })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        const items = (response.data.items ?? []).map((client) => ({
          ...client,
          reservations: Array.isArray(client.reservations) ? client.reservations : [],
        }));
        setHospedes(items);
        setTotal(response.data.total ?? 0);
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        setHospedes([]);
        setTotal(null);
        setLoadError(apiErrorMessage(error, "Não foi possível carregar hóspedes."));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [page, busca, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const items = hospedes;
  const lastPage = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  const selected = items.find((client) => client.id === selectedId) ?? items[0] ?? null;

  function pick(client: GuestClient) {
    setSelectedId(client.id);
    // Em tela estreita a ficha fica embaixo da lista.
    if (window.matchMedia("(max-width: 1099px)").matches) {
      profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleGuestSaved(created?: HospedeSuccessClient) {
    if (created) {
      setSelectedId(created.id);
      setFiltro(created.fullName);
      setBusca(created.fullName.trim());
      setPage(1);
    }
    reload();
  }

  function openNewReservation(client: GuestClient) {
    setReservationInitial({ client: { id: client.id, fullName: client.fullName, cpf: client.cpf, email: client.email } });
    setReservationOpen(true);
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-6 min-[900px]:px-9 min-[900px]:py-7 min-[1100px]:min-h-0 min-[1100px]:flex-1">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Hóspedes</h1>
          <span className="min-h-5 text-fg-3">
            {total !== null ? <><span className="font-mono">{total.toLocaleString("pt-BR")}</span> {busca ? (total === 1 ? "encontrado" : "encontrados") : (total === 1 ? "cadastrado" : "cadastrados")}</> : ""}
          </span>
        </div>
        <Button variant="primary" onClick={() => setGuestModal({ open: true, mode: "adicionar" })}>
          <Plus aria-hidden="true" />
          Novo hóspede
        </Button>
      </header>

      <CommandBarTrigger className="shrink-0" />

      <div className="shrink-0">
        <label htmlFor="busca-hospede" className="sr-only">Buscar hóspede</label>
        <Input
          id="busca-hospede"
          type="search"
          icon={<Search />}
          placeholder="Nome, CPF, telefone ou e-mail"
          value={filtro}
          onChange={(event) => setFiltro(event.target.value)}
          className="w-[340px] max-w-full"
        />
      </div>

      <div className="flex flex-col gap-7 min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:flex-row">
        <div className="flex min-w-0 flex-col gap-2.5 min-[1100px]:min-h-0 min-[1100px]:flex-1">
          <div className="min-h-0 overflow-x-auto min-[1100px]:flex-1 min-[1100px]:overflow-y-auto" aria-busy={loading || undefined}>
            {loading && total === null ? (
              <div className="flex flex-col gap-2 pt-2">
                <span className="sr-only">Carregando</span>
                {[0, 1, 2, 3, 4].map((row) => <span key={row} aria-hidden="true" className="h-12 animate-pulse rounded-bar bg-muted" />)}
              </div>
            ) : loadError ? (
              <div role="alert" className="flex flex-wrap items-center gap-3 py-6 text-[13px] text-danger">
                {loadError}
                <Button size="sm" onClick={reload}>Tentar novamente</Button>
              </div>
            ) : items.length === 0 ? (
              <p className="m-0 py-6 text-[13px] text-fg-3">{busca ? "Nenhum hóspede encontrado para esta busca." : "Nenhum hóspede cadastrado."}</p>
            ) : (
              <table className={cx("w-full min-w-[560px] border-collapse transition-opacity", loading && "opacity-60")}>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Hóspede</th>
                    <th scope="col" className={thClass}>Telefone</th>
                    <th scope="col" className={thClass}>Situação</th>
                    <th scope="col" className={cx(thClass, "text-right")}>Estadias</th>
                    <th scope="col" className={cx(thClass, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((client) => {
                    const situation = guestSituation(client.reservations, today);
                    const totals = stayTotals(client.reservations);
                    const active = selected?.id === client.id;
                    const tone = SITUATION_CLASS[situation.tone];
                    return (
                      <tr key={client.id} className={cx("border-t border-rule", active && "bg-accent-50")}>
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => pick(client)}
                            className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-fg"
                          >
                            <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-fg-2">
                              {initials(client.fullName)}
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">{client.fullName}</span>
                              <span className="truncate text-xs text-fg-3">{client.email || "Sem e-mail"}</span>
                            </span>
                          </button>
                        </td>
                        <td className="py-2 pr-3 font-mono text-[13px] whitespace-nowrap">{client.fone || "—"}</td>
                        <td className="py-2 pr-3">
                          <span className={cx("inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", tone.text)}>
                            <span aria-hidden="true" className={cx("size-1.5 rounded-full", tone.dot)} />
                            {situation.label}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-[13px]">{totals.stays}</td>
                        <td className="py-2 pl-3 text-right font-mono text-[13px] whitespace-nowrap">{formatCurrency(totals.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {total !== null && total > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-rule pt-2.5 text-[13px] text-fg-3">
              <span>Mostrando <span className="font-mono text-fg">{pageRangeLabel(page, PAGE_SIZE, total)}</span></span>
              <span className="inline-flex gap-1">
                <Button size="sm" aria-label="Página anterior" className="w-8 px-0" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button size="sm" aria-label="Próxima página" className="w-8 px-0" disabled={page >= lastPage || loading} onClick={() => setPage((current) => current + 1)}>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </span>
            </div>
          )}
        </div>

        <div ref={profileRef} className="flex min-w-0 scroll-mt-4 min-[1100px]:min-h-0">
          {selected && (
            <GuestProfile
              client={selected}
              today={today}
              onEdit={() => setGuestModal({ open: true, mode: "editar", id: selected.id })}
              onNewReservation={() => openNewReservation(selected)}
            />
          )}
        </div>
      </div>

      <ModalHospede
        open={guestModal.open}
        onClose={() => setGuestModal((current) => ({ ...current, open: false, id: undefined }))}
        onSuccess={handleGuestSaved}
        mode={guestModal.mode}
        hospedeId={guestModal.id}
      />

      {reservationInitial && (
        <ModalNovaReserva
          open={reservationOpen}
          onClose={() => setReservationOpen(false)}
          onSuccess={reload}
          initialValues={reservationInitial}
        />
      )}
    </div>
  );
}
