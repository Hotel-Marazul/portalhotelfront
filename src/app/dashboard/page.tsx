"use client";

import { useEffect, useState } from "react";
import { Box, Grid } from "@mui/material";
import ResumoDashboard from "@/components/dashboard/ResumoDashboard";
import GraficoOcupacaoDashboard from "@/components/dashboard/GraficoOcupacaoDashboard";
import StatusQuartosDashboard from "@/components/dashboard/StatusQuartosDashboard";
import ResumoDiaDashboard from "@/components/dashboard/ResumoDiaDashboard";
import { Room, Reservation } from "@/utils/models";
import apiClient from "@/service/api";

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

interface DashboardPageProps {
  quartos: Room[];
  reservas: Reservation[];
}

export default function DashboardPage({ quartos, reservas }: DashboardPageProps) {
  const [resumoQuartos, setResumoQuartos] = useState<RoomSummaryDto | null>(null);
  const [resumoReservas, setResumoReservas] = useState<ReservationCounterSummaryDto | null>(null);
  const [resumoReceita, setResumoReceita] = useState<ReservationRevenueSummaryDto | null>(null);

  useEffect(() => {
    const fetchResumoQuartos = async () => {
      try {
        const res = await apiClient.get("/api/rooms/summary");
        setResumoQuartos(res.data);
      } catch (err) {
        console.error("Erro ao carregar resumo de quartos:", err);
      }
    };

    const fetchResumoReservas = async () => {
      try {
        const res = await apiClient.get("/api/reservations/counter-summary");
        console.log("Resumo Reservas:", res.data);

        setResumoReservas(res.data);
      } catch (err) {
        console.error("Erro ao carregar resumo de reservas:", err);
      }
    };

    const fetchResumoReceita = async () => {
     try {
       const res = await apiClient.get("/api/reservations/revenue-summary");
       setResumoReceita(res.data);
     } catch (err) {
       console.error("Erro ao carregar resumo de receita:", err);
     }
    };

    fetchResumoQuartos();
    fetchResumoReservas();
    fetchResumoReceita();
  }, []);

  // Dados vindos da API ou fallback
  const dadosOcupacao =
    resumoReservas?.taxaOcupacaoMes?.map((t) => ({
      mes: t.mes,
      taxa: t.taxa,
    })) ?? [
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

  const checkInsHoje = resumoReservas?.checkInsHoje ?? 0;
  const checkOutsHoje = resumoReservas?.checkOutsHoje ?? 0;
  const reservasAtivas = resumoReservas?.reservasAtivas ?? 0;
  const receitaHoje = resumoReceita?.receitaHoje ?? 0;
  const receitaMesAtual = resumoReceita?.receitaMesAtual ?? 0;
  const receitaMesAnterior = resumoReceita?.receitaMesAnterior ?? 0;
  
  return (
    <Box
      className="min-h-screen p-8 flex flex-col gap-6"
      sx={{ backgroundColor: "#f9fafb" }}
    >
      {/* 1️⃣ Resumo do Hotel */}
      <ResumoDashboard
        resumoQuartos={resumoQuartos}
        receitaMesAtual={receitaMesAtual}
        receitaMesAnterior={receitaMesAnterior}
        reservasAtivas={reservasAtivas}
      />


      {/* 2️⃣ Linha do meio: gráfico + status */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GraficoOcupacaoDashboard dados={dadosOcupacao} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <StatusQuartosDashboard
            ocupados={resumoQuartos?.ocupados ?? 0}
            disponiveis={resumoQuartos?.disponiveis ?? 0}
            total={
              resumoQuartos
                ? resumoQuartos.ocupados + resumoQuartos.disponiveis
                : 0
            }
          />
        </Grid>
      </Grid>

      {/* 3️⃣ Resumo do Dia */}
      <ResumoDiaDashboard
        checkIns={checkInsHoje}
        checkOuts={checkOutsHoje}
        receita={receitaHoje}
      />
    </Box>
  );
}
