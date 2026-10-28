"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { ReservationDto, ReservationPaymentDto } from "../../types/reservations";
import { formatCurrency, formatDateTime } from "../../utils/format";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Segmented from "../ui/Segmented";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STAGE_LABELS,
  parseMoneyInput,
  reversibleAmount,
  validateReversal,
  type PaymentMethod,
  type PaymentStage,
} from "./reserva-data";

export interface PaymentFormState {
  stage: PaymentStage;
  method: PaymentMethod;
  amount: string;
  note: string;
}

interface Props {
  summary: { total: number; paid: number; balance: number } | null;
  financialException: ReservationDto["financialException"];
  payments: ReservationPaymentDto[];
  loading: boolean;
  /** Falha ao carregar o detalhe financeiro. */
  loadError: string | null;
  canReceive: boolean;
  form: PaymentFormState;
  onFormChange: (patch: Partial<PaymentFormState>) => void;
  submitting: boolean;
  /** Erro do último registro ou estorno. */
  actionError: string | null;
  onRegister: () => void;
  /** Só o gerente estorna; sem ele, o botão "Estornar" não aparece. */
  onReverse?: (payment: ReservationPaymentDto, amount: number, reason: string) => Promise<boolean>;
}

const STAGE_OPTIONS = (Object.keys(PAYMENT_STAGE_LABELS) as PaymentStage[]).map((value) => ({ value, label: PAYMENT_STAGE_LABELS[value] }));
const METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "Pix", label: "Pix" },
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "CartaoDebito", label: "Débito" },
  { value: "CartaoCredito", label: "Crédito" },
];

const toInput = (value: number) => value.toFixed(2).replace(".", ",");

function Figure({ label, value, tone, first }: { label: string; value: string; tone?: "danger" | "accent"; first?: boolean }) {
  return (
    <div className={first ? "flex flex-col-reverse gap-0.5 py-3" : "flex flex-col-reverse gap-0.5 border-l border-rule py-3 pl-4"}>
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className={`m-0 font-mono text-lg ${tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : ""}`}>{value}</dd>
    </div>
  );
}

function ReverseForm({ payment, remaining, onReverse, onDone }: {
  payment: ReservationPaymentDto;
  remaining: number;
  onReverse: NonNullable<Props["onReverse"]>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(toInput(remaining));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const invalid = validateReversal(amount, reason, remaining);
    if (invalid) { setError(invalid); return; }
    setError(null);
    setBusy(true);
    const ok = await onReverse(payment, parseMoneyInput(amount), reason.trim());
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 pb-3 max-[480px]:grid-cols-1">
      <Field label="Valor do estorno" hint={`Até ${formatCurrency(remaining)}`}>
        <Input inputMode="decimal" className="[&_input]:font-mono" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="Motivo" required error={error ?? undefined}>
        <Input value={reason} placeholder="Ex.: lançado em dobro" onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="col-span-2 flex justify-end gap-2 max-[480px]:col-span-1">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDone}>Voltar</Button>
        <Button variant="danger" size="sm" disabled={busy} onClick={() => void submit()}>{busy ? "Aguarde…" : "Estornar"}</Button>
      </div>
    </div>
  );
}

