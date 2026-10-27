"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReservationDto } from "../../types/reservations";
import { formatDayMonth } from "../../utils/format";
import Button, { buttonClasses } from "../ui/Button";
import { ReservationStatusChip } from "../ui/StatusChip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import { cx } from "../ui/cx";
import { nextAction, reservationPeople, type MovementTab } from "./today-data";

export interface MovementList {
  status: "loading" | "error" | "ready";
  items: ReservationDto[];
}

interface TodayMovementProps {
  lists: Record<MovementTab, MovementList>;
  busyId: string | null;
  onCheckIn: (reservation: ReservationDto) => void;
  onCheckOut: (reservation: ReservationDto) => void;
}

const TABS: Array<{ key: MovementTab; label: string; empty: string; error: string }> = [
  { key: "arrivals", label: "Chegadas", empty: "Nenhuma chegada hoje.", error: "Não foi possível carregar as chegadas de hoje." },
  { key: "departures", label: "Saídas", empty: "Nenhuma saída hoje.", error: "Não foi possível carregar as saídas de hoje." },
  { key: "staying", label: "Hospedados", empty: "Ninguém hospedado agora.", error: "Não foi possível carregar os hospedados." },
];

const isDone = (tab: MovementTab, status: string) =>
  (tab === "arrivals" && (status === "EmAndamento" || status === "Concluída" || status === "Concluida"))
  || (tab === "departures" && (status === "Concluída" || status === "Concluida"));

function roomLabel(reservation: ReservationDto) {
  return reservation.room?.displayNumber ?? (reservation.room?.number !== undefined ? String(reservation.room.number) : "—");
}

// O que falta fazer vem primeiro; dentro disso, pela ordem dos quartos.
function sortRows(tab: MovementTab, items: ReservationDto[]) {
  return [...items].sort((a, b) =>
    Number(isDone(tab, a.status)) - Number(isDone(tab, b.status))
    || (a.room?.number ?? 0) - (b.room?.number ?? 0));
}

const thClass = "sticky top-0 z-[1] bg-surface py-2 text-left text-xs font-medium text-fg-3";

function MovementTable({ tab, list, empty, error, busyId, onCheckIn, onCheckOut }: Omit<TodayMovementProps, "lists"> & { tab: MovementTab; list: MovementList; empty: string; error: string }) {
  if (list.status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 pt-2">
        <span className="sr-only">Carregando</span>
        {[0, 1, 2].map((row) => <span key={row} aria-hidden="true" className="h-10 animate-pulse rounded-bar bg-muted" />)}
      </div>
    );
  }
  if (list.status === "error") return <p role="alert" className="m-0 py-6 text-[13px] text-danger">{error}</p>;
  if (list.items.length === 0) return <p className="m-0 py-6 text-[13px] text-fg-3">{empty}</p>;

  return (
    <table className="w-full min-w-[520px] border-collapse">
      <thead>
        <tr>
          <th scope="col" className={thClass}>{tab === "staying" ? "Saída" : "Hora"}</th>
          <th scope="col" className={thClass}>Hóspede</th>
          <th scope="col" className={thClass}>Quarto</th>
          <th scope="col" className={thClass}>Situação</th>
          <th scope="col" className={thClass}><span className="sr-only">Ação</span></th>
        </tr>
      </thead>
      <tbody>
        {sortRows(tab, list.items).map((reservation) => {
          const action = nextAction(tab, reservation.status);
          const done = isDone(tab, reservation.status);
          const people = reservationPeople(reservation);
          const name = reservation.client?.fullName ?? reservation.client?.name ?? "Hóspede";
          const busy = busyId === reservation.id;
          return (
            <tr key={reservation.id} className="border-t border-rule">
              <td className="w-[72px] py-2.5 font-mono text-[13px] text-fg-2">
                {tab === "arrivals" ? "14:00" : tab === "departures" ? "12:00" : formatDayMonth(reservation.checkOutDate)}
              </td>
              <td className="py-2.5">
                <span className="flex flex-col">
                  <span className={cx("font-medium", done ? "text-fg-2" : "text-fg")}>{name}</span>
                  <span className="text-xs text-fg-3">{people} {people === 1 ? "pessoa" : "pessoas"}</span>
                </span>
              </td>
              <td className="py-2.5">
                <span className="flex flex-col">
                  <span className={cx("font-mono text-[13px]", done && "text-fg-2")}>{roomLabel(reservation)}</span>
                  {reservation.room?.type && <span className="text-xs text-fg-3">{reservation.room.type}</span>}
                </span>
              </td>
              <td className="py-2.5"><ReservationStatusChip status={reservation.status} /></td>
              <td className="py-2.5 pl-4 text-right">
                {action === "open" ? (
                  <Link href={`/reservas?reserva=${reservation.id}`} className={buttonClasses("outline", "sm")} aria-label={`Abrir reserva de ${name}`}>Abrir</Link>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => (action === "checkin" ? onCheckIn(reservation) : onCheckOut(reservation))}
                    aria-label={`${action === "checkin" ? "Check-in" : "Check-out"} de ${name}`}
                  >
                    {busy ? "Aguarde…" : action === "checkin" ? "Check-in" : "Check-out"}
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Chegadas, saídas e hospedados com a ação do próximo passo na própria linha.
export default function TodayMovement({ lists, busyId, onCheckIn, onCheckOut }: TodayMovementProps) {
  const [tab, setTab] = useState<MovementTab>("arrivals");

  return (
    <section aria-labelledby="movimento" className="flex min-w-0 flex-col min-[900px]:min-h-0">
      <Tabs value={tab} onValueChange={(value) => setTab(value as MovementTab)} className="flex flex-col gap-3 min-[900px]:min-h-0 min-[900px]:flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="movimento" className="m-0 text-[15px] font-semibold">Movimento de hoje</h2>
          <TabsList aria-label="Filtrar movimento">
            {TABS.map((item) => (
              <TabsTrigger key={item.key} value={item.key}>
                {item.label}
                {lists[item.key].status === "ready" && <span className="font-mono">{lists[item.key].items.length}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map((item) => (
          <TabsContent key={item.key} value={item.key} className="overflow-x-auto min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-auto">
            <MovementTable tab={item.key} list={lists[item.key]} empty={item.empty} error={item.error} busyId={busyId} onCheckIn={onCheckIn} onCheckOut={onCheckOut} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
