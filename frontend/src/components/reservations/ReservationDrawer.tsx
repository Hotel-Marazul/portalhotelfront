"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import apiClient from "../../services/api";
import type { GuestForm, PricingRule, ReservationDto, ReservationPaymentDto, ReservationStatus } from "../../types/reservations";
import { apiErrorMessage } from "../../utils/api-error";
import { calculateNights, formatCurrency, formatNights, formatStayPeriod } from "../../utils/format";
import { getIdempotencyAttempt, type IdempotencyAttempt } from "../../utils/idempotency";
import { formatReservationPickerDate, parseReservationPickerDate } from "../../utils/reservation";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useReservationQuote } from "../../hooks/useReservationQuote";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Sheet from "../ui/Sheet";
import { ReservationStatusChip } from "../ui/StatusChip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import { toast } from "../ui/Toast";
import { cx } from "../ui/cx";
import GuestListEditor from "./GuestListEditor";
import ReservaHistorico from "../reserva/ReservaHistorico";
import ReservaPagamentos, { type PaymentFormState } from "../reserva/ReservaPagamentos";
import ReservaResumo, { type MealPlan } from "../reserva/ReservaResumo";
import {
  INCLUDED_ADDITIONAL_GUESTS,
  canCancel,
  canEdit,
  defaultPaymentStage,
  financialSummary,
  needsBalanceWarning,
  nextStep,
  parseMoneyInput,
  progressSteps,
  validatePaymentAmount,
  validateReservationEdit,
} from "../reserva/reserva-data";

interface ReservationDrawerProps {
  open: boolean;
  reservation: ReservationDto | null;
  mode: "view" | "edit";
  onClose: () => void;
  onSave: (reservation: ReservationDto) => void;
  onStatusChange: (reservationId: string, status: ReservationStatus) => Promise<void>;
}

type TabKey = "resumo" | "hospedes" | "pagamentos" | "historico";

// A lista não traz os agregados financeiros; o detalhe (GET por id, transições, pagamentos) traz.
const isDetail = (reservation: ReservationDto) => typeof reservation.totalPaid === "number" && Array.isArray(reservation.payments);

const toMoneyInput = (value: number) => value.toFixed(2).replace(".", ",");

function emptyPaymentForm(reservation: ReservationDto): PaymentFormState {
  const balance = isDetail(reservation) ? reservation.balanceDue ?? 0 : 0;
  return { stage: defaultPaymentStage(reservation.status), method: "Pix", amount: balance > 0 ? toMoneyInput(balance) : "", note: "" };
}

