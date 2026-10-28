"use client";

import { useEffect, useState, type FormEvent } from "react";
import apiClient from "../../services/api";
import type { Category } from "../../utils/models";
import { apiErrorMessage } from "../../utils/api-error";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { couplePriceOf, moneyInput, parseMoney } from "./tarifas-data";

interface CategoriaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null cria uma categoria nova. */
  category: Category | null;
  onSaved: () => void;
}

interface FormState {
  name: string;
  couplePrice: string;
  halfBoardPrice: string;
  singlePrice: string;
  rateValidFrom: string;
  rateValidUntil: string;
}

const EMPTY: FormState = { name: "", couplePrice: "", halfBoardPrice: "", singlePrice: "", rateValidFrom: "", rateValidUntil: "" };

function formFrom(category: Category | null): FormState {
  if (!category) return EMPTY;
  return {
    name: category.name,
    couplePrice: moneyInput(couplePriceOf(category)),
    halfBoardPrice: moneyInput(category.halfBoardPrice),
    singlePrice: moneyInput(category.singlePrice),
    rateValidFrom: category.rateValidFrom ?? "",
    rateValidUntil: category.rateValidUntil ?? "",
  };
}

const INVALID = "Preencha todos os campos corretamente antes de continuar.";

// Criar e editar usam as rotas atuais (só gerente). Excluir só funciona sem quartos vinculados; o backend avisa.
export default function CategoriaSheet({ open, onOpenChange, category, onSaved }: CategoriaSheetProps) {
  const [form, setForm] = useState<FormState>(() => formFrom(category));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = category !== null;

  useEffect(() => {
    if (open) setForm(formFrom(category));
  }, [open, category]);

  const set = (field: keyof FormState) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const couplePrice = parseMoney(form.couplePrice);
    const halfBoardPrice = parseMoney(form.halfBoardPrice);
    const singlePrice = parseMoney(form.singlePrice);
    const optionalOk = (value: number | null) => value === null || value > 0;
    if (!form.name.trim() || couplePrice === null || !(couplePrice > 0) || !optionalOk(halfBoardPrice) || !optionalOk(singlePrice)) {
      toast.warning(INVALID);
      return;
    }

    const body = {
      name: form.name,
      price: couplePrice,
      couplePrice,
      singlePrice,
      halfBoardPrice,
      rateValidFrom: form.rateValidFrom || null,
      rateValidUntil: form.rateValidUntil || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await apiClient.put(`/api/Categories/update/${category.id}`, body);
        toast.success("Categoria atualizada com sucesso!");
      } else {
        await apiClient.post("/api/Categories/create", body);
        toast.success("Categoria criada com sucesso!");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, editing ? "Erro ao atualizar categoria!" : "Erro ao criar categoria!"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!category) return;
    setSaving(true);
    try {
      await apiClient.delete(`/api/Categories/delete/${category.id}`);
      toast.success("Categoria excluída com sucesso!");
      setConfirmDelete(false);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Erro ao deletar categoria!"));
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
        title={editing ? category.name : "Nova categoria"}
        description={editing ? "Diárias e validade da tarifa desta categoria." : "Cadastre a categoria com a diária de casal."}
        footer={
          <>
            {editing && (
              <Button variant="ghost" className="mr-auto text-danger hover:text-danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            )}
            <Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" form="categoria-form" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar categoria"}
            </Button>
          </>
        }
      >
        <form id="categoria-form" noValidate onSubmit={(event) => void handleSubmit(event)} className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field label="Nome" required className="sm:col-span-2">
            <Input value={form.name} onChange={set("name")} placeholder="Ex.: Standard" autoComplete="off" />
          </Field>
          <Field label="Casal · só café" required hint="Usada como sugestão para duas ou mais pessoas.">
            <Input value={form.couplePrice} onChange={set("couplePrice")} inputMode="decimal" placeholder="Ex.: 473,00" className="font-mono" />
          </Field>
          <Field label="Casal · meia pensão" hint="Opcional.">
            <Input value={form.halfBoardPrice} onChange={set("halfBoardPrice")} inputMode="decimal" placeholder="Ex.: 583,00" className="font-mono" />
          </Field>
          <Field label="Tarifa de solteiro" hint="Deixe vazio quando a categoria não tiver diária individual." className="sm:col-span-2">
            <Input value={form.singlePrice} onChange={set("singlePrice")} inputMode="decimal" placeholder="Ex.: 180,00" className="font-mono sm:max-w-[calc(50%-8px)]" />
          </Field>
          <Field label="Validade · primeira entrada" hint="Vazio: sem restrição.">
            <Input type="date" value={form.rateValidFrom} onChange={set("rateValidFrom")} className="font-mono" />
          </Field>
          <Field label="Validade · última saída" hint="A última noite é a véspera.">
            <Input type="date" value={form.rateValidUntil} onChange={set("rateValidUntil")} className="font-mono" />
          </Field>
        </form>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir ${category?.name ?? "categoria"}?`}
        description="A exclusão não pode ser desfeita. Só é possível excluir uma categoria sem quartos vinculados."
        confirmLabel="Excluir categoria"
        tone="danger"
        busy={saving}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
