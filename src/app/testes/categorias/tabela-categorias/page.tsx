"use client";

import { useState, useMemo } from "react";
import TabelaCategorias from "@/components/categorias/TabelaCategorias";
import EditarCategorias from "@/components/categorias/EditarCategorias";
import FiltroCategorias from "@/components/categorias/FiltroCategorias";
import { Category } from "@/utils/models";

const categoriasMock: Category[] = [
  { id: 1, name: "Standard", price: 150 },
  { id: 2, name: "Deluxe", price: 250 },
  { id: 3, name: "Suíte Master", price: 400 },
  { id: 4, name: "Econômico", price: 100 },
];

export default function CategoriasTeste() {
  const [busca, setBusca] = useState("");
  const [categorias, setCategorias] = useState<Category[]>(categoriasMock);

  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Category | null>(null);

  // Filtro por nome
  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((c) =>
      c.name.toLowerCase().includes(busca.toLowerCase())
    );
  }, [busca, categorias]);

  // Abrir modal
  const handleAbrirModal = (categoria: Category) => {
    setCategoriaSelecionada(categoria);
    setModalOpen(true);
  };

  // Salvar edição
  const handleSalvar = (categoriaEditada: Category) => {
    setCategorias((prev) =>
      prev.map((c) => (c.id === categoriaEditada.id ? categoriaEditada : c))
    );
  };

  // Deletar
  const handleDeletar = (id: number) => {
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="p-6 bg-white">
      {/* Filtro */}
      <div className="mb-4">
        <FiltroCategorias busca={busca} setBusca={setBusca} />
      </div>

      {/* Tabela */}
      <TabelaCategorias categoria={categoriasFiltradas} onEditar={handleAbrirModal} />

      {/* Modal */}
      <EditarCategorias
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categoria={categoriaSelecionada}
        onSave={handleSalvar}
        onDelete={handleDeletar}
      />
    </div>
  );
}
