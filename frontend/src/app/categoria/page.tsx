"use client";

import { useState, useMemo, useEffect } from "react";
import { Box } from "@mui/material";
import Link from "next/link";
import CriarCategoria from "../../components/categorias/CriarCategorias";
import FiltroCategorias from "../../components/categorias/FiltroCategorias";
import ResumoCategorias from "../../components/categorias/ResumoCategorias";
import TabelaCategorias from "../../components/categorias/TabelaCategorias";
import EditarCategorias from "../../components/categorias/EditarCategorias";
import { Category } from "../../utils/models";
import apiClient from "../../services/api";
import PageHeader from "../../components/layout/PageHeader";
import PageSection from "../../components/layout/PageSection";

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
        <PageHeader
          title="Categorias"
          description="Administre as tipologias usadas na operação e nas reservas."
          actions={
            <>
              <Link href="/dashboard" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] no-underline transition-colors hover:bg-slate-50">
                Dashboard
              </Link>
              <CriarCategoria onCreate={(novaCat) => setCategorias(prev => [...prev, novaCat])} />
            </>
          }
        />
      </Box>

      <PageSection title="Busca e resumo" description="Filtre categorias e acompanhe o total cadastrado.">
        <FiltroCategorias busca={busca} setBusca={setBusca} />
        <ResumoCategorias categorias={categorias} />
      </PageSection>

      <PageSection title="Tabela de categorias" description="Edite ou remova tipologias usadas em reservas e quartos.">
        <TabelaCategorias categoria={categoriasFiltradas} onEditar={handleAbrirModal} />
      </PageSection>

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
