"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import apiClient from "../../services/api";
import CriarQuarto from "../../components/quartos/CriarQuartos";
import EditarQuarto from "../../components/quartos/EditarQuartos";
import FiltroQuartos from "../../components/quartos/FiltroQuartos";
import ResumoQuartos from "../../components/quartos/ResumoQuartos";
import TabelaQuartos from "../../components/quartos/TabelaQuartos";
import PageHeader from "../../components/layout/PageHeader";
import PageSection from "../../components/layout/PageSection";
import { Room } from "../../utils/models";
import {
  normalizeOperationalRoomStatus,
  OperationalRoomStatusFilter
} from "../../utils/roomStatus";

interface RoomSummaryDto {
  ocupados: number;
  disponiveis: number;
  manutencao: number;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateRangeIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function normalizeRoom(room: Room): Room {
  return {
    ...room,
    status: normalizeOperationalRoomStatus(room.status)
  };
}

export default function QuartosPage() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const [quartos, setQuartos] = useState<Room[]>([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<OperationalRoomStatusFilter>("Todos");
  const [periodo, setPeriodo] = useState({
    checkIn: formatDateInput(today),
    checkOut: formatDateInput(tomorrow)
  });
  const [resumoPeriodo, setResumoPeriodo] = useState<RoomSummaryDto>({
    ocupados: 0,
    disponiveis: 0,
    manutencao: 0
  });
  const [erroResumo, setErroResumo] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [quartoSelecionado, setQuartoSelecionado] = useState<Room | null>(null);

  useEffect(() => {
    async function fetchQuartos() {
      try {
        const response = await apiClient.get<Room[]>("/api/rooms");
        setQuartos(response.data.map(normalizeRoom));
      } catch (error) {
        console.error("Erro ao carregar quartos", error);
      }
    }

    void fetchQuartos();
  }, []);

  useEffect(() => {
    const checkInTime = new Date(`${periodo.checkIn}T00:00:00`).getTime();
    const checkOutTime = new Date(`${periodo.checkOut}T00:00:00`).getTime();

    if (!Number.isFinite(checkInTime) || !Number.isFinite(checkOutTime) || checkOutTime <= checkInTime) {
      setErroResumo("Periodo invalido. O check-out deve ser posterior ao check-in.");
      return;
    }

    let active = true;

    async function fetchResumo() {
      try {
        const response = await apiClient.get<RoomSummaryDto>("/api/rooms/summary", {
          params: {
            checkIn: buildDateRangeIso(periodo.checkIn),
            checkOut: buildDateRangeIso(periodo.checkOut)
          }
        });

        if (!active) return;

        setResumoPeriodo({
          ocupados: Number(response.data?.ocupados ?? 0),
          disponiveis: Number(response.data?.disponiveis ?? 0),
          manutencao: Number(response.data?.manutencao ?? 0)
        });
        setErroResumo(null);
      } catch (error) {
        if (!active) return;
        setErroResumo("Nao foi possivel carregar a ocupacao para o periodo selecionado.");
        console.error("Erro ao carregar resumo de quartos:", error);
      }
    }

    void fetchResumo();

    return () => {
      active = false;
    };
  }, [periodo.checkIn, periodo.checkOut]);

  const quartosFiltrados = useMemo(() => {
    return quartos.filter((room) => {
      const normalizedStatus = normalizeOperationalRoomStatus(room.status);
      const matchesStatus = status === "Todos" || normalizedStatus === status;
      const matchesSearch =
        busca === "" ||
        String(room.number).toLowerCase().includes(busca.toLowerCase()) ||
        room.type.toLowerCase().includes(busca.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [status, busca, quartos]);

  const handleAbrirModal = (quarto: Room) => {
    setQuartoSelecionado(quarto);
    setModalOpen(true);
  };

  const handleSalvar = (quartoEditado: Room) => {
    const normalizedRoom = normalizeRoom(quartoEditado);
    setQuartos((previous) => previous.map((room) => (room.id === normalizedRoom.id ? normalizedRoom : room)));
  };

  const handleDeletar = (id: string) => {
    setQuartos((previous) => previous.filter((room) => room.id !== id));
  };

  const handleCriar = (novoQuarto: Room) => {
    setQuartos((previous) => [...previous, normalizeRoom(novoQuarto)]);
  };

  return (
    <Box className="min-h-screen p-8 flex flex-col gap-6" sx={{ backgroundColor: "#f9fafb" }}>
      <Box className="flex justify-between items-center flex-wrap gap-4">
        <PageHeader
          title="Quartos"
          description="Controle disponibilidade, manutenção e cadastros dos quartos do hotel."
          actions={
            <>
              <Link href="/dashboard" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] no-underline transition-colors hover:bg-slate-50">
                Dashboard
              </Link>
              <CriarQuarto onCreate={handleCriar} />
            </>
          }
        />
      </Box>

      <PageSection
        title="Ocupação por período"
        description="Calcule a disponibilidade do hotel entre check-in e check-out."
      >
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

        <ResumoQuartos summary={resumoPeriodo} />
      </PageSection>

      <PageSection title="Filtro e tabela" description="Busque quartos, aplique status e edite registros rapidamente.">
        <FiltroQuartos status={status} setStatus={setStatus} busca={busca} setBusca={setBusca} />
        <TabelaQuartos quartos={quartosFiltrados} onEditar={handleAbrirModal} />
      </PageSection>

      <EditarQuarto
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        quarto={quartoSelecionado}
        onSave={handleSalvar}
        onDelete={handleDeletar}
      />
    </Box>
  );
}
