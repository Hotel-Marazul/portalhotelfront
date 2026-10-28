"use client";

import { useEffect, useState } from "react";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { apiErrorMessage } from "../../utils/api-error";
import { formatCurrency } from "../../utils/format";
import type { Category, Room } from "../../utils/models";
import { normalizeOperationalRoomStatus, type OperationalRoomStatus } from "../../utils/roomStatus";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Field from "../ui/Field";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { createRoom, deleteRoom, updateRoom } from "./room-api";
import { parseRoomNumber, roomLabel, validateNewRoom, validateRoomUpdate } from "./rooms-data";

interface FormState {
  number: number;
  type: string;
  capacity: number;
  price: number;
  categoryId?: string;
  status: OperationalRoomStatus;
}

const EMPTY: FormState = { number: 0, type: "", capacity: 0, price: 0, categoryId: undefined, status: "Disponivel" };

const fromRoom = (room: Room): FormState => ({
  number: room.number,
  type: room.type,
  capacity: room.capacity,
  price: room.price,
  categoryId: room.categoryId,
  status: normalizeOperationalRoomStatus(room.status),
});

interface RoomFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sem quarto, cadastra um novo. */
  room: Room | null;
  onSaved: (room: Room) => void;
  onDeleted: (id: string) => void;
}

// Cadastro e edição do quarto. Preço vem da categoria; quarto conjugado não troca de número.
export default function RoomFormSheet({ open, onOpenChange, room, onSaved, onDeleted }: RoomFormSheetProps) {
  const editing = room !== null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const categories = useCachedFetch<Category[]>("/api/categories", { cacheKey: "quartos:categorias", enabled: open });

  // Cada abertura começa do quarto escolhido, ou vazia no cadastro.
  const [openedFor, setOpenedFor] = useState<{ open: boolean; roomId: string | null }>({ open: false, roomId: null });
  if (openedFor.open !== open || openedFor.roomId !== (room?.id ?? null)) {
    setOpenedFor({ open, roomId: room?.id ?? null });
    if (open) setForm(room ? fromRoom(room) : EMPTY);
  }

  useEffect(() => {
    if (categories.error) toast.error("Erro ao carregar categorias.");
  }, [categories.error]);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((previous) => ({ ...previous, [field]: value }));

  function pickCategory(id: string) {
    const category = categories.data?.find((item) => item.id === id);
    if (!category) return;
    setForm((previous) => ({ ...previous, type: category.name, price: category.price, categoryId: category.id }));
  }

  async function handleSubmit() {
    const problem = editing ? validateRoomUpdate(form) : validateNewRoom(form);
    if (problem) {
      toast.warning(problem);
      return;
    }
    setSaving(true);
    try {
      if (room) {
        const saved = await updateRoom({ id: room.id, number: form.number, categoryId: form.categoryId ?? room.categoryId, capacity: form.capacity, status: form.status });
        onSaved(saved);
        toast.success("Quarto atualizado com sucesso!");
      } else {
        const saved = await createRoom({ number: form.number, categoryId: form.categoryId as string, capacity: form.capacity, status: form.status });
        onSaved(saved);
        toast.success("Quarto criado com sucesso!");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, editing ? "Erro ao atualizar quarto!" : "Erro ao criar quarto."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!room) return;
    setDeleting(true);
    try {
      await deleteRoom(room.id);
      onDeleted(room.id);
      toast.success("Quarto excluído com sucesso!");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Erro ao deletar quarto!"));
    } finally {
      setDeleting(false);
    }
  }

  const categoryList = categories.data ?? [];
  // A categoria atual aparece mesmo antes da lista carregar.
  const hasCurrent = form.categoryId && categoryList.some((category) => category.id === form.categoryId);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
        title={room ? `Quarto ${roomLabel(room)}` : "Novo quarto"}
        description={room ? "Edite as informações ou exclua o quarto." : "Preencha as informações para cadastrar um novo quarto."}
        footer={(
          <>
            {room && (
              <Button variant="ghost" className="mr-auto text-danger hover:text-danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                Excluir quarto
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? "Aguarde…" : room ? "Salvar" : "Criar quarto"}
            </Button>
          </>
        )}
      >
        <form
          className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2"
          onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}
        >
          <Field
            label="Número"
            hint={room?.connectedRoomNumber ? `Unidade conjugada ${room.displayNumber}: uma reserva bloqueia todo o conjunto.` : undefined}
          >
            <Input
              inputMode="numeric"
              placeholder="Ex.: 101"
              className="font-mono"
              value={form.number ? String(form.number) : ""}
              disabled={Boolean(room?.connectedRoomNumber)}
              onChange={(event) => update("number", parseRoomNumber(event.target.value))}
            />
          </Field>
          <Field label="Categoria">
            <Select value={form.categoryId ?? ""} onChange={(event) => pickCategory(event.target.value)}>
              <option value="" disabled>{categories.loading ? "Carregando…" : "Selecione uma categoria"}</option>
              {form.categoryId && !hasCurrent && <option value={form.categoryId}>{form.type}</option>}
              {categoryList.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field label="Capacidade">
            <Input
              type="number"
              min={0}
              value={String(form.capacity)}
              onChange={(event) => {
                const value = Number(event.target.value);
                update("capacity", Number.isNaN(value) || value < 0 ? 0 : value);
              }}
            />
          </Field>
          <Field label="Diária" hint="Vem da categoria.">
            <Input value={form.price ? formatCurrency(form.price) : ""} disabled readOnly className="font-mono" />
          </Field>
          <Field label="Situação" className="min-[480px]:col-span-2">
            <Select value={form.status} onChange={(event) => update("status", event.target.value as OperationalRoomStatus)}>
              <option value="Disponivel">Disponível</option>
              <option value="Manutencao">Manutenção</option>
            </Select>
          </Field>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={room ? `Excluir o quarto ${roomLabel(room)}?` : "Excluir quarto?"}
        description="Essa mudança é irreversível. Quarto com reserva ativa não pode ser excluído."
        confirmLabel="Excluir quarto"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
