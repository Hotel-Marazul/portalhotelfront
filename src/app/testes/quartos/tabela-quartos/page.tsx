"use client";

import { useState, useMemo } from "react";
import TabelaQuartos from "@/components/quartos/TabelaQuartos";
import FiltroQuartos from "@/components/quartos/FiltroQuartos";
import ModalQuarto from "@/components/quartos/EditarQuartos";
import { Room } from "@/utils/models"; 

const dadosMock: Room[] = [
  { id: 1, number: "101", type: "Standard", capacity: 2, status: "Livre", price: 150 },
  { id: 2, number: "102", type: "Deluxe", capacity: 3, status: "Ocupado", price: 250 },
  { id: 3, number: "103", type: "Suíte", capacity: 4, status: "Manutenção", price: 400 },
  { id: 4, number: "104", type: "Standard", capacity: 2, status: "Livre", price: 160 },
];

export default function TabelaQuartosTeste() {
  const [status, setStatus] = useState("Todos");
  const [busca, setBusca] = useState("");

  const [quartos, setQuartos] = useState<Room[]>(dadosMock);

  const [modalOpen, setModalOpen] = useState(false);
  const [quartoSelecionado, setQuartoSelecionado] = useState<Room | null>(null);

  // integra filtro com dados mockados
  const quartosFiltrados = useMemo(() => {
    return quartos.filter((q) => {
      const filtroStatus = status === "Todos" || q.status === status;
      const filtroBusca =
        busca === "" ||
        q.number.toLowerCase().includes(busca.toLowerCase()) ||
        q.type.toLowerCase().includes(busca.toLowerCase());
      return filtroStatus && filtroBusca;
    });
  }, [status, busca, quartos]);

  // abrir modal passando quarto
  const handleAbrirModal = (quarto: Room) => {
    setQuartoSelecionado(quarto);
    setModalOpen(true);
  };

  // salvar edição
  const handleSalvar = (quartoEditado: Room) => {
    setQuartos((prev) =>
      prev.map((q) => (q.id === quartoEditado.id ? quartoEditado : q))
    );
  };

  // deletar
  const handleDeletar = (id: number) => {
    setQuartos((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="p-4">
      <FiltroQuartos
        status={status}
        setStatus={setStatus}
        busca={busca}
        setBusca={setBusca}
      />

      <TabelaQuartos quartos={quartosFiltrados} onEditar={handleAbrirModal} />

      <ModalQuarto
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        quarto={quartoSelecionado}
        onSave={handleSalvar}
        onDelete={handleDeletar}
      />
    </div>
  );
}
