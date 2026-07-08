"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@mui/material";
import Link from "next/link";
import ResumoDashboard from "../../components/dashboard/ResumoDashboard";
import GraficoOcupacaoDashboard from "../../components/dashboard/GraficoOcupacaoDashboard";
import StatusQuartosDashboard from "../../components/dashboard/StatusQuartosDashboard";
import ResumoDiaDashboard from "../../components/dashboard/ResumoDiaDashboard";
import PageHeader from "../../components/layout/PageHeader";
import PageSection from "../../components/layout/PageSection";
import apiClient from "../../services/api";

interface RoomSummaryDto {
  ocupados: number;
  disponiveis: number;
  manutencao: number;
}

interface OccupancyRateDto {
  mes: string;
  taxa: number;
}

interface ReservationCounterSummaryDto {
  taxaOcupacaoMes: OccupancyRateDto[];
  checkInsHoje: number;
  checkOutsHoje: number;
  reservasAtivas: number;
}

interface ReservationRevenueSummaryDto {
  receitaHoje: number;
  receitaMesAtual: number;
  receitaMesAnterior: number;
}

const FALLBACK_OCCUPANCY: OccupancyRateDto[] = [
  { mes: "Jan", taxa: 72 },
  { mes: "Fev", taxa: 78 },
  { mes: "Mar", taxa: 84 },
  { mes: "Abr", taxa: 81 },
  { mes: "Mai", taxa: 89 },
  { mes: "Jun", taxa: 92 },
  { mes: "Jul", taxa: 87 },
  { mes: "Ago", taxa: 91 },
  { mes: "Set", taxa: 88 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeOccupancyRate(payload: unknown): OccupancyRateDto[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!isRecord(item)) return null;
      const mes = typeof item.mes === "string" ? item.mes : "";
      const taxa = toNumber(item.taxa);
      if (!mes) return null;
      return { mes, taxa: Math.max(0, Math.min(100, taxa)) };
    })
    .filter((item): item is OccupancyRateDto => item !== null);
}

function normalizeRoomSummary(payload: unknown): RoomSummaryDto {
  if (!isRecord(payload)) return { ocupados: 0, disponiveis: 0, manutencao: 0 };
  return {
    ocupados: toNumber(payload.ocupados),
    disponiveis: toNumber(payload.disponiveis),
    manutencao: toNumber(payload.manutencao),
  };
}

function normalizeCounterSummary(payload: unknown): ReservationCounterSummaryDto {
  if (!isRecord(payload)) {
    return { taxaOcupacaoMes: [], checkInsHoje: 0, checkOutsHoje: 0, reservasAtivas: 0 };
  }
  return {
    taxaOcupacaoMes: normalizeOccupancyRate(payload.taxaOcupacaoMes),
    checkInsHoje: toNumber(payload.checkInsHoje),
    checkOutsHoje: toNumber(payload.checkOutsHoje),
    reservasAtivas: toNumber(payload.reservasAtivas),
  };
}

