"use client";

import { useState, useMemo, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import CriarQuarto from "@/components/quartos/CriarQuartos";
import FiltroQuartos from "@/components/quartos/FiltroQuartos";
import ResumoQuartos from "@/components/quartos/ResumoQuartos";
import TabelaQuartos from "@/components/quartos/TabelaQuartos";
import EditarQuarto from "@/components/quartos/EditarQuartos";
import { Room } from "@/utils/models";
import apiClient from "@/service/api";

export default function QuartosPage() {
  const [quartos, setQuartos] = useState<Room[]>([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("Todos");

  const [modalOpen, setModalOpen] = useState(false);
  const [quartoSelecionado, setQuartoSelecionado] = useState<Room | null>(null);

  useEffect(() => {

    async function fetchQuartos() {
        try {
            const response = await apiClient.get("/api/rooms");
            console.log(response.data);
            setQuartos(response.data); // assume que retorna RoomDto[]
        } catch (err) {
            console.error("Erro ao carregar quartos", err);
        }
    }

    fetchQuartos();

  }, []);

  const quartosFiltrados = useMemo(() => {
    return quartos.filter((q) => {
      const filtroStatus = status === "Todos" || q.status === status;
      const filtroBusca =
        busca === "" ||
        String(q.number).toLowerCase().includes(busca.toLowerCase()) ||
        q.type.toLowerCase().includes(busca.toLowerCase());
      return filtroStatus && filtroBusca;
    });
  }, [status, busca, quartos]);

  const handleAbrirModal = (quarto: Room) => {
    setQuartoSelecionado(quarto);
    setModalOpen(true);
  };

  const handleSalvar = (quartoEditado: Room) => {
    setQuartos((prev) =>
      prev.map((q) => (q.id === quartoEditado.id ? quartoEditado : q))
    );
  };

  const handleDeletar = (id: string) => {
    setQuartos((prev) => prev.filter((q) => q.id !== id));
  };

  const handleCriar = (novoQuarto: Room) => {
    setQuartos((prev) => [...prev, novoQuarto]);
  };

  return (
    <Box
      className="min-h-screen p-8 flex flex-col gap-6"
      sx={{ backgroundColor: "#f9fafb" }}
    >
      {/* Cabeçalho + Botão */}
      <Box className="flex justify-between items-center flex-wrap gap-4">
        <Typography variant="h5" fontWeight={600}>
          Gestão de Quartos
        </Typography>
        <CriarQuarto onCreate={handleCriar} />
      </Box>

      {/* Filtro acima do Resumo */}
      <FiltroQuartos
        status={status}
        setStatus={setStatus}
        busca={busca}
        setBusca={setBusca}
      />

      <ResumoQuartos quartos={quartos} />

      <TabelaQuartos quartos={quartosFiltrados} onEditar={handleAbrirModal} />

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
