"use client";

import { useEffect, useState, type FormEvent } from "react";
import apiClient from "../../services/api";
import { apiErrorMessage } from "../../utils/api-error";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { ruleFormFrom, validateRuleForm, type RuleFormErrors, type RuleFormState } from "./regra-form";
import type { PricingRuleDto } from "./tarifas-data";

interface RegraSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null cria uma regra nova. */
  rule: PricingRuleDto | null;
  onSaved: () => void;
}

// Criar e editar regra de hóspede adicional (só gerente no backend).
// Reservas já criadas guardam o próprio total; a mudança vale para novas cotações.
export default function RegraSheet({ open, onOpenChange, rule, onSaved }: RegraSheetProps) {
  const [form, setForm] = useState<RuleFormState>(() => ruleFormFrom(rule));
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [saving, setSaving] = useState(false);
  const editing = rule !== null;

  useEffect(() => {
    if (open) {
      setForm(ruleFormFrom(rule));
      setErrors({});
    }
  }, [open, rule]);

  const set = (field: keyof RuleFormState) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateRuleForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      if (editing) {
        await apiClient.put(`/api/pricing-rules/${rule.id}`, result.body);
        toast.success("Regra atualizada com sucesso!");
      } else {
        await apiClient.post("/api/pricing-rules", result.body);
        toast.success("Regra criada com sucesso!");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, editing ? "Erro ao atualizar regra!" : "Erro ao criar regra!"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
      title={editing ? rule.name : "Nova regra"}
      description={editing
        ? "Vale para novas cotações. Reservas já criadas mantêm o total."
        : "Cobrança de hóspede adicional por faixa de idade, a partir da 3ª pessoa."}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primary" type="submit" form="regra-form" disabled={saving}>
            {saving ? "Salvando…" : editing ? "Salvar" : "Criar regra"}
          </Button>
        </>
      }
    >
      <form id="regra-form" noValidate onSubmit={(event) => void handleSubmit(event)} className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field label="Nome" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={set("name")} placeholder="Ex.: Criança 6 a 11 anos" autoComplete="off" />
        </Field>
        <Field label="Idade mínima" required error={errors.minAge}>
          <Input value={form.minAge} onChange={set("minAge")} inputMode="numeric" placeholder="Ex.: 6" className="font-mono" />
        </Field>
        <Field label="Idade máxima" required error={errors.maxAge} hint={errors.maxAge ? undefined : "Use 120 para “ou mais”."}>
          <Input value={form.maxAge} onChange={set("maxAge")} inputMode="numeric" placeholder="Ex.: 11" className="font-mono" />
        </Field>
        <Field label="Valor" required error={errors.price} hint={errors.price ? undefined : "0 para gratuidade."}>
          <Input value={form.price} onChange={set("price")} inputMode="decimal" placeholder="Ex.: 120,00" className="font-mono" />
        </Field>
        <Field label="Cobrança" required error={errors.billingBasis}>
          <Select value={form.billingBasis} onChange={set("billingBasis")}>
            <option value="per_daily">Por diária</option>
            <option value="per_stay">Uma vez por hospedagem</option>
          </Select>
        </Field>
        <Field label="Descrição" hint="Opcional." className="sm:col-span-2">
          <Input value={form.description} onChange={set("description")} autoComplete="off" />
        </Field>
      </form>
    </Sheet>
  );
}
