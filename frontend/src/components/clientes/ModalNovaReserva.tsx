"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import apiClient from "../../services/api";
import { useReservationQuote } from "../../hooks/useReservationQuote";
import { calculateNights, formatNights, formatStayPeriod } from "../../utils/format";
import {
  formatReservationCalendarDate,
  formatReservationPickerDate,
  parseReservationPickerDate
} from "../../utils/reservation";
import { apiErrorMessage } from "../../utils/api-error";
import { getIdempotencyAttempt } from "../../utils/idempotency";
import Button from "../ui/Button";
import DatePicker from "../ui/DatePicker";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Segmented from "../ui/Segmented";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import ClientPicker, { type PickedClient } from "../nova-reserva/ClientPicker";
import PartyEditor, { type AgeRule } from "../nova-reserva/PartyEditor";
import RoomPicker from "../nova-reserva/RoomPicker";
import ReservationSummary from "../nova-reserva/ReservationSummary";
import {
  ADULT_AGE,
  INCLUDED_COMPANIONS,
  buildGuests,
  excludedRoomsMessage,
  groupRooms,
  hasPriceAdjustment,
  parsePriceAdjustment,
  peopleSummary,
  periodError,
  roomLabel,
  type AvailableRoom,
  type Companion,
  type PriceAdjustment
} from "../nova-reserva/nova-reserva-data";

export interface ReservationClient {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
}

export interface ReservationInitialValues {
  client?: ReservationClient | null;
  checkInDate?: Date | null;
  checkOutDate?: Date | null;
  // Opcionais: preenchidos por quem abre a partir de uma conversa do WhatsApp.
  conversationName?: string;
  adults?: number;
  childAges?: number[];
}

interface ModalNovaReservaProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialValues?: ReservationInitialValues;
}

type MealPlan = "breakfast" | "half_board";

const EMPTY_ADJUSTMENT: PriceAdjustment = { dailyRateOverride: "", discountAmount: "", priceOverrideReason: "" };
const MEAL_PLANS = [
  { value: "breakfast" as const, label: "Só café" },
  { value: "half_board" as const, label: "Meia pensão" }
];

const validDate = (date: Date | null | undefined): date is Date => Boolean(date && !Number.isNaN(date.getTime()));

function initialCompanions(values?: ReservationInitialValues): Companion[] {
  const adults = Math.max(0, (values?.adults ?? 1) - 1);
  return [
    ...Array.from({ length: adults }, (): Companion => ({ kind: "adult", name: "", age: ADULT_AGE, pricingRuleId: null })),
    ...(values?.childAges ?? []).map((age): Companion => ({ kind: "child", name: "", age, pricingRuleId: null }))
  ];
}

