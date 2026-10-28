"use client";

import { useState } from "react";
import { Archive, CalendarPlus, Pencil } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { apiErrorMessage } from "../../utils/api-error";
import type { ReservationStatus } from "../../types/reservations";
import { formatCPF } from "../../utils/cpf";
import { deactivateRecord } from "../../utils/deactivation";
import { formatCurrency, formatStayPeriod } from "../../utils/format";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { ReservationStatusChip } from "../ui/StatusChip";
import { toast } from "../ui/Toast";
import { currentStayLabel, initials, roomLabel, splitStays, stayPeople, stayTotals, vehicleLabel, type GuestClient, type GuestStay } from "./hospedes-data";

interface GuestProfileProps {
  client: GuestClient;
  today: string;
  onEdit: () => void;
  onNewReservation: () => void;
  onDeactivated: (clientId: string) => void;
}

const sectionTitle = "m-0 text-[13px] font-semibold text-fg-2";

function peopleLabel(stay: GuestStay) {
  const people = stayPeople(stay);
  return `${people} ${people === 1 ? "pessoa" : "pessoas"}`;
}

// Uma linha por reserva: quarto e período à esquerda, valor à direita; categoria, pessoas e acompanhantes embaixo.
function StayRow({ stay }: { stay: GuestStay }) {
  const companions = (stay.guests ?? []).map((guest) => guest.name).filter(Boolean);
  const showChip = stay.status !== "Concluída" && stay.status !== "Concluida";
  return (
    <li className="flex flex-col gap-0.5 border-b border-rule py-2.5 text-[13px]">
      <div className="flex items-center justify-between gap-2.5">
        <span className="min-w-0 truncate">
          <span className="font-mono">{roomLabel(stay)}</span> · <span className="font-mono">{formatStayPeriod(stay.checkInDate, stay.checkOutDate)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {showChip && <ReservationStatusChip status={stay.status as ReservationStatus} />}
          <span className="font-mono text-fg-2">{formatCurrency(stay.totalPrice)}</span>
        </span>
      </div>
      <span className="text-xs text-fg-3" title={companions.length ? `Acompanhantes: ${companions.join(", ")}` : undefined}>
        {[stay.room?.categoryName, peopleLabel(stay)].filter(Boolean).join(" · ")}
        {companions.length > 0 && ` · com ${companions.join(", ")}`}
      </span>
    </li>
  );
}

export default function GuestProfile({ client, today, onEdit, onNewReservation, onDeactivated }: GuestProfileProps) {
  const { current, upcoming, history } = splitStays(client.reservations, today);
  const totals = stayTotals(client.reservations);
  // Só o gerente desativa. Reserva futura ou em casa impede (o backend responde 409 com o motivo).
  const { user } = useCurrentUser();
  const canDeactivate = user?.role === "admin";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      await deactivateRecord("client", client.id);
      toast.success(`${client.fullName} desativado.`);
      setConfirmOpen(false);
      onDeactivated(client.id);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Não foi possível desativar o hóspede."));
      setConfirmOpen(false);
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <aside aria-label="Ficha do hóspede" className="flex w-full min-w-0 flex-col gap-5 rounded-block bg-command-bg p-5 min-[1100px]:min-h-0 min-[1100px]:w-[340px] min-[1100px]:shrink-0 min-[1100px]:overflow-y-auto">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
          {initials(client.fullName)}
        </span>
        <h2 className="m-0 min-w-0 text-[17px] font-semibold tracking-[-0.01em] break-words">{client.fullName}</h2>
      </div>

      <div className="flex gap-1.5">
        <Button variant="primary" size="sm" className="flex-1" onClick={onNewReservation}>
          <CalendarPlus aria-hidden="true" />
          Nova reserva
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
        {canDeactivate && (
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            <Archive aria-hidden="true" />
            Desativar
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Desativar hóspede?"
        description={<><strong>{client.fullName}</strong> sai da lista e da nova reserva. Estadias e histórico continuam guardados, e o gerente pode reativar em Desativados.</>}
        confirmLabel="Desativar"
        tone="danger"
        busy={deactivating}
        onConfirm={handleDeactivate}
      />

      <dl className="m-0 grid grid-cols-3 gap-2">
        <div className="flex flex-col-reverse gap-0.5"><dt className="text-xs text-fg-3">Estadias</dt><dd className="m-0 font-mono text-lg font-medium">{totals.stays}</dd></div>
        <div className="flex flex-col-reverse gap-0.5"><dt className="text-xs text-fg-3">Noites</dt><dd className="m-0 font-mono text-lg font-medium">{totals.nights}</dd></div>
        <div className="flex min-w-0 flex-col-reverse gap-0.5"><dt className="text-xs text-fg-3">Total</dt><dd className="m-0 truncate font-mono text-lg font-medium" title={formatCurrency(totals.total)}>{formatCurrency(totals.total)}</dd></div>
      </dl>

      {current && (
        <div className="flex flex-col gap-1.5 rounded-block border border-rule bg-surface p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-accent">{currentStayLabel(current, today)}</span>
            <ReservationStatusChip status={current.status as ReservationStatus} />
          </div>
          <span className="font-medium">
            <span className="font-mono">{roomLabel(current)}</span> · <span className="font-mono">{formatStayPeriod(current.checkInDate, current.checkOutDate)}</span>
          </span>
          <span className="text-[13px] text-fg-2">
            {[current.room?.categoryName, peopleLabel(current)].filter(Boolean).join(" · ")} · <span className="font-mono">{formatCurrency(current.totalPrice)}</span>
          </span>
        </div>
      )}

      <section aria-labelledby="ficha-contato" className="flex flex-col gap-2">
        <h3 id="ficha-contato" className={sectionTitle}>Contato e documentos</h3>
        <dl className="m-0 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-fg-3">Telefone</dt><dd className="m-0 font-mono">{client.fone || "—"}</dd>
          <dt className="text-fg-3">E-mail</dt><dd className="m-0 truncate" title={client.email || undefined}>{client.email || "—"}</dd>
          <dt className="text-fg-3">CPF</dt><dd className="m-0 font-mono">{formatCPF(client.cpf)}</dd>
          <dt className="text-fg-3">Veículo</dt><dd className="m-0">{vehicleLabel(client)}</dd>
        </dl>
      </section>

      {upcoming.length > 0 && (
        <section aria-labelledby="ficha-proximas" className="flex flex-col">
          <h3 id="ficha-proximas" className={sectionTitle}>Próximas reservas</h3>
          <ul className="m-0 list-none p-0">{upcoming.map((stay) => <StayRow key={stay.id} stay={stay} />)}</ul>
        </section>
      )}

      <section aria-labelledby="ficha-historico" className="flex flex-col">
        <h3 id="ficha-historico" className={sectionTitle}>Histórico</h3>
        {history.length === 0
          ? <p className="m-0 py-2.5 text-[13px] text-fg-3">Nenhuma estadia anterior.</p>
          : <ul className="m-0 list-none p-0">{history.map((stay) => <StayRow key={stay.id} stay={stay} />)}</ul>}
      </section>
    </aside>
  );
}
