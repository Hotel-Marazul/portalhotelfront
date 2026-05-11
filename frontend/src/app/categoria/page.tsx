"use client";

import { useState, useMemo, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import CriarCategoria from "../../components/categorias/CriarCategorias";
import FiltroCategorias from "../../components/categorias/FiltroCategorias";
import ResumoCategorias from "../../components/categorias/ResumoCategorias";
import TabelaCategorias from "../../components/categorias/TabelaCategorias";
import EditarCategorias from "../../components/categorias/EditarCategorias";
import { Category } from "../../utils/models";
import apiClient from "../../services/api";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Category[]>([]);

  const [busca, setBusca] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Category | null>(null);

  // Carrega as categorias da API
  useEffect(() => {
    async function fetchCategorias() {
      try {
        const response = await apiClient.get("/api/Categories");
        setCategorias(response.data);
      } catch (err) {
        console.error("Erro ao carregar categorias", err);
      }
    }
    void fetchCategorias();
  }, []);

  // Filtro por nome
  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((c) =>
      c.name.toLowerCase().includes(busca.toLowerCase())
    );
  }, [busca, categorias]);

  const handleAbrirModal = (categoria: Category) => {
    setCategoriaSelecionada(categoria);
    setModalOpen(true);
  };

  const handleSalvar = (categoriaEditada: Category) => {
    setCategorias((prev) =>
      prev.map((c) => (c.id === categoriaEditada.id ? categoriaEditada : c))
    );
  };

  const handleDeletar = (id: string) => {
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <Box
      className="min-h-screen p-8 flex flex-col gap-6"
      sx={{ backgroundColor: "#f9fafb" }}
    >
      <Box className="flex justify-between items-center flex-wrap gap-4">
        <Typography variant="h5" fontWeight={600}>
          Gestão de Categorias
        </Typography>
        <CriarCategoria onCreate={(novaCat) => setCategorias(prev => [...prev, novaCat])} />
      </Box>

      <FiltroCategorias busca={busca} setBusca={setBusca} />

      <ResumoCategorias categorias={categorias} />

      <TabelaCategorias categoria={categoriasFiltradas} onEditar={handleAbrirModal} />

      <EditarCategorias
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categoria={categoriaSelecionada}
        onSave={handleSalvar}
        onDelete={handleDeletar}
      />
    </Box>
  );
}
