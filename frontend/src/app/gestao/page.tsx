"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useHotelNow } from "../../hooks/useHotelNow";
import { formatCurrency } from "../../utils/format";
import { formatReservationCalendarDate } from "../../utils/reservation";
import { CommandBarTrigger } from "../../components/command/CommandBar";
import OccupancyBars from "../../components/gestao/OccupancyBars";
import {
  amountToReceive,
  formatCompactCurrency,
  formatMonthChange,
  formatPointsChange,
  formatRate,
  monthChange,
  monthHeading,
  occupancyBars,
  type MonthlyOccupancy,
} from "../../components/gestao/gestao-data";
import { indicatorState } from "../../components/today/today-data";
import { Kpi, KpiRow, type KpiTone } from "../../components/ui/Kpi";

interface RevenueSummary {
  receitaMesAtual: number;
  receitaMesAnterior: number;
  recebidaMesAtual: number;
  recebidaMesAnterior: number;
}

interface CounterSummary {
  taxaOcupacaoMes: MonthlyOccupancy[];
}

const changeTone = (change: number | null): KpiTone => (change === null || change >= 0 ? "accent" : "danger");

function Money({ value }: { value: number }) {
  return <span className="font-mono" title={formatCurrency(value)}>{formatCompactCurrency(value)}</span>;
}

export default function GestaoPage() {
  const router = useRouter();
  const now = useHotelNow();
  const { user, status: userStatus } = useCurrentUser();
  const isAdmin = userStatus === "ready" && user?.role === "admin";

  // A recepção não vê a Gestão: vai para o Hoje sem que revenue-summary seja chamada.
  useEffect(() => {
    if (userStatus === "ready" && user?.role !== "admin") router.replace("/dashboard");
  }, [router, user, userStatus]);

  const revenue = useCachedFetch<RevenueSummary>("/api/reservations/revenue-summary", { cacheKey: "gestao:revenue", enabled: isAdmin });
  const counter = useCachedFetch<CounterSummary>("/api/reservations/counter-summary", { cacheKey: "gestao:counter", enabled: isAdmin });

  const revenueState = indicatorState(revenue);
  const counterState = indicatorState(counter);
  const revenueStatus = revenueState.kind === "ready" ? "ready" : revenueState.kind;
  const counterStatus = counterState.kind === "ready" ? "ready" : counterState.kind;
  const money = revenueState.kind === "ready" ? revenueState.data : null;
  const bars = occupancyBars(counterState.kind === "ready" ? counterState.data.taxaOcupacaoMes : null);
  const currentMonth = bars.at(-1);
  const previousMonth = bars.length > 1 ? bars[bars.length - 2] : undefined;

  const revenueChange = money ? monthChange(money.receitaMesAtual, money.receitaMesAnterior) : null;
  const receivedChange = money ? monthChange(money.recebidaMesAtual, money.recebidaMesAnterior) : null;
  const toReceive = money ? amountToReceive(money.receitaMesAtual, money.recebidaMesAtual) : null;
  const heading = now ? monthHeading(formatReservationCalendarDate(now)) : null;

  if (!isAdmin) {
    return <div aria-busy="true" className="flex-1"><span className="sr-only">Carregando</span></div>;
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:px-9 min-[900px]:py-7">
      <header className="flex shrink-0 flex-col gap-0.5">
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{heading ? heading.title : "Gestão"}</h1>
        <span className="min-h-5 text-fg-3">{heading ? `${heading.detail} · comparado com o mês anterior` : ""}</span>
      </header>

      <CommandBarTrigger className="shrink-0" />

      <div className="flex shrink-0 flex-col gap-2">
        <KpiRow>
          <Kpi
            label="Receita do mês"
            status={revenueStatus}
            value={money && <Money value={money.receitaMesAtual} />}
            note={formatMonthChange(revenueChange) ?? undefined}
            noteTone={changeTone(revenueChange)}
            errorText="Não foi possível carregar os números financeiros"
          />
          <Kpi
            label="Recebido no mês"
            status={revenueStatus}
            value={money && <Money value={money.recebidaMesAtual} />}
            note={formatMonthChange(receivedChange) ?? undefined}
            noteTone={changeTone(receivedChange)}
            errorText="Indisponível"
          />
          <Kpi
            label="A receber"
            status={revenueStatus}
            value={toReceive !== null && <Money value={toReceive} />}
            errorText="Indisponível"
          />
          <Kpi
            label="Ocupação do mês"
            status={counterStatus === "ready" && !currentMonth ? "error" : counterStatus}
            value={currentMonth && <span className="font-mono">{formatRate(currentMonth.rate)}</span>}
            note={currentMonth && previousMonth ? formatPointsChange(currentMonth.rate, previousMonth.rate) ?? undefined : undefined}
            noteTone={currentMonth && previousMonth && currentMonth.rate < previousMonth.rate ? "danger" : "accent"}
          />
        </KpiRow>
        {revenueStatus === "ready" && (
          <p className="m-0 text-xs text-fg-3">
            Receita: reservas não canceladas com entrada no mês. Recebido: pagamentos lançados no mês. A receber: receita menos recebido.
          </p>
        )}
      </div>

      <OccupancyBars status={counterStatus} bars={bars} />
    </div>
  );
}
