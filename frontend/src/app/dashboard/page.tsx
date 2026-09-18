"use client";

import { useEffect, useState } from "react";
import { Alert, Skeleton } from "@mui/material";
import { isAxiosError } from "axios";
import Link from "next/link";
import ResumoDashboard from "../../components/dashboard/ResumoDashboard";
import GraficoOcupacaoDashboard from "../../components/dashboard/GraficoOcupacaoDashboard";
import StatusQuartosDashboard from "../../components/dashboard/StatusQuartosDashboard";
import ResumoDiaDashboard from "../../components/dashboard/ResumoDiaDashboard";
import PageHeader from "../../components/layout/PageHeader";
import PageSection from "../../components/layout/PageSection";
import apiClient from "../../services/api";
import { formatReservationCalendarDate, parseReservationDate } from "../../utils/reservation";

interface RoomSummaryDto {
  ocupados: number;
  disponiveis: number;
  manutencao: number;
}

interface OccupancyRateDto {
  mes: string;
  taxa: number;
  quartoNoites?: number;
}

interface ReservationCounterSummaryDto {
  taxaOcupacaoMes: OccupancyRateDto[];
  checkInsHoje: number;
  checkOutsHoje: number;
  reservasAtivas: number;
  pendenciasVencidas: number;
}

interface ReservationRevenueSummaryDto {
  receitaHoje: number;
  receitaMesAtual: number;
  receitaMesAnterior: number;
  recebidaHoje: number;
  recebidaMesAtual: number;
  recebidaMesAnterior: number;
}

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
      const normalized: OccupancyRateDto = {
        mes,
        taxa: Math.max(0, Math.min(100, taxa)),
      };
      if (item.quartoNoites !== undefined) normalized.quartoNoites = toNumber(item.quartoNoites);
      return normalized;
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
    return { taxaOcupacaoMes: [], checkInsHoje: 0, checkOutsHoje: 0, reservasAtivas: 0, pendenciasVencidas: 0 };
  }
  return {
    taxaOcupacaoMes: normalizeOccupancyRate(payload.taxaOcupacaoMes),
    checkInsHoje: toNumber(payload.checkInsHoje),
    checkOutsHoje: toNumber(payload.checkOutsHoje),
    reservasAtivas: toNumber(payload.reservasAtivas),
    pendenciasVencidas: toNumber(payload.pendenciasVencidas),
  };
}

function normalizeRevenueSummary(payload: unknown): ReservationRevenueSummaryDto | null {
  if (!isRecord(payload)) return null;
  const fields = [
    "receitaHoje",
    "receitaMesAtual",
    "receitaMesAnterior",
    "recebidaHoje",
    "recebidaMesAtual",
    "recebidaMesAnterior",
  ] as const;
  const values = fields.map((field) => {
    const value = payload[field];
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  });
  if (!values.every((value): value is number => value !== null)) return null;
  const [receitaHoje, receitaMesAtual, receitaMesAnterior, recebidaHoje, recebidaMesAtual, recebidaMesAnterior] = values;
  return { receitaHoje, receitaMesAtual, receitaMesAnterior, recebidaHoje, recebidaMesAtual, recebidaMesAnterior };
}