export default function ReservaPagamentos({
  summary, financialException, payments, loading, loadError, canReceive, form, onFormChange, submitting, actionError, onRegister, onReverse,
}: Props) {
  const [reversingId, setReversingId] = useState<string | null>(null);
  const amount = parseMoneyInput(form.amount);

  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">Carregando pagamentos</span>
        {[0, 1, 2].map((row) => <span key={row} aria-hidden="true" className="h-12 animate-pulse rounded-bar bg-muted" />)}
      </div>
    );
  }
  if (loadError) return <p role="alert" className="m-0 py-4 text-[13px] text-danger">{loadError}</p>;

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <dl className="m-0 grid grid-cols-3 border-y border-rule">
          <Figure first label="Total" value={formatCurrency(summary.total)} />
          <Figure label="Pago" value={formatCurrency(summary.paid)} />
          <Figure label="Saldo" value={formatCurrency(summary.balance)} tone={summary.balance > 0 ? "danger" : "accent"} />
        </dl>
      )}

      {financialException && (
        <p role="alert" className="m-0 flex items-start gap-2 rounded-block bg-warn-bg px-3 py-2.5 text-[13px] text-warn-fg">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Exceção financeira: {financialException.type === "overpaid" ? "pagamento acima do total" : "total pago inválido"} ({formatCurrency(financialException.amount)}).
        </p>
      )}

      {actionError && <p role="alert" className="m-0 text-[13px] text-danger">{actionError}</p>}

      {canReceive && (
        <section aria-labelledby="reserva-receber" className="flex flex-col gap-3 rounded-block bg-bg p-3.5">
          <h3 id="reserva-receber" className="m-0 text-[13px] font-semibold text-fg-2">Receber pagamento</h3>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-3">Etapa</span>
            <Segmented label="Etapa" className="grid! grid-cols-3 [&>*]:justify-center" value={form.stage} onChange={(stage) => onFormChange({ stage })} options={STAGE_OPTIONS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-3">Forma</span>
            <Segmented label="Forma de pagamento" className="grid! grid-cols-4 [&>*]:justify-center [&>*]:px-1" value={form.method} onChange={(method) => onFormChange({ method })} options={METHOD_OPTIONS} />
          </div>
          <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 max-[480px]:grid-cols-1">
            <Field label="Valor">
              <Input inputMode="decimal" className="[&_input]:font-mono" value={form.amount} onChange={(event) => onFormChange({ amount: event.target.value })} />
            </Field>
            <Field label="Observação">
              <Input value={form.note} placeholder="Ex.: comprovante enviado pelo WhatsApp" onChange={(event) => onFormChange({ note: event.target.value })} />
            </Field>
          </div>
          <p className="m-0 text-xs text-fg-3">O pagamento fica no histórico financeiro e não muda o andamento da reserva.</p>
          <Button variant="accent" className="self-start" disabled={submitting} onClick={onRegister}>
            {submitting ? "Registrando…" : Number.isFinite(amount) && amount > 0 ? `Registrar ${formatCurrency(amount)}` : "Registrar pagamento"}
          </Button>
        </section>
      )}

      <section aria-labelledby="reserva-recebidos" className="flex flex-col">
        <h3 id="reserva-recebidos" className="m-0 mb-1 text-[13px] font-semibold text-fg-2">Recebidos</h3>
        {payments.length === 0 ? (
          <p className="m-0 py-3 text-[13px] text-fg-3">Nenhum pagamento registrado.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {payments.map((payment) => {
              const reversal = payment.entryType === "reversal";
              const remaining = reversibleAmount(payment, payments);
              return (
                <li key={payment.id} className="border-b border-rule">
                  <div className="flex min-h-[50px] items-center justify-between gap-3 py-1.5 text-[13px]">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {reversal ? "Estorno" : PAYMENT_STAGE_LABELS[payment.stage]} · {PAYMENT_METHOD_LABELS[payment.method]}
                      </span>
                      <span className="text-xs text-fg-3">
                        <span className="font-mono">{formatDateTime(payment.createdAt)}</span>
                        {payment.note ? ` · ${payment.note}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={reversal ? "font-mono text-danger" : "font-mono"}>{formatCurrency(payment.amount)}</span>
                      {onReverse && !reversal && remaining > 0 && reversingId !== payment.id && (
                        <button type="button" className="text-xs text-fg-3 hover:text-danger" onClick={() => setReversingId(payment.id)}>
                          Estornar
                        </button>
                      )}
                    </span>
                  </div>
                  {onReverse && reversingId === payment.id && (
                    <ReverseForm payment={payment} remaining={remaining} onReverse={onReverse} onDone={() => setReversingId(null)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
