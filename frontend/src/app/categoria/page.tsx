"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type { Category, Room } from "../../utils/models";
import { formatReservationCalendarDate } from "../../utils/reservation";
import CategoriaSheet from "../../components/categorias/CategoriaSheet";
import HospedesAdicionais from "../../components/categorias/HospedesAdicionais";
import TabelaTarifas from "../../components/categorias/TabelaTarifas";
import ValidadeTarifas from "../../components/categorias/ValidadeTarifas";
import {
  HOTEL_STAY_RULES, bookableUnitCount, seasonName, sortCategories, validityPeriods, type PricingRuleDto,
} from "../../components/categorias/tarifas-data";
import Button from "../../components/ui/Button";
import { indicatorState } from "../../components/today/today-data";

// A categoria fica guardada ao fechar, para o título não trocar durante a animação.
interface SheetState { open: boolean; category: Category | null }

const STAY_ITEMS = [
  { label: "Entrada", value: HOTEL_STAY_RULES.checkIn, mono: true },
  { label: "Saída", value: HOTEL_STAY_RULES.checkOut, mono: true },
  { label: "Estadia mínima", value: HOTEL_STAY_RULES.minimumStay, mono: false },
];

export default function CategoriasPage() {
  const { user } = useCurrentUser();
  // Criar, editar e excluir categoria exigem gerente no backend.
  const canEdit = user?.role === "admin";

  // A rota antiga é a única que traz meia pensão e validade.
  const categories = useCachedFetch<Category[]>("/api/Categories", { cacheKey: "tarifas:categories" });
  const rooms = useCachedFetch<Room[]>("/api/rooms", { cacheKey: "tarifas:rooms" });
  const rules = useCachedFetch<PricingRuleDto[]>("/api/pricing-rules", { cacheKey: "tarifas:rules" });

  const [sheet, setSheet] = useState<SheetState>({ open: false, category: null });
  const today = formatReservationCalendarDate(new Date());

  const categoriesState = indicatorState(categories);
  const rulesState = indicatorState(rules);
  const sorted = useMemo(() => sortCategories(categories.data ?? []), [categories.data]);
  const periods = useMemo(() => validityPeriods(sorted), [sorted]);
  const season = periods.length === 1 ? seasonName(periods[0]) : null;
  const units = rooms.data ? bookableUnitCount(rooms.data) : null;

  return (
    <div className="flex flex-col gap-5 px-5 py-6 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:px-8 min-[900px]:py-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Categorias e tarifas</h1>
          {categoriesState.kind === "ready" && (
            <span className="text-fg-3">
              <span className="font-mono">{sorted.length}</span> {sorted.length === 1 ? "categoria" : "categorias"}
              {units !== null && <> · <span className="font-mono">{units}</span> {units === 1 ? "unidade" : "unidades"}</>}
            </span>
          )}
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setSheet({ open: true, category: null })}>
            <Plus aria-hidden="true" />
            Nova categoria
          </Button>
        )}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 min-[900px]:min-h-0 min-[900px]:flex-1 min-[1100px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6 min-[900px]:min-h-0">
          <section aria-labelledby="diarias" className="flex min-h-0 flex-col gap-1.5">
            <div className="flex shrink-0 items-baseline justify-between gap-3">
              <h2 id="diarias" className="m-0 text-[15px] font-semibold">Diária de casal{season ? ` · ${season}` : ""}</h2>
              <span className="text-xs text-fg-3">duas pessoas incluídas</span>
            </div>
            <div className="min-h-0 overflow-auto">
              {categoriesState.kind === "loading" && (
                <div aria-busy="true" className="flex flex-col gap-2 pt-2">
                  <span className="sr-only">Carregando</span>
                  {[0, 1, 2, 3].map((row) => <span key={row} aria-hidden="true" className="h-12 animate-pulse rounded-bar bg-muted" />)}
                </div>
              )}
              {categoriesState.kind === "error" && (
                <div role="alert" className="flex items-center gap-3 py-6 text-[13px] text-danger">
                  Não foi possível carregar as categorias.
                  <Button size="sm" onClick={categories.refetch}>Tentar novamente</Button>
                </div>
              )}
              {categoriesState.kind === "ready" && (
                <TabelaTarifas
                  categories={sorted}
                  rooms={rooms.data}
                  roomsError={!!rooms.error}
                  onEdit={canEdit ? (category) => setSheet({ open: true, category }) : undefined}
                />
              )}
            </div>
          </section>

          <HospedesAdicionais status={rulesState.kind} rules={rulesState.kind === "ready" ? rulesState.data : []} />

          <dl className="m-0 grid shrink-0 grid-cols-3 overflow-hidden border-y border-rule">
            {STAY_ITEMS.map((item) => (
              <div key={item.label} className="-ml-px flex flex-col-reverse gap-1 border-l border-rule py-3.5 pl-[18px]">
                <dt className="text-[13px] text-fg-3">{item.label}</dt>
                <dd className={`m-0 text-xl ${item.mono ? "font-mono" : ""}`}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-6 min-[900px]:min-h-0 min-[900px]:overflow-y-auto">
          {categoriesState.kind === "ready" && <ValidadeTarifas periods={periods} today={today} categoryCount={sorted.length} />}
        </div>
      </div>

      {canEdit && (
        <CategoriaSheet
          open={sheet.open}
          onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
          category={sheet.category}
          onSaved={categories.refetch}
        />
      )}
    </div>
  );
}
