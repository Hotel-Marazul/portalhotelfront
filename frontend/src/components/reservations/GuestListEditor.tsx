"use client";

import { Plus, Trash2 } from "lucide-react";
import type { GuestForm, PricingRule } from "../../types/reservations";
import { formatCurrency } from "../../utils/format";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { INCLUDED_ADDITIONAL_GUESTS } from "../reserva/reserva-data";

interface Props {
  guests: GuestForm[];
  onGuestChange: (index: number, field: keyof GuestForm, value: string | number | null) => void;
  onAddGuest: () => void;
  onRemoveGuest: (index: number) => void;
  pricingRules: PricingRule[];
  readonly?: boolean;
  /** Cliente titular, mostrado antes dos acompanhantes. */
  holderName?: string;
  /** Acompanhantes que entram na tarifa sem regra por idade. */
  includedCount?: number;
}

// Regra com faixa de idade só aparece para quem está dentro dela; regra sem faixa aparece para todos.
function rulesForAge(rules: PricingRule[], age: number | null) {
  if (age === null) return rules;
  return rules.filter((rule) =>
    typeof rule.minAge !== "number" || typeof rule.maxAge !== "number" || (age >= rule.minAge && age <= rule.maxAge));
}

const ruleLabel = (rule: PricingRule) => rule.description || rule.name;

export default function GuestListEditor({
  guests,
  onGuestChange,
  onAddGuest,
  onRemoveGuest,
  pricingRules,
  readonly = false,
  holderName,
  includedCount = INCLUDED_ADDITIONAL_GUESTS,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] text-fg-2">
        A tarifa de casal já inclui 2 pessoas. A partir da 3ª, vale a regra por idade.
        {" "}Os nomes podem ser preenchidos até o check-in.
      </p>

      <ul className="m-0 flex list-none flex-col p-0">
        {holderName !== undefined && (
          <li className="flex min-h-[52px] items-center justify-between gap-3 border-b border-rule">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{holderName}</span>
              <span className="text-xs text-fg-3">Titular</span>
            </span>
            <span className="text-xs text-accent">incluído</span>
          </li>
        )}
        {guests.map((guest, index) => {
          const included = index < includedCount;
          const rule = pricingRules.find((item) => item.id === guest.pricingRuleId);
          if (readonly) {
            return (
              <li key={guest.id ?? index} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-rule">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{guest.name || `Acompanhante ${index + 1} · nome pendente`}</span>
                  <span className="text-xs text-fg-3">
                    {guest.age === null ? "Idade a confirmar" : `${guest.age} ${guest.age === 1 ? "ano" : "anos"}`}
                    {included ? " · completa a tarifa de casal" : rule ? ` · ${ruleLabel(rule)}` : ""}
                  </span>
                </span>
                <span className={included ? "text-xs text-accent" : "text-xs text-fg-2"}>{included ? "incluído" : "adicional"}</span>
              </li>
            );
          }
          const rules = rulesForAge(pricingRules, guest.age);
          return (
            <li key={guest.id ?? index} className="grid grid-cols-[minmax(0,1fr)_80px_auto] items-end gap-2 border-b border-rule py-3 max-[480px]:grid-cols-[minmax(0,1fr)_72px]">
              <Field label={`Hóspede ${index + 1} · ${included ? "incluído" : "adicional"}`}>
                <Input value={guest.name} placeholder="Preencher até o check-in" onChange={(event) => onGuestChange(index, "name", event.target.value)} />
              </Field>
              <Field label="Idade">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  className="[&_input]:font-mono"
                  value={guest.age ?? ""}
                  placeholder="Confirmar"
                  onChange={(event) => onGuestChange(index, "age", event.target.value === "" ? null : Number(event.target.value))}
                />
              </Field>
              <Button
                variant="ghost"
                className="px-2.5 hover:text-danger max-[480px]:col-span-2 max-[480px]:justify-self-start"
                aria-label={`Remover hóspede ${index + 1}`}
                onClick={() => onRemoveGuest(index)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
              <Field label={included ? "Regra de preço (opcional)" : "Regra fora da temporada (opcional)"} className="col-span-3 max-[480px]:col-span-2">
                <Select
                  value={guest.pricingRuleId || ""}
                  disabled={guest.age !== null && guest.age < 0}
                  onChange={(event) => onGuestChange(index, "pricingRuleId", event.target.value || null)}
                >
                  <option value="">{included ? "Nenhuma regra de preço" : "Automático na temporada"}</option>
                  {rules.map((item) => (
                    <option key={item.id} value={item.id}>{ruleLabel(item)} · {formatCurrency(item.price)}</option>
                  ))}
                </Select>
              </Field>
            </li>
          );
        })}
      </ul>

      {!readonly && (
        <div className="flex flex-col gap-2">
          <Button className="self-start" onClick={onAddGuest}>
            <Plus aria-hidden="true" />
            Adicionar hóspede
          </Button>
          <span className="text-xs text-fg-3">Fora da temporada, escolha a regra de preço. No verão ela é aplicada sozinha pela idade.</span>
        </div>
      )}
    </div>
  );
}
