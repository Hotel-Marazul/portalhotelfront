"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Grid, Stack, TextField, Typography } from "@mui/material";
import ResumoDashboard from "../../components/dashboard/ResumoDashboard";
import GraficoOcupacaoDashboard from "../../components/dashboard/GraficoOcupacaoDashboard";
import StatusQuartosDashboard from "../../components/dashboard/StatusQuartosDashboard";
import ResumoDiaDashboard from "../../components/dashboard/ResumoDiaDashboard";
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
  { mes: "Set", taxa: 88 }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : 0;
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
    manutencao: toNumber(payload.manutencao)
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
    reservasAtivas: toNumber(payload.reservasAtivas)
  };
}

function normalizeRevenueSummary(payload: unknown): ReservationRevenueSummaryDto {
  if (!isRecord(payload)) return { receitaHoje: 0, receitaMesAtual: 0, receitaMesAnterior: 0 };

  return {
    receitaHoje: toNumber(payload.receitaHoje),
    receitaMesAtual: toNumber(payload.receitaMesAtual),
    receitaMesAnterior: toNumber(payload.receitaMesAnterior)
  };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    checkOut: formatDateInput(tomorrow)
  });
  const [resumoQuartos, setResumoQuartos] = useState<RoomSummaryDto>({
    ocupados: 0,
    disponiveis: 0,
    manutencao: 0
  });
  const [resumoReservas, setResumoReservas] = useState<ReservationCounterSummaryDto>({
    taxaOcupacaoMes: [],
    checkInsHoje: 0,
    checkOutsHoje: 0,
    reservasAtivas: 0
  });
  const [resumoReceita, setResumoReceita] = useState<ReservationRevenueSummaryDto>({
    receitaHoje: 0,
    receitaMesAtual: 0,
    receitaMesAnterior: 0
  });
  const [erroResumo, setErroResumo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkInTime = new Date(`${periodo.checkIn}T00:00:00`).getTime();
    const checkOutTime = new Date(`${periodo.checkOut}T00:00:00`).getTime();
    const invalidPeriod =
      !Number.isFinite(checkInTime) || !Number.isFinite(checkOutTime) || checkOutTime <= checkInTime;

    const fetchDashboard = async () => {
      const roomRequest = invalidPeriod
        ? Promise.resolve({ data: { ocupados: 0, disponiveis: 0, manutencao: 0 } })
        : apiClient.get("/api/rooms/summary", {
            params: {
              checkIn: toPeriodIso(periodo.checkIn),
              checkOut: toPeriodIso(periodo.checkOut)
            }
          });

      const [roomsResponse, counterResponse, revenueResponse] = await Promise.allSettled([
        roomRequest,
        apiClient.get("/api/reservations/counter-summary"),
        apiClient.get("/api/reservations/revenue-summary")
      ]);

      if (!active) return;

      if (roomsResponse.status === "fulfilled") {
        setResumoQuartos(normalizeRoomSummary(roomsResponse.value.data));
      } else {
        console.error("Erro ao carregar resumo de quartos:", roomsResponse.reason);
      }

      if (counterResponse.status === "fulfilled") {
        setResumoReservas(normalizeCounterSummary(counterResponse.value.data));
      } else {
        console.error("Erro ao carregar resumo de reservas:", counterResponse.reason);
      }

      if (revenueResponse.status === "fulfilled") {
        setResumoReceita(normalizeRevenueSummary(revenueResponse.value.data));
      } else {
        console.error("Erro ao carregar resumo de receita:", revenueResponse.reason);
      }

      if (invalidPeriod) {
        setErroResumo("Periodo invalido. O check-out deve ser posterior ao check-in.");
      } else if (
        roomsResponse.status === "rejected" &&
        counterResponse.status === "rejected" &&
        revenueResponse.status === "rejected"
      ) {
        setErroResumo("Nao foi possivel carregar os indicadores do dashboard.");
      } else {
        setErroResumo(null);
      }
    };

    void fetchDashboard();

    return () => {
      active = false;
    };
  }, [periodo.checkIn, periodo.checkOut]);

  const dadosOcupacao = useMemo(() => {
    if (resumoReservas.taxaOcupacaoMes.length > 0) {
      return resumoReservas.taxaOcupacaoMes;
    }
    return FALLBACK_OCCUPANCY;
  }, [resumoReservas.taxaOcupacaoMes]);

  return (
    <Box className="min-h-screen p-8 flex flex-col gap-6" sx={{ backgroundColor: "#f9fafb" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Ocupacao por periodo:
        </Typography>
        <TextField
          type="date"
          label="Check-in"
          value={periodo.checkIn}
          onChange={(event) => setPeriodo((previous) => ({ ...previous, checkIn: event.target.value }))}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          type="date"
          label="Check-out"
          value={periodo.checkOut}
          onChange={(event) => setPeriodo((previous) => ({ ...previous, checkOut: event.target.value }))}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
      </Stack>

      {erroResumo && <Alert severity="warning">{erroResumo}</Alert>}

      <ResumoDashboard
        resumoQuartos={resumoQuartos}
        receitaMesAtual={resumoReceita.receitaMesAtual}
        receitaMesAnterior={resumoReceita.receitaMesAnterior}
        reservasAtivas={resumoReservas.reservasAtivas}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GraficoOcupacaoDashboard dados={dadosOcupacao} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <StatusQuartosDashboard
            ocupados={resumoQuartos.ocupados}
            disponiveis={resumoQuartos.disponiveis}
            total={resumoQuartos.ocupados + resumoQuartos.disponiveis}
          />
        </Grid>
      </Grid>

      <ResumoDiaDashboard
        checkIns={resumoReservas.checkInsHoje}
        checkOuts={resumoReservas.checkOutsHoje}
        receita={resumoReceita.receitaHoje}
      />
    </Box>
  );
}