export default function DashboardPage() {
  const today = parseReservationDate(formatReservationCalendarDate(new Date()));
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const checkIn = formatReservationCalendarDate(today);
  const checkOut = formatReservationCalendarDate(tomorrow);
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
    pendenciasVencidas: 0,
  });
  const [resumoReceita, setResumoReceita] = useState<ReservationRevenueSummaryDto>({
    receitaHoje: 0,
    receitaMesAtual: 0,
    receitaMesAnterior: 0,
    recebidaHoje: 0,
    recebidaMesAtual: 0,
    recebidaMesAnterior: 0,
  });
  const [loading, setLoading] = useState(true);
  const [canViewFinance, setCanViewFinance] = useState<boolean | null>(null);
  const [erroSessao, setErroSessao] = useState<string | null>(null);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [erroFinanceiro, setErroFinanceiro] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const invalidPeriod =
      !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) ||
      checkOut <= checkIn;

    const fetchDashboard = async () => {
      setLoading(true);
      setErroSessao(null);
      setErroResumo(null);
      setErroFinanceiro(null);
      setCanViewFinance(null);

      try {
        const session = await apiClient.get<{ role?: string }>("/api/User/me");
        const isAdmin = session.data.role === "admin";
        const isReceptionist = session.data.role === "receptionist";
        if (!isAdmin && !isReceptionist) throw new Error("Sessão inválida.");
        if (!active) return;
        setCanViewFinance(isAdmin);

        const roomRequest = invalidPeriod
          ? Promise.resolve({ data: { ocupados: 0, disponiveis: 0, manutencao: 0 } })
          : apiClient.get("/api/rooms/summary", {
              params: {
                checkIn,
                checkOut,
              },
            });
        const [roomsRes, counterRes] = await Promise.allSettled([
          roomRequest,
          apiClient.get("/api/reservations/counter-summary"),
        ]);

        if (!active) return;
        if (roomsRes.status === "fulfilled") setResumoQuartos(normalizeRoomSummary(roomsRes.value.data));
        if (counterRes.status === "fulfilled") setResumoReservas(normalizeCounterSummary(counterRes.value.data));

        if (isAdmin) {
          try {
            const revenue = await apiClient.get("/api/reservations/revenue-summary");
            const normalizedRevenue = normalizeRevenueSummary(revenue.data);
            if (!normalizedRevenue) throw new Error("Resumo financeiro inválido");
            if (!active) return;
            setResumoReceita(normalizedRevenue);
          } catch {
            if (!active) return;
            setErroFinanceiro("Não foi possível carregar os indicadores financeiros. A visão operacional continua disponível.");
          }
        }

        if (invalidPeriod) {
          setErroResumo("Período inválido. O check-out deve ser posterior ao check-in.");
        } else if (roomsRes.status === "rejected" || counterRes.status === "rejected") {
          setErroResumo("Não foi possível carregar todos os indicadores operacionais. Tente atualizar a página.");
        }
      } catch (error) {
        if (!active) return;
        setCanViewFinance(false);
        setErroSessao(
          isAxiosError(error) && error.response?.status === 401
            ? "Sua sessão expirou. Faça login novamente."
            : "Não foi possível validar sua sessão."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchDashboard();
    return () => { active = false; };
  }, [checkIn, checkOut]);

  const dadosOcupacao = resumoReservas.taxaOcupacaoMes;
  const showFinancial = canViewFinance === true && !erroFinanceiro;

  return (
    <div className="page-content">
      <PageHeader
        title="Hoje"
        description="Veja o que exige atenção agora e avance para a Agenda quando precisar agir."
        actions={
          <Link href="/reservas" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white no-underline transition-colors hover:opacity-90">
            Abrir agenda
          </Link>
        }
      />

      {loading ? <Skeleton variant="rounded" height={140} aria-label="Carregando indicadores" /> : erroSessao ? (
        <Alert severity="error" sx={{ borderRadius: "10px" }}>{erroSessao}</Alert>
      ) : <>
        {!erroResumo && (
          <PageSection title="Resumo do dia" description="Indicadores mais urgentes da operação de hoje.">
            <ResumoDiaDashboard
              checkIns={resumoReservas.checkInsHoje}
              checkOuts={resumoReservas.checkOutsHoje}
              receita={showFinancial ? resumoReceita.receitaHoje : undefined}
              pendencias={resumoReservas.pendenciasVencidas}
            />
          </PageSection>
        )}

        {erroResumo && <Alert severity="warning" sx={{ borderRadius: "10px" }}>{erroResumo}</Alert>}
        {erroFinanceiro && <Alert severity="info" sx={{ borderRadius: "10px" }}>{erroFinanceiro}</Alert>}

        {!erroResumo && <>
      <PageSection
        title="Indicadores"
        description={showFinancial ? "Resumo financeiro e operacional do período selecionado." : "Resumo operacional do período selecionado."}
      >
        <ResumoDashboard
          resumoQuartos={resumoQuartos}
          receitaMesAtual={resumoReceita.receitaMesAtual}
          receitaMesAnterior={resumoReceita.receitaMesAnterior}
          recebidaMesAtual={resumoReceita.recebidaMesAtual}
          showFinancial={showFinancial}
          reservasAtivas={resumoReservas.reservasAtivas}
        />
      </PageSection>

      <PageSection title="Visão gráfica" description="Acompanhe a ocupação histórica e o status atual dos quartos.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "16px" }}>
          <GraficoOcupacaoDashboard dados={dadosOcupacao} />
          <StatusQuartosDashboard
            ocupados={resumoQuartos.ocupados}
            disponiveis={resumoQuartos.disponiveis}
            total={resumoQuartos.ocupados + resumoQuartos.disponiveis}
          />
        </div>
      </PageSection>
        </>}
      </>}
    </div>
  );
}
