"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Skeleton, Stack, TextField, Typography } from "@mui/material";
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
import { formatReservationCalendarDate, parseReservationDate } from "../../utils/reservation";

interface RoomSummaryDto {
  ocupados: number;
  disponiveis: number;
  manutencao: number;
}

function normalizeRoom(room: Room): Room {
  return {
    ...room,
    status: normalizeOperationalRoomStatus(room.status)
  };
}

export default function QuartosPage() {
  const today = parseReservationDate(formatReservationCalendarDate(new Date()));
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [quartos, setQuartos] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<OperationalRoomStatusFilter>("Todos");
  const [periodo, setPeriodo] = useState({
    checkIn: formatReservationCalendarDate(today),
    checkOut: formatReservationCalendarDate(tomorrow)
  });
  const [resumoPeriodo, setResumoPeriodo] = useState<RoomSummaryDto | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [quartoSelecionado, setQuartoSelecionado] = useState<Room | null>(null);

  useEffect(() => {
    async function fetchQuartos() {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await apiClient.get<Room[]>("/api/rooms");
        setQuartos(response.data.map(normalizeRoom));
      } catch (error) {
        setLoadError(true);
        console.error("Erro ao carregar quartos", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchQuartos();
  }, [reload]);

  useEffect(() => {
    let active = true;
    setResumoPeriodo(null);
    setErroResumo(null);

    const invalidPeriod =
      !/^\d{4}-\d{2}-\d{2}$/.test(periodo.checkIn) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(periodo.checkOut) ||
      periodo.checkOut <= periodo.checkIn;
    if (invalidPeriod) {
      setCarregandoResumo(false);
      setErroResumo("Periodo invalido. O check-out deve ser posterior ao check-in.");
      return () => { active = false; };
    }

    setCarregandoResumo(true);
    async function fetchResumo() {
      try {
        const response = await apiClient.get<RoomSummaryDto>("/api/rooms/summary", {
          params: {
            checkIn: periodo.checkIn,
            checkOut: periodo.checkOut
          }
        });
        if (!active) return;
        const values = [response.data?.ocupados, response.data?.disponiveis, response.data?.manutencao].map(Number);
        if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Resumo inválido");
        setResumoPeriodo({ ocupados: values[0], disponiveis: values[1], manutencao: values[2] });
      } catch (error) {
        if (!active) return;
        setResumoPeriodo(null);
        setErroResumo("Nao foi possivel carregar a ocupacao para o periodo selecionado.");
        console.error("Erro ao carregar resumo de quartos:", error instanceof Error ? error.name : "unknown");
      } finally {
        if (active) setCarregandoResumo(false);
      }
    }

    void fetchResumo();
    return () => { active = false; };
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
    <Box className="page-content" sx={{ backgroundColor: "background.default" }}>
      <Box className="flex justify-between items-center flex-wrap gap-4">
        <PageHeader
          title="Quartos"
          description="Controle disponibilidade, manutenção e cadastros dos quartos do hotel."
          actions={<CriarQuarto onCreate={handleCriar} />}
        />
      </Box>

      <PageSection
        title="Ocupação por período"
        description="Calcule a disponibilidade do hotel entre check-in e check-out."
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Período da estadia
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
        {carregandoResumo && <Skeleton variant="rounded" height={96} aria-label="Carregando ocupação" />}
        {!carregandoResumo && resumoPeriodo && <ResumoQuartos summary={resumoPeriodo} />}
      </PageSection>

      <PageSection title="Quartos do hotel" description="Consulte as categorias, a capacidade e o status operacional.">
        <FiltroQuartos status={status} setStatus={setStatus} busca={busca} setBusca={setBusca} />
        {loading ? <Skeleton variant="rounded" height={240} aria-label="Carregando quartos" /> : loadError ? <Alert severity="error" action={<Button color="inherit" onClick={() => setReload(value => value + 1)}>Tentar novamente</Button>}>Não foi possível carregar quartos.</Alert> : (<TabelaQuartos quartos={quartosFiltrados} onEditar={handleAbrirModal} />)}
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