function normalizeRevenueSummary(payload: unknown): ReservationRevenueSummaryDto {
  if (!isRecord(payload)) return { receitaHoje: 0, receitaMesAtual: 0, receitaMesAnterior: 0 };
  return {
    receitaHoje: toNumber(payload.receitaHoje),
    receitaMesAtual: toNumber(payload.receitaMesAtual),
    receitaMesAnterior: toNumber(payload.receitaMesAnterior),
  };
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toPeriodIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

export default function DashboardPage() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const [periodo, setPeriodo] = useState({
    checkIn: formatDateInput(today),
    checkOut: formatDateInput(tomorrow),
  });
  const [resumoQuartos, setResumoQuartos] = useState<RoomSummaryDto>({
    ocupados: 0,
    disponiveis: 0,
    manutencao: 0,
  });
  const [resumoReservas, setResumoReservas] = useState<ReservationCounterSummaryDto>({
    taxaOcupacaoMes: [],
    checkInsHoje: 0,
    checkOutsHoje: 0,
    reservasAtivas: 0,
  });
  const [resumoReceita, setResumoReceita] = useState<ReservationRevenueSummaryDto>({
    receitaHoje: 0,
    receitaMesAtual: 0,
    receitaMesAnterior: 0,
  });
  const [erroResumo, setErroResumo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkInTime = new Date(`${periodo.checkIn}T00:00:00`).getTime();
    const checkOutTime = new Date(`${periodo.checkOut}T00:00:00`).getTime();
    const invalidPeriod =
      !Number.isFinite(checkInTime) ||
      !Number.isFinite(checkOutTime) ||
      checkOutTime <= checkInTime;

    const fetchDashboard = async () => {
      const roomRequest = invalidPeriod
        ? Promise.resolve({ data: { ocupados: 0, disponiveis: 0, manutencao: 0 } })
        : apiClient.get("/api/rooms/summary", {
            params: {
              checkIn: toPeriodIso(periodo.checkIn),
              checkOut: toPeriodIso(periodo.checkOut),
            },
          });

      const [roomsRes, counterRes, revenueRes] = await Promise.allSettled([
        roomRequest,
        apiClient.get("/api/reservations/counter-summary"),
        apiClient.get("/api/reservations/revenue-summary"),
      ]);

      if (!active) return;

      if (roomsRes.status === "fulfilled") setResumoQuartos(normalizeRoomSummary(roomsRes.value.data));
      if (counterRes.status === "fulfilled") setResumoReservas(normalizeCounterSummary(counterRes.value.data));
      if (revenueRes.status === "fulfilled") setResumoReceita(normalizeRevenueSummary(revenueRes.value.data));

      if (invalidPeriod) {
        setErroResumo("Período inválido. O check-out deve ser posterior ao check-in.");
      } else if (
        roomsRes.status === "rejected" &&
        counterRes.status === "rejected" &&
        revenueRes.status === "rejected"
      ) {
        setErroResumo("Não foi possível carregar os indicadores do dashboard.");
      } else {
        setErroResumo(null);
      }
    };

    void fetchDashboard();
    return () => { active = false; };
  }, [periodo.checkIn, periodo.checkOut]);

  const dadosOcupacao = useMemo(() => {
    return resumoReservas.taxaOcupacaoMes.length > 0
      ? resumoReservas.taxaOcupacaoMes
      : FALLBACK_OCCUPANCY;
  }, [resumoReservas.taxaOcupacaoMes]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "28px 32px 32px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação: ocupação, receita, status dos quartos e atalhos para as rotinas do dia."
        actions={
          <>
            <Link href="/reservas" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] no-underline transition-colors hover:bg-slate-50">
              Ver reservas
            </Link>
            <Link href="/quarto" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] no-underline transition-colors hover:bg-slate-50">
              Gerir quartos
            </Link>
            <Link href="/cliente" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white no-underline transition-colors hover:opacity-90">
              Novo hóspede
            </Link>
          </>
        }
      />

      <PageSection title="Resumo do dia" description="Indicadores mais urgentes da operação de hoje.">
        <ResumoDiaDashboard
          checkIns={resumoReservas.checkInsHoje}
          checkOuts={resumoReservas.checkOutsHoje}
          receita={resumoReceita.receitaHoje}
        />
      </PageSection>

      {erroResumo && <Alert severity="warning" sx={{ borderRadius: "10px" }}>{erroResumo}</Alert>}

      <PageSection title="Disponibilidade por período" description="Use o intervalo para atualizar os indicadores de quartos.">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            Período
          </span>
          <input
            type="date"
            value={periodo.checkIn}
            onChange={(e) => setPeriodo((prev) => ({ ...prev, checkIn: e.target.value }))}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--border)",
              borderRadius: "7px",
              fontSize: "0.8rem",
              fontFamily: "DM Sans, sans-serif",
              color: "var(--text-primary)",
              background: "var(--surface-alt)",
              outline: "none",
            }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
          <input
            type="date"
            value={periodo.checkOut}
            onChange={(e) => setPeriodo((prev) => ({ ...prev, checkOut: e.target.value }))}
            style={{
              padding: "6px 10px",
              border: "1px solid var(--border)",
              borderRadius: "7px",
              fontSize: "0.8rem",
              fontFamily: "DM Sans, sans-serif",
              color: "var(--text-primary)",
              background: "var(--surface-alt)",
              outline: "none",
            }}
          />
        </div>
      </PageSection>

      <PageSection title="Indicadores" description="Resumo financeiro e operacional do período selecionado.">
        <ResumoDashboard
          resumoQuartos={resumoQuartos}
          receitaMesAtual={resumoReceita.receitaMesAtual}
          receitaMesAnterior={resumoReceita.receitaMesAnterior}
          reservasAtivas={resumoReservas.reservasAtivas}
        />
      </PageSection>

      <PageSection title="Visão gráfica" description="Acompanhe a ocupação histórica e o status atual dos quartos.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          <GraficoOcupacaoDashboard dados={dadosOcupacao} />
          <StatusQuartosDashboard
            ocupados={resumoQuartos.ocupados}
            disponiveis={resumoQuartos.disponiveis}
            total={resumoQuartos.ocupados + resumoQuartos.disponiveis + resumoQuartos.manutencao}
          />
        </div>
      </PageSection>
    </div>
  );
}
