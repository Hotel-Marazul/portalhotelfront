"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ReservationDto, ReservationPricingDto } from "../../types/reservations";
import { calculateNights, formatCurrency, formatNights, formatStayPeriod } from "../../utils/format";
import Button from "../ui/Button";
import DatePicker from "../ui/DatePicker";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { priceLines } from "./reserva-data";

export type MealPlan = "breakfast" | "half_board";

export interface ResumoEdit {
  checkIn: Date | null;
  checkOut: Date | null;
  mealPlan: MealPlan;
  dailyRateOverride: string;
  discountAmount: string;
  priceOverrideReason: string;
  onCheckIn: (date: Date | null) => void;
  onCheckOut: (date: Date | null) => void;
  onMealPlan: (value: MealPlan) => void;
  onDailyRate: (value: string) => void;
  onDiscount: (value: string) => void;
  onReason: (value: string) => void;
  /** Só quando a reserva já tem diária ajustada. */
  onUseCategoryRate?: () => void;
  quotePending: boolean;
  quoteError: string | null;
}

interface Props {
  reservation: ReservationDto;
  /** Preço exibido: o salvo, ou a cotação nova durante a edição. */
  pricing: ReservationPricingDto | null | undefined;
  edit: ResumoEdit | null;
}

const MEAL_LABELS: Record<MealPlan, string> = { breakfast: "Só café da manhã", half_board: "Meia pensão" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-3">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  );
}

export default function ReservaResumo({ reservation, pricing, edit }: Props) {
  const room = reservation.room;
  const roomText = room ? [room.displayNumber ?? (room.number !== undefined ? String(room.number) : room.name), room.type].filter(Boolean) : [];
  const total = pricing?.totalPrice ?? reservation.totalPrice;
  const clientName = reservation.client?.fullName || reservation.client?.name;
  // O backend já devolve o CPF mascarado.
  const cpf = reservation.client?.cpf;
  const adjusting = edit && (edit.dailyRateOverride.trim() !== "" || Number(edit.discountAmount) > 0);

  return (
    <div className="flex flex-col gap-5">
      <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2.5 text-[13px]">
        {!edit && (
          <Row label="Período">
            {formatStayPeriod(reservation.checkInDate, reservation.checkOutDate)} · {formatNights(calculateNights(reservation.checkInDate, reservation.checkOutDate))}
          </Row>
        )}
        <Row label="Quarto">
          {roomText.length ? <><span className="font-mono">{roomText[0]}</span>{roomText[1] ? ` · ${roomText[1]}` : ""}</> : "—"}
        </Row>
        {!edit && <Row label="Alimentação">{pricing?.mealPlan ? MEAL_LABELS[pricing.mealPlan] : "—"}</Row>}
      </dl>

      {edit && (
        <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          <Field label="Check-in">
            <DatePicker value={edit.checkIn} onChange={edit.onCheckIn} />
          </Field>
          <Field label="Check-out" hint={edit.checkIn && edit.checkOut && edit.checkOut > edit.checkIn ? formatNights(calculateNights(edit.checkIn, edit.checkOut)) : undefined}>
            <DatePicker value={edit.checkOut} onChange={edit.onCheckOut} minDate={edit.checkIn ?? undefined} />
          </Field>
          <Field label="Alimentação" className="col-span-2 max-[480px]:col-span-1">
            <Select value={edit.mealPlan} onChange={(event) => edit.onMealPlan(event.target.value as MealPlan)}>
              <option value="breakfast">Só café</option>
              <option value="half_board">Meia pensão</option>
            </Select>
          </Field>
        </div>
      )}

      <section aria-labelledby="reserva-preco" className="flex flex-col gap-2 rounded-block bg-bg p-3.5">
        <h3 id="reserva-preco" className="m-0 text-[13px] font-semibold text-fg-2">Preço</h3>
        {edit && edit.quotePending && <p role="status" className="m-0 text-[13px] text-fg-3">Calculando…</p>}
        {edit && edit.quoteError && <p role="alert" className="m-0 text-[13px] text-danger">{edit.quoteError}</p>}
        {pricing ? (
          <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-[13px]">
            {priceLines(pricing).map((line, index) => (
              <div key={line.label} className="contents">
                <dt className={index === 0 ? "" : "text-fg-3"}>
                  {index === 0 ? <>{line.label} × <span className="font-mono">{formatCurrency(pricing.dailyRate)}</span></> : line.label}
                  {line.adjusted && <span className="text-warn"> · diária ajustada</span>}
                </dt>
                <dd className={line.value === null ? "m-0 text-right font-mono text-fg-3" : "m-0 text-right font-mono"}>
                  {line.value === null ? "—" : formatCurrency(line.value)}
                </dd>
              </div>
            ))}
            <dt className="border-t border-border-soft pt-2 font-semibold">Total</dt>
            <dd className="m-0 border-t border-border-soft pt-2 text-right font-mono font-medium">{formatCurrency(total)}</dd>
          </dl>
        ) : (
          <>
            <p className="m-0 text-[13px] text-fg-2">O detalhamento será calculado pelo servidor ao salvar esta reserva.</p>
            {!edit && typeof reservation.totalPrice === "number" && (
              <p className="m-0 flex justify-between text-[13px]"><span className="font-semibold">Total</span><span className="font-mono">{formatCurrency(reservation.totalPrice)}</span></p>
            )}
          </>
        )}
        {!edit && pricing?.priceSource === "manual" && (
          <p className="m-0 text-xs leading-relaxed text-warn-fg">
            Diária ajustada para {formatCurrency(pricing.dailyRate)}{pricing.overrideReason ? `: “${pricing.overrideReason}”.` : "."}
          </p>
        )}
        {!edit && pricing?.priceSource !== "manual" && pricing?.overrideReason && (
          <p className="m-0 text-xs leading-relaxed text-fg-2">Motivo do desconto: “{pricing.overrideReason}”.</p>
        )}
      </section>

      {edit && (
        <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          <Field label="Diária aplicada (opcional)" hint="Vazia usa a tarifa da categoria; preenchida vale somente para esta reserva.">
            <Input type="number" min={0.01} step="0.01" className="[&_input]:font-mono" value={edit.dailyRateOverride} onChange={(event) => edit.onDailyRate(event.target.value)} />
          </Field>
          <Field label="Desconto total (opcional)">
            <Input type="number" min={0} step="0.01" className="[&_input]:font-mono" value={edit.discountAmount} onChange={(event) => edit.onDiscount(event.target.value)} />
          </Field>
          {adjusting && (
            <Field label="Motivo do ajuste" required hint="Fica registrado com o usuário que lançou a alteração." className="col-span-2 max-[480px]:col-span-1">
              <Input value={edit.priceOverrideReason} onChange={(event) => edit.onReason(event.target.value)} />
            </Field>
          )}
          {edit.onUseCategoryRate && (
            <Button variant="ghost" size="sm" className="col-span-2 justify-self-start text-accent max-[480px]:col-span-1" onClick={edit.onUseCategoryRate}>
              Usar tarifa da categoria
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="reserva-cliente" className="flex flex-col gap-1.5">
        <h3 id="reserva-cliente" className="m-0 text-[13px] font-semibold text-fg-2">Cliente</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{clientName || "—"}</span>
            {cpf && <span className="text-xs text-fg-3">CPF <span className="font-mono">{cpf}</span></span>}
          </span>
          {reservation.clientId && (
            <Link href={`/cliente?cliente=${encodeURIComponent(reservation.clientId)}`} className="shrink-0 text-[13px] text-accent no-underline hover:underline">
              Ver ficha
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