export default function ReservationDrawer({
  open,
  reservation,
  mode,
  onClose,
  onSave,
  onStatusChange,
}: ReservationDrawerProps) {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<TabKey>("resumo");
  const [editing, setEditing] = useState(mode === "edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulário de edição
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState<GuestForm[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlan>("breakfast");
  const [dailyRateOverride, setDailyRateOverride] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [priceOverrideReason, setPriceOverrideReason] = useState("");
  const [clearDailyRateOverride, setClearDailyRateOverride] = useState(false);
  const [pricingRules, setPricingRules] = useState<PricingRule[] | null>(null);
  const [updateAttempt, setUpdateAttempt] = useState<IdempotencyAttempt | null>(null);
  const saveSubmittingRef = useRef(false);

  // Detalhe financeiro e pagamentos
  const [detail, setDetail] = useState<ReservationDto | null>(null);
  const [payments, setPayments] = useState<ReservationPaymentDto[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({ stage: "Confirmacao", method: "Pix", amount: "", note: "" });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentAttempt, setPaymentAttempt] = useState<IdempotencyAttempt | null>(null);
  const reversalAttempts = useRef(new Map<string, IdempotencyAttempt>());
  const paymentsRequestId = useRef(0);
  const paymentSubmittingRef = useRef(false);

  // Andamento
  const [statusLoading, setStatusLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [concludeBalance, setConcludeBalance] = useState<number | null>(null);
  const statusSubmittingRef = useRef(false);

  const reservationId = reservation?.id ?? null;

  // Outra reserva: volta ao Resumo e ao modo pedido pela tela.
  useEffect(() => {
    setTab("resumo");
    setEditing(mode === "edit");
    setPricingRules(null);
    reversalAttempts.current.clear();
  }, [reservationId, mode]);

  function resetForm(source: ReservationDto) {
    setCheckInDate(parseReservationPickerDate(source.checkInDate));
    setCheckOutDate(parseReservationPickerDate(source.checkOutDate));
    setGuests(source.guests.map((g) => ({ id: g.id, name: g.name, age: g.age, pricingRuleId: g.pricingRuleId || null })));
    setMealPlan(source.pricing?.mealPlan ?? "breakfast");
    setDailyRateOverride(source.pricing?.priceSource === "manual" ? source.pricing.dailyRate.toFixed(2) : "");
    setDiscountAmount(source.pricing && source.pricing.discountAmount > 0 ? source.pricing.discountAmount.toFixed(2) : "");
    setPriceOverrideReason(source.pricing?.overrideReason ?? "");
    setClearDailyRateOverride(false);
    setUpdateAttempt(null);
  }

  // Inicializa o formulário quando a reserva muda
  useEffect(() => {
    if (!reservation) return;
    resetForm(reservation);
    setError(null);
    setPaymentError(null);
    setPaymentAttempt(null);
    setPaymentForm(emptyPaymentForm(reservation));
  }, [reservation]);

  // Carrega o detalhe (total, pago, saldo, lançamentos e última alteração). Se a reserva já veio detalhada, usa ela.
  useEffect(() => {
    if (!open || !reservation) {
      paymentsRequestId.current += 1;
      setDetail(null);
      setPayments([]);
      setPaymentsError(null);
      setPaymentsLoading(false);
      return;
    }
    if (isDetail(reservation)) {
      paymentsRequestId.current += 1;
      setDetail(reservation);
      setPayments(reservation.payments ?? []);
      setPaymentsError(null);
      setPaymentsLoading(false);
      return;
    }

    const requestId = ++paymentsRequestId.current;
    let active = true;
    setDetail(null);
    setPayments([]);
    setPaymentsError(null);
    setPaymentsLoading(true);

    apiClient
      .get<ReservationDto>(`/api/reservations/${reservation.id}`)
      .then((response) => {
        if (!active || requestId !== paymentsRequestId.current) return;
        if (!isDetail(response.data)) throw new Error("Resposta de pagamentos inválida");
        setDetail(response.data);
        setPayments(response.data.payments ?? []);
        setPaymentForm((prev) => (prev.amount ? prev : emptyPaymentForm(response.data)));
      })
      .catch((err) => {
        if (!active || requestId !== paymentsRequestId.current) return;
        setPayments([]);
        setPaymentsError(apiErrorMessage(err, "Não foi possível carregar o histórico de pagamentos."));
      })
      .finally(() => {
        if (active && requestId === paymentsRequestId.current) setPaymentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, reservation]);

  // Regras de preço por idade só são precisas na edição.
  useEffect(() => {
    if (!open || !editing || pricingRules) return;
    let active = true;
    apiClient
      .get<PricingRule[]>("/api/pricing-rules")
      .then((response) => { if (active) setPricingRules(Array.isArray(response.data) ? response.data : []); })
      .catch((err) => { if (active) setError(apiErrorMessage(err, "Não foi possível carregar as regras de preço.")); });
    return () => { active = false; };
  }, [open, editing, pricingRules]);

  const quote = useReservationQuote(open && editing && reservation &&
    checkInDate && !Number.isNaN(checkInDate.getTime()) && checkOutDate && !Number.isNaN(checkOutDate.getTime()) &&
    guests.every((guest) => (guest.name.trim() === "" || guest.name.trim().length >= 2) && (guest.age === null || guest.age >= 0))
    ? {
      reservationId: reservation.id, roomId: reservation.roomId, clientId: reservation.clientId,
      checkInDate: formatReservationPickerDate(checkInDate), checkOutDate: formatReservationPickerDate(checkOutDate),
      guests, mealPlan, clearDailyRateOverride,
      ...(dailyRateOverride.trim() ? { dailyRateOverride: Number(dailyRateOverride) } : {}),
      discountAmount: Number(discountAmount || 0),
      ...(priceOverrideReason.trim() ? { priceOverrideReason: priceOverrideReason.trim() } : {})
    } : null);

  if (!reservation) return null;

  const current = detail ?? reservation;
  const summary = financialSummary(detail);
  const status = current.status;
  const step = nextStep(status);
  const showBalanceWarning = needsBalanceWarning(status, summary?.balance);
  const people = 1 + (editing ? guests.length : current.guests.length);
  const clientName = current.client?.fullName || current.client?.name || "Reserva";
  const roomNumber = current.room?.displayNumber ?? (current.room?.number !== undefined ? String(current.room.number) : null);

  // Na leitura, o nome da regra vem da própria reserva; na edição, da lista de regras.
  const viewRules: PricingRule[] = current.guests.flatMap((g) => g.pricingRule
    ? [{ id: g.pricingRule.id, name: g.pricingRule.name, description: g.pricingRule.description, price: g.pricingRule.price ?? 0 }]
    : []);

  const handleAddGuest = () => {
    setGuests([...guests, { name: "", age: 0, pricingRuleId: guests.length >= INCLUDED_ADDITIONAL_GUESTS ? "" : null }]);
  };

  const handleGuestChange = (index: number, field: keyof GuestForm, value: string | number | null) => {
    setGuests((prev) => prev.map((guest, i) => (i === index ? { ...guest, [field]: value } : guest)));
  };

  function stopEditing() {
    if (mode === "edit") {
      onClose();
      return;
    }
    resetForm(current);
    setError(null);
    setEditing(false);
  }

  const handleSave = async () => {
    if (!reservation || saveSubmittingRef.current || !quote.pricing) return;

    const validation = validateReservationEdit({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests,
      requireGuestNames: current.status === "EmAndamento",
      dailyRateOverride,
      discountAmount,
      priceOverrideReason,
      hadPricing: Boolean(reservation.pricing),
    });
    if ("error" in validation) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    saveSubmittingRef.current = true;
    setError(null);

    try {
      const updateData = {
        id: reservation.id,
        mealPlan,
        roomId: reservation.roomId,
        clientId: reservation.clientId,
        checkInDate: formatReservationPickerDate(checkInDate!),
        checkOutDate: formatReservationPickerDate(checkOutDate!),
        version: current.version,
        guests: guests.map((g) => ({ name: g.name, age: g.age, pricingRuleId: g.pricingRuleId || null })),
        ...(validation.dailyRate !== undefined ? { dailyRateOverride: validation.dailyRate } : {}),
        ...(validation.discount !== undefined ? { discountAmount: validation.discount } : {}),
        ...(priceOverrideReason.trim() ? { priceOverrideReason: priceOverrideReason.trim() } : {}),
        ...(clearDailyRateOverride ? { clearDailyRateOverride: true } : {})
      };
      const attempt = getIdempotencyAttempt(updateAttempt, updateData);
      setUpdateAttempt(attempt);

      const response = await apiClient.put<ReservationDto>(`/api/reservations/${reservation.id}`, {
        ...updateData,
        idempotencyKey: attempt.key
      });
      setUpdateAttempt(null);
      onSave(response.data);
      toast.success("Reserva atualizada.");
      if (mode === "edit") onClose();
      else setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Erro ao salvar reserva"));
    } finally {
      saveSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ReservationStatus) => {
    if (statusSubmittingRef.current) return;
    setStatusLoading(true);
    statusSubmittingRef.current = true;
    setError(null);
    try {
      await onStatusChange(reservation.id, newStatus);
      setConfirmCancel(false);
      setConcludeBalance(null);
    } catch (err) {
      setConfirmCancel(false);
      setConcludeBalance(null);
      setError(apiErrorMessage(err, "Erro ao alterar status"));
    } finally {
      statusSubmittingRef.current = false;
      setStatusLoading(false);
    }
  };

  // Antes de concluir, confere o saldo: concluir com saldo pede confirmação e não apaga o que falta receber.
  const handleNextStep = async () => {
    if (!step || statusSubmittingRef.current) return;
    if (step.target !== "Concluída") {
      await handleStatusChange(step.target);
      return;
    }
    let balance = summary?.balance;
    if (balance === undefined) {
      setStatusLoading(true);
      try {
        const { data } = await apiClient.get<ReservationDto>(`/api/reservations/${reservation.id}`);
        balance = data.balanceDue ?? 0;
      } catch (err) {
        setStatusLoading(false);
        setError(apiErrorMessage(err, "Não foi possível conferir o saldo da reserva."));
        return;
      }
      setStatusLoading(false);
    }
    if (balance > 0) {
      setConcludeBalance(balance);
      return;
    }
    await handleStatusChange("Concluída");
  };

  function applyUpdatedReservation(updated: ReservationDto) {
    setDetail(updated);
    setPayments(updated.payments ?? []);
    setPaymentsError(null);
    onSave(updated);
  }

  const handleRegisterPayment = async () => {
    if (paymentSubmittingRef.current) return;

    const invalid = validatePaymentAmount(paymentForm.amount);
    if (invalid) {
      setPaymentError(invalid);
      return;
    }
    const amount = parseMoneyInput(paymentForm.amount);

    setPaymentLoading(true);
    paymentSubmittingRef.current = true;
    setPaymentError(null);
    const attempt = getIdempotencyAttempt(paymentAttempt, { ...paymentForm, amount });
    setPaymentAttempt(attempt);

    try {
      const response = await apiClient.post<{ reservation: ReservationDto }>(`/api/reservations/${reservation.id}/payments`, {
        stage: paymentForm.stage,
        method: paymentForm.method,
        amount,
        note: paymentForm.note,
        idempotencyKey: attempt.key
      });
      setPaymentAttempt(null);
      toast.success(`Pagamento de ${formatCurrency(amount)} registrado.`);
      if (response.data?.reservation) applyUpdatedReservation(response.data.reservation);
    } catch (err) {
      setPaymentError(apiErrorMessage(err, "Erro ao registrar pagamento"));
    } finally {
      paymentSubmittingRef.current = false;
      setPaymentLoading(false);
    }
  };

  const handleReversePayment = async (payment: ReservationPaymentDto, amount: number, reason: string) => {
    if (paymentSubmittingRef.current) return false;
    paymentSubmittingRef.current = true;
    setPaymentError(null);
    const attempt = getIdempotencyAttempt(reversalAttempts.current.get(payment.id) ?? null, { paymentId: payment.id, amount, reason });
    reversalAttempts.current.set(payment.id, attempt);
    try {
      const response = await apiClient.post<{ reservation: ReservationDto }>(
        `/api/reservations/${reservation.id}/payments/${payment.id}/reverse`,
        { amount, reason, idempotencyKey: attempt.key },
      );
      reversalAttempts.current.delete(payment.id);
      toast.success(`Estorno de ${formatCurrency(amount)} registrado.`);
      if (response.data?.reservation) applyUpdatedReservation(response.data.reservation);
      return true;
    } catch (err) {
      setPaymentError(apiErrorMessage(err, "Erro ao estornar pagamento"));
      return false;
    } finally {
      paymentSubmittingRef.current = false;
    }
  };

  const description = [
    roomNumber ? `Quarto ${roomNumber}` : null,
    current.room?.type || null,
    formatStayPeriod(current.checkInDate, current.checkOutDate),
    formatNights(calculateNights(current.checkInDate, current.checkOutDate)),
    `${people} ${people === 1 ? "pessoa" : "pessoas"}`,
  ].filter(Boolean).join(" · ");

  const resumoEdit = editing
    ? {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      mealPlan,
      dailyRateOverride,
      discountAmount,
      priceOverrideReason,
      onCheckIn: setCheckInDate,
      onCheckOut: setCheckOutDate,
      onMealPlan: setMealPlan,
      onDailyRate: (value: string) => { setDailyRateOverride(value); setClearDailyRateOverride(false); },
      onDiscount: setDiscountAmount,
      onReason: setPriceOverrideReason,
      onUseCategoryRate: current.pricing?.priceSource === "manual"
        ? () => {
          setDailyRateOverride("");
          setClearDailyRateOverride(true);
          if (!(current.pricing?.discountAmount ?? 0)) setPriceOverrideReason("");
        }
        : undefined,
      quotePending: quote.pending,
      quoteError: quote.error,
    }
    : null;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={clientName}
        description={description}
        closeLabel="Fechar reserva"
        headerAside={(
          <span className="flex shrink-0 items-center gap-2 pt-1.5">
            <span className="font-mono text-xs text-fg-3">{current.id.substring(0, 8).toUpperCase()}</span>
            <ReservationStatusChip status={status} />
          </span>
        )}
        footer={editing ? (
          <>
            <Button variant="ghost" disabled={loading} onClick={stopEditing}>Descartar</Button>
            <Button variant="primary" disabled={loading || !quote.pricing} onClick={() => void handleSave()}>
              {loading ? "Salvando…" : "Salvar alterações"}
            </Button>
          </>
        ) : undefined}
      >
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          {/* Andamento, ações e abas ficam presos no topo enquanto o conteúdo rola. */}
          <div className="sticky -top-5 z-[2] -mx-6 -mt-5 mb-5 flex flex-col gap-3 bg-surface px-6 pt-4">
            <ol aria-label="Andamento da reserva" className="m-0 grid list-none grid-cols-4 gap-1 p-0">
              {progressSteps(status).map((item) => (
                <li
                  key={item.label}
                  aria-current={item.state === "current" ? "step" : undefined}
                  className={cx("flex flex-col gap-1.5 text-xs", item.state === "todo" ? "text-fg-3" : "text-fg", item.state === "current" && "font-semibold")}
                >
                  <span aria-hidden="true" className={cx("h-1 rounded-sm", item.state === "done" ? "bg-accent" : item.state === "current" ? "bg-fg" : "bg-border-soft")} />
                  {item.label}
                </li>
              ))}
            </ol>
            {status === "Cancelada" && <p className="m-0 text-xs text-danger">Reserva cancelada.</p>}

            {!editing && (step || canEdit(status) || canCancel(status)) && (
              <div className="flex flex-wrap gap-1.5">
                {step && (
                  <Button variant="primary" size="sm" disabled={statusLoading} onClick={() => void handleNextStep()}>
                    {step.label}
                  </Button>
                )}
                {canEdit(status) && (
                  <Button size="sm" disabled={statusLoading} onClick={() => { setEditing(true); setTab("resumo"); }}>
                    <Pencil aria-hidden="true" />
                    Editar
                  </Button>
                )}
                {canCancel(status) && (
                  <Button variant="ghost" size="sm" className="hover:text-danger" disabled={statusLoading} onClick={() => setConfirmCancel(true)}>
                    Cancelar reserva
                  </Button>
                )}
              </div>
            )}
            {!editing && showBalanceWarning && summary && (
              <p className="m-0 text-xs text-danger">
                Saldo de <span className="font-mono">{formatCurrency(summary.balance)}</span> em aberto. Receba antes de concluir, ou conclua e deixe o saldo pendente.
              </p>
            )}
            {editing && <p className="m-0 text-xs text-fg-2">Editando datas, alimentação, preço e hóspedes. O total é recalculado pelo servidor.</p>}
            {error && <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}

            <TabsList variant="line" aria-label="Partes da reserva" className="-mx-6 overflow-x-auto px-4">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="hospedes">Hóspedes <span className="font-mono">{people}</span></TabsTrigger>
              <TabsTrigger value="pagamentos">
                Pagamentos{summary && summary.balance > 0 && status !== "Cancelada" ? " · saldo" : ""}
              </TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resumo">
            <ReservaResumo reservation={current} pricing={editing ? quote.pricing : current.pricing} edit={resumoEdit} />
          </TabsContent>

          <TabsContent value="hospedes">
            <GuestListEditor
              guests={editing ? guests : current.guests.map((g) => ({ id: g.id, name: g.name, age: g.age, pricingRuleId: g.pricingRuleId || null }))}
              onGuestChange={handleGuestChange}
              onAddGuest={handleAddGuest}
              onRemoveGuest={(index) => setGuests((prev) => prev.filter((_, i) => i !== index))}
              pricingRules={editing ? pricingRules ?? [] : viewRules}
              readonly={!editing}
              holderName={current.client?.fullName || current.client?.name || "Cliente"}
            />
          </TabsContent>

          <TabsContent value="pagamentos">
            <ReservaPagamentos
              summary={summary}
              financialException={detail?.financialException ?? null}
              payments={payments}
              loading={paymentsLoading}
              loadError={paymentsError}
              canReceive={status !== "Cancelada" && !!summary && summary.balance > 0}
              form={paymentForm}
              onFormChange={(patch) => setPaymentForm((prev) => ({ ...prev, ...patch }))}
              submitting={paymentLoading}
              actionError={paymentError}
              onRegister={() => void handleRegisterPayment()}
              onReverse={user?.role === "admin" ? handleReversePayment : undefined}
            />
          </TabsContent>

          <TabsContent value="historico">
            <ReservaHistorico audit={detail?.audit ?? reservation.audit} loading={paymentsLoading && !reservation.audit} />
          </TabsContent>
        </Tabs>
      </Sheet>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar esta reserva?"
        description={`Tem certeza que deseja cancelar a reserva de ${clientName}? O quarto fica livre e a reserva não pode voltar.`}
        confirmLabel="Cancelar reserva"
        tone="danger"
        busy={statusLoading}
        onConfirm={() => void handleStatusChange("Cancelada")}
      />

      <ConfirmDialog
        open={concludeBalance !== null}
        onOpenChange={(next) => { if (!next) setConcludeBalance(null); }}
        title="Concluir com saldo em aberto?"
        description={concludeBalance !== null
          ? `Ainda faltam ${formatCurrency(concludeBalance)} desta hospedagem. Concluir não apaga o saldo: ele continua a receber na reserva.`
          : ""}
        confirmLabel="Concluir hospedagem"
        busy={statusLoading}
        onConfirm={() => void handleStatusChange("Concluída")}
      />
    </>
  );
}