function SectionTitle({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="m-0 text-[15px] font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export default function ModalNovaReserva({ open, onClose, onSuccess, initialValues }: ModalNovaReservaProps) {
  const [selectedClient, setSelectedClient] = useState<PickedClient | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlan>("breakfast");
  const [deferDetails, setDeferDetails] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [adjustment, setAdjustment] = useState<PriceAdjustment>(EMPTY_ADJUSTMENT);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [pricingRules, setPricingRules] = useState<AgeRule[]>([]);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  // Lista exibida: todos os quartos livres nas datas; a capacidade é separada aqui, para dizer quem ficou de fora.
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityCheckedAt, setAvailabilityCheckedAt] = useState<Date | null>(null);
  const [availabilityRetryNonce, setAvailabilityRetryNonce] = useState(0);
  const [roomTakenMessage, setRoomTakenMessage] = useState<string | null>(null);
  const availabilityRequestId = useRef(0);

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createSubmittingRef = useRef(false);
  const [createIdempotencyKey, setCreateIdempotencyKey] = useState<string | null>(null);
  const [createAttemptFingerprint, setCreateAttemptFingerprint] = useState<string | null>(null);

  const hotelToday = parseReservationPickerDate(formatReservationCalendarDate(new Date()));
  const totalGuestCount = 1 + companions.length;
  const checkIn = validDate(checkInDate) ? formatReservationPickerDate(checkInDate) : null;
  const checkOut = validDate(checkOutDate) ? formatReservationPickerDate(checkOutDate) : null;
  const datesError = periodError(checkIn, checkOut);
  const nights = checkIn && checkOut && !datesError ? calculateNights(checkIn, checkOut) : 0;

  // Valores iniciais a cada abertura (cliente da tela de Hóspedes, conversa do WhatsApp).
  const initialClient = initialValues?.client ?? null;
  const initialCheckIn = initialValues?.checkInDate?.getTime() ?? null;
  const initialCheckOut = initialValues?.checkOutDate?.getTime() ?? null;
  const initialParty = initialValues?.adults !== undefined || initialValues?.childAges !== undefined
    ? JSON.stringify({ adults: initialValues.adults, childAges: initialValues.childAges })
    : null;
  useEffect(() => {
    if (!open) return;
    setSelectedClient(initialClient);
    if (initialCheckIn !== null) setCheckInDate(new Date(initialCheckIn));
    if (initialCheckOut !== null) setCheckOutDate(new Date(initialCheckOut));
    if (initialParty) setCompanions(initialCompanions(JSON.parse(initialParty)));
  }, [open, initialClient, initialCheckIn, initialCheckOut, initialParty]);

  // Regras de idade e nomes das categorias: uma vez por abertura.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRulesError(null);
    apiClient.get<AgeRule[]>("/api/pricing-rules")
      .then(({ data }) => { if (!cancelled) setPricingRules(Array.isArray(data) ? data : []); })
      .catch((error) => { if (!cancelled) setRulesError(apiErrorMessage(error, "Não foi possível carregar as regras de idade.")); });
    apiClient.get<Array<{ id: string; name: string }>>("/api/categories")
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data)) setCategoryNames(Object.fromEntries(data.map((category) => [category.id, category.name])));
      })
      // Sem as categorias, o grupo usa o tipo do quarto.
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      availabilityRequestId.current += 1;
      setLoadingAvailability(false);
      return;
    }

    const requestId = ++availabilityRequestId.current;
    setAvailableRooms([]);
    setAvailabilityCheckedAt(null);
    setAvailabilityError(null);
    if (!checkIn || !checkOut || datesError) {
      setLoadingAvailability(false);
      return;
    }

    let cancelled = false;
    setLoadingAvailability(true);
    apiClient
      .get<AvailableRoom[]>("/api/rooms/availability", { params: { checkIn, checkOut, guestCount: "1" } })
      .then((response) => {
        if (cancelled || requestId !== availabilityRequestId.current) return;
        setAvailableRooms(Array.isArray(response.data) ? response.data : []);
        setAvailabilityCheckedAt(new Date());
      })
      .catch((error) => {
        if (cancelled || requestId !== availabilityRequestId.current) return;
        setAvailabilityError(apiErrorMessage(error, "Não foi possível consultar a disponibilidade. Tente novamente."));
      })
      .finally(() => {
        if (!cancelled && requestId === availabilityRequestId.current) setLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, checkIn, checkOut, datesError, availabilityRetryNonce]);

  const { groups, excluded } = useMemo(
    () => groupRooms(availableRooms, deferDetails ? 1 : totalGuestCount, categoryNames),
    [availableRooms, deferDetails, totalGuestCount, categoryNames]
  );
  const selectedRoom = groups.flatMap((group) => group.rooms).find((room) => room.id === roomId) ?? null;
  const selectedGroup = groups.find((group) => group.rooms.some((room) => room.id === roomId)) ?? null;

  // Quarto que saiu da lista (outras datas, grupo maior) deixa de estar escolhido.
  useEffect(() => {
    if (roomId && !loadingAvailability && !selectedRoom) setRoomId("");
  }, [roomId, loadingAvailability, selectedRoom]);

  const guests = useMemo(() => buildGuests(companions), [companions]);
  const parsedAdjustment = parsePriceAdjustment(adjustment);
  const adjustmentFields = parsedAdjustment.error === null
    ? {
      ...(parsedAdjustment.dailyRateOverride !== undefined ? { dailyRateOverride: parsedAdjustment.dailyRateOverride } : {}),
      ...(parsedAdjustment.discountAmount !== undefined ? { discountAmount: parsedAdjustment.discountAmount } : {}),
      ...(parsedAdjustment.priceOverrideReason ? { priceOverrideReason: parsedAdjustment.priceOverrideReason } : {})
    }
    : null;

  const quote = useReservationQuote(open && selectedRoom && selectedClient && checkIn && checkOut && !datesError && adjustmentFields
    ? deferDetails ? null : { roomId: selectedRoom.id, clientId: selectedClient.id, checkInDate: checkIn, checkOutDate: checkOut, guests, mealPlan, ...adjustmentFields }
    : null);

  const handleClose = useCallback(() => {
    availabilityRequestId.current += 1;
    setSelectedClient(null);
    setCheckInDate(null);
    setCheckOutDate(null);
    setCompanions([]);
    setMealPlan("breakfast");
    setDeferDetails(false);
    setRoomId("");
    setAdjustment(EMPTY_ADJUSTMENT);
    setAdjustOpen(false);
    setAvailableRooms([]);
    setAvailabilityError(null);
    setAvailabilityCheckedAt(null);
    setRoomTakenMessage(null);
    setSubmitError(null);
    setCreateIdempotencyKey(null);
    setCreateAttemptFingerprint(null);
    onClose();
  }, [onClose]);

  // Confere de novo, com o tamanho real do grupo, logo antes de criar.
  const revalidateAvailability = async (): Promise<boolean> => {
    if (!checkIn || !checkOut || datesError) return false;
    const requestId = ++availabilityRequestId.current;
    try {
      const response = await apiClient.get<AvailableRoom[]>("/api/rooms/availability", {
        params: { checkIn, checkOut, guestCount: String(deferDetails ? 1 : totalGuestCount) }
      });
      if (requestId !== availabilityRequestId.current) return false;
      const roomsList = Array.isArray(response.data) ? response.data : [];
      if (!roomsList.some((room) => room.id === roomId)) {
        setRoomId("");
        setRoomTakenMessage("O quarto selecionado deixou de estar disponível. Escolha outro quarto.");
        setAvailabilityRetryNonce((value) => value + 1);
        return false;
      }
      setAvailabilityCheckedAt(new Date());
      return true;
    } catch (error) {
      if (requestId !== availabilityRequestId.current) return false;
      setAvailabilityError(apiErrorMessage(error, "Não foi possível consultar a disponibilidade. Tente novamente."));
      return false;
    }
  };

  const missing = [
    !selectedClient && "escolher o cliente",
    (!checkIn || !checkOut) && "informar entrada e saída",
    !selectedRoom && "escolher o quarto"
  ].filter((item): item is string => Boolean(item));

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (createSubmittingRef.current) return;
    setSubmitError(null);

    if (!roomId || !selectedClient || !checkIn || !checkOut) {
      setSubmitError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (datesError) {
      setSubmitError("A data de check-out deve ser posterior à data de check-in.");
      return;
    }
    if (loadingAvailability || availabilityError || !selectedRoom) {
      setSubmitError(availabilityError ?? "A disponibilidade ainda não foi validada para este quarto.");
      return;
    }
    if (!deferDetails && parsedAdjustment.error !== null) {
      setAdjustOpen(true);
      setSubmitError(parsedAdjustment.error);
      return;
    }
    if (!deferDetails && !quote.pricing) {
      setSubmitError(quote.error ?? "Aguarde o cálculo do total.");
      return;
    }

    setLoading(true);
    createSubmittingRef.current = true;
    try {
      if (!(await revalidateAvailability())) {
        setSubmitError("A disponibilidade mudou ou não pôde ser confirmada. Escolha um quarto e tente novamente.");
        return;
      }

      const payload = deferDetails
        ? { roomId, clientId: selectedClient.id, checkInDate: checkIn, checkOutDate: checkOut, deferDetails: true }
        : { mealPlan, roomId, clientId: selectedClient.id, checkInDate: checkIn, checkOutDate: checkOut, guests, ...adjustmentFields };
      const attempt = getIdempotencyAttempt(
        createIdempotencyKey && createAttemptFingerprint
          ? { key: createIdempotencyKey, fingerprint: createAttemptFingerprint }
          : null,
        payload,
      );
      setCreateIdempotencyKey(attempt.key);
      setCreateAttemptFingerprint(attempt.fingerprint);

      await apiClient.post("/api/Reservations", { ...payload, idempotencyKey: attempt.key });

      toast.success("Reserva criada com sucesso!");
      onSuccess?.();
      handleClose();
    } catch (error) {
      const message = apiErrorMessage(error, "Erro ao criar reserva.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      createSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const checkOutMin = validDate(checkInDate)
    ? new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate() + 1, 12)
    : hotelToday;
  const roomStatus = !checkIn || !checkOut || datesError ? "idle" : loadingAvailability ? "loading" : availabilityError ? "error" : "ready";
  const adjusting = hasPriceAdjustment(adjustment);
  const conversationName = initialValues?.conversationName?.trim();

  const summaryRows = [
    { label: "Cliente", value: selectedClient?.fullName ?? "—" },
    { label: "Quarto", value: selectedRoom ? <><span className="font-mono">{roomLabel(selectedRoom)}</span> · {selectedGroup?.name}</> : "—" },
    { label: "Período", value: nights > 0 && checkIn && checkOut ? <span className="font-mono">{formatStayPeriod(checkIn, checkOut)} · {formatNights(nights)}</span> : "—" },
    { label: "Pessoas", value: deferDetails ? "A definir no check-in" : peopleSummary(companions) },
    { label: "Alimentação", value: deferDetails ? "A definir no check-in" : mealPlan === "half_board" ? "Meia pensão" : "Só café" }
  ];
  const checks: Array<{ tone: "ok" | "warn"; text: string }> = [];
  if (selectedRoom && availabilityCheckedAt) checks.push({ tone: "ok", text: "Quarto livre nas datas" });
  if (selectedClient && !selectedClient.cpf) checks.push({ tone: "warn", text: "Falta o CPF do cliente · pode ser no check-in" });
  if (deferDetails) checks.push({ tone: "warn", text: "Preço, alimentação e ocupação serão preenchidos no check-in" });
  if (missing.length > 0) checks.push({ tone: "warn", text: `Falta ${missing.join(", ")}` });

  const setAdjustmentField = (field: keyof PriceAdjustment, value: string) =>
    setAdjustment((previous) => ({ ...previous, [field]: value }));

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => { if (!next && !loading) handleClose(); }}
      size="lg"
      title="Nova reserva"
      closeLabel="Fechar nova reserva"
      description={conversationName ? (
        <span className="inline-flex items-center gap-1.5 text-accent-700">
          <Sparkles aria-hidden="true" className="size-3.5" />
          Preenchida pela conversa com {conversationName}
        </span>
      ) : undefined}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-5 md:-mx-6 md:-my-5 md:grid md:h-[calc(100%+2.5rem)] md:grid-cols-[minmax(0,1fr)_300px] md:gap-0"
      >
        <div className="flex flex-col gap-5 md:min-h-0 md:overflow-y-auto md:px-6 md:py-5">
          <section aria-labelledby="nr-cliente" className="flex flex-col gap-2.5">
            <SectionTitle id="nr-cliente">Cliente</SectionTitle>
            <ClientPicker selected={selectedClient} onSelect={setSelectedClient} disabled={loading} />
          </section>

          <section aria-labelledby="nr-datas" className="flex flex-col gap-2.5 border-t border-rule pt-4">
            <SectionTitle id="nr-datas">Datas e pessoas</SectionTitle>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Field label="Entrada · a partir das 14h" required>
                <DatePicker value={checkInDate} onChange={(date) => { setCheckInDate(date); setRoomTakenMessage(null); }} minDate={hotelToday} disabled={loading} />
              </Field>
              <Field label="Saída · até as 12h" required error={datesError}>
                <DatePicker value={checkOutDate} onChange={(date) => { setCheckOutDate(date); setRoomTakenMessage(null); }} minDate={checkOutMin} disabled={loading} />
              </Field>
              {nights > 0 && (
                <span className="flex h-9 items-baseline gap-1.5 self-end text-[13px] text-fg-2 sm:pb-1.5">
                  <span className="font-mono text-[22px] font-medium text-fg">{nights}</span>
                  {nights === 1 ? "noite" : "noites"}
                </span>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-fg-2">
              <input type="checkbox" checked={deferDetails} disabled={loading} onChange={(event) => setDeferDetails(event.target.checked)} className="mt-0.5 accent-accent" />
              <span>Reserva parcial: preencher ocupação, alimentação e preço no check-in</span>
            </label>
            {deferDetails ? (
              <p className="m-0 rounded-control bg-bg px-3 py-2 text-[13px] text-fg-3">A reserva bloqueia o quarto nas datas, sem registrar quantidade de pessoas ou valor.</p>
            ) : (
              <PartyEditor companions={companions} onChange={setCompanions} pricingRules={pricingRules} rulesError={rulesError}
                showRules={Boolean(quote.error) && companions.length > INCLUDED_COMPANIONS} disabled={loading} />
            )}
          </section>

          <section aria-labelledby="nr-quarto" className="flex flex-col gap-2.5 border-t border-rule pt-4">
            <SectionTitle
              id="nr-quarto"
              aside={deferDetails ? <span className="text-xs text-fg-3">Definida no check-in</span> : <Segmented label="Alimentação" value={mealPlan} onChange={setMealPlan} options={MEAL_PLANS} />}
            >
              Quarto e alimentação
            </SectionTitle>
            {roomTakenMessage && <p role="alert" className="m-0 text-[13px] font-medium text-danger">{roomTakenMessage}</p>}
            <RoomPicker
              groups={groups}
              excludedMessage={excludedRoomsMessage(excluded)}
              selectedId={roomId}
              onSelect={(id) => { setRoomId(id); setRoomTakenMessage(null); setSubmitError(null); }}
              status={roomStatus}
              error={availabilityError}
              onRetry={() => setAvailabilityRetryNonce((value) => value + 1)}
              checkedAt={availabilityCheckedAt}
              disabled={loading}
            />
          </section>

          {!deferDetails && <details
            open={adjustOpen || adjusting}
            onToggle={(event) => setAdjustOpen(event.currentTarget.open)}
            className="group border-t border-rule pt-3.5"
          >
            <summary className="flex min-h-[30px] cursor-pointer list-none items-center justify-between text-sm font-medium">
              Ajustar preço manualmente
              <ChevronDown aria-hidden="true" className="size-3.5 text-fg-3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Diária aplicada">
                <Input inputMode="decimal" placeholder="vazio = tarifa da categoria" className="[&_input]:font-mono" value={adjustment.dailyRateOverride}
                  disabled={loading} onChange={(event) => setAdjustmentField("dailyRateOverride", event.target.value)} />
              </Field>
              <Field label="Desconto total">
                <Input inputMode="decimal" placeholder="R$ 0,00" className="[&_input]:font-mono" value={adjustment.discountAmount}
                  disabled={loading} onChange={(event) => setAdjustmentField("discountAmount", event.target.value)} />
              </Field>
              <Field
                label="Motivo do ajuste · obrigatório quando houver ajuste"
                required={adjusting}
                error={adjusting ? parsedAdjustment.error : null}
                className="sm:col-span-2"
              >
                <Input placeholder="Fica registrado com o seu nome" value={adjustment.priceOverrideReason}
                  disabled={loading} onChange={(event) => setAdjustmentField("priceOverrideReason", event.target.value)} />
              </Field>
            </div>
          </details>}
        </div>

        <ReservationSummary
          rows={summaryRows}
          pricing={quote.pricing}
          pricingPending={!deferDetails && quote.pending}
          pricingError={quote.error}
          detailsPending={deferDetails}
          checks={checks}
        >
          <div className="mt-auto flex flex-col gap-2">
            {submitError && <p role="alert" className="m-0 text-[13px] font-medium text-danger">{submitError}</p>}
            <Button
              type="submit"
              variant="primary"
              className="min-h-10"
              disabled={loading || missing.length > 0 || Boolean(datesError) || loadingAvailability || (!deferDetails && !quote.pricing)}
            >
              {loading && <Loader2 aria-hidden="true" className="animate-spin" />}
              {deferDetails ? "Criar reserva parcial" : "Criar reserva"}
            </Button>
            <Button variant="ghost" onClick={handleClose} disabled={loading}>Cancelar</Button>
          </div>
        </ReservationSummary>
      </form>
    </Sheet>
  );
}
