"use client";

import { useState } from "react";
import { ChevronDown, Minus, Plus, X } from "lucide-react";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { formatCurrency } from "../../utils/format";
import {
  companionDefaultName,
  INCLUDED_COMPANIONS,
  orderCompanions,
  ADULT_AGE,
  type Companion,
} from "./nova-reserva-data";

export interface AgeRule {
  id: string;
  name?: string;
  description?: string;
  minAge?: number;
  maxAge?: number;
  price: number;
  billingBasis?: "per_daily" | "per_stay";
}

interface PartyEditorProps {
  companions: Companion[];
  onChange: (companions: Companion[]) => void;
  pricingRules: AgeRule[];
  rulesError?: string | null;
  // Abre os nomes e regras quando a cotação falha: fora da temporada, o adicional pago precisa de regra.
  showRules?: boolean;
  disabled?: boolean;
}

const stepButton = "grid size-8 place-items-center text-fg-2 hover:text-fg disabled:opacity-40";

// Adultos (o cliente conta como o primeiro) e crianças com idade; nomes e regras ficam recolhidos.
export default function PartyEditor({ companions, onChange, pricingRules, rulesError, showRules = false, disabled }: PartyEditorProps) {
  const [childAge, setChildAge] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const adults = 1 + companions.filter((c) => c.kind === "adult").length;
  const children = companions.map((companion, index) => ({ companion, index })).filter(({ companion }) => companion.kind === "child");
  const update = (next: Companion[]) => onChange(orderCompanions(next));

  const removeAdult = () => {
    const lastAdult = companions.map((c) => c.kind).lastIndexOf("adult");
    if (lastAdult >= 0) update(companions.filter((_, index) => index !== lastAdult));
  };
  const addChild = () => {
    const age = Number(childAge);
    if (childAge.trim() === "" || !Number.isInteger(age) || age < 0 || age > 17) return;
    update([...companions, { kind: "child", name: "", age, pricingRuleId: null }]);
    setChildAge("");
  };
  const setCompanion = (index: number, patch: Partial<Companion>) =>
    update(companions.map((companion, current) => (current === index ? { ...companion, ...patch } : companion)));

  let adultPosition = 0;
  let childPosition = 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-3">Adultos</span>
          <span className="inline-flex h-9 items-center rounded-control border border-border">
            <button type="button" className={stepButton} aria-label="Menos adultos" disabled={disabled || adults <= 1} onClick={removeAdult}>
              <Minus aria-hidden="true" className="size-3.5" />
            </button>
            <span className="w-6 text-center font-mono text-sm" aria-live="polite">{adults}</span>
            <button type="button" className={stepButton} aria-label="Mais adultos" disabled={disabled}
              onClick={() => update([...companions, { kind: "adult", name: "", age: ADULT_AGE, pricingRuleId: null }])}>
              <Plus aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span id="criancas-label" className="text-xs font-medium text-fg-3">Crianças</span>
          <div className="flex flex-wrap items-center gap-2">
            {children.map(({ companion, index }) => (
              <span key={index} className="inline-flex h-[30px] items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-[13px]">
                <span className="font-mono">{companion.age}</span> {companion.age === 1 ? "ano" : "anos"}
                <button type="button" aria-label={`Remover criança de ${companion.age} anos`} disabled={disabled}
                  onClick={() => update(companions.filter((_, current) => current !== index))}
                  className="grid size-5 place-items-center rounded-full text-fg-3 hover:bg-surface hover:text-fg">
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <Input
                aria-label="Idade da criança"
                type="number"
                min={0}
                max={17}
                placeholder="idade"
                className="w-[72px] [&_input]:font-mono"
                value={childAge}
                disabled={disabled}
                onChange={(event) => setChildAge(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChild(); } }}
              />
              <Button size="sm" variant="outline" onClick={addChild} disabled={disabled || childAge.trim() === ""}>
                + criança
              </Button>
            </span>
          </div>
        </div>
      </div>

      {companions.length > 0 && (
        <details className="group" open={detailsOpen || showRules} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] text-fg-2 hover:text-fg">
            Nomes e regras de idade dos acompanhantes
            <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="m-0 text-xs text-fg-3">
              O nome pode ficar para o check-in. O 1º acompanhante está incluso na diária de casal; os demais pagam pela idade, com a regra da temporada aplicada sozinha.
            </p>
            {rulesError && <p role="alert" className="m-0 text-xs text-danger">{rulesError}</p>}
            {companions.map((companion, index) => {
              const position = companion.kind === "adult" ? ++adultPosition : ++childPosition;
              const paid = index >= INCLUDED_COMPANIONS;
              const rules = pricingRules.filter((rule) =>
                companion.age >= (rule.minAge ?? 0) && companion.age <= (rule.maxAge ?? 120));
              return (
                <div key={index} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label={`${companion.kind === "adult" ? "Adulto" : `Criança de ${companion.age}`} · ${paid ? "adicional" : "incluso"}`}>
                    <Input placeholder={companionDefaultName(companion, position)} value={companion.name} disabled={disabled}
                      onChange={(event) => setCompanion(index, { name: event.target.value })} />
                  </Field>
                  {paid ? (
                    <Field label="Regra fora da temporada">
                      <Select value={companion.pricingRuleId ?? ""} disabled={disabled}
                        onChange={(event) => setCompanion(index, { pricingRuleId: event.target.value || null })}>
                        <option value="">Automática na temporada</option>
                        {rules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.description || rule.name} · {formatCurrency(rule.price)}{rule.billingBasis === "per_stay" ? " por hospedagem" : " por diária"}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : <span aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
