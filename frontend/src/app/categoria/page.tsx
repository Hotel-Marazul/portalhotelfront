"use client";

import { useState, useMemo, useEffect } from "react";
import { Alert, Box, Button, Skeleton } from "@mui/material";
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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  const [busca, setBusca] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Category | null>(null);

  // Carrega as categorias da API
  useEffect(() => {
    async function fetchCategorias() {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await apiClient.get("/api/Categories");
        setCategorias(response.data);
      } catch (err) {
        setLoadError(true);
        console.error("Erro ao carregar categorias", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchCategorias();
  }, [reload]);

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
      className="page-content"
      sx={{ backgroundColor: "background.default" }}
    >
      <Box className="flex justify-between items-center flex-wrap gap-4">
        <PageHeader
          title="Categorias"
          description="Administre as tipologias usadas na operação e nas reservas."
          actions={<CriarCategoria onCreate={(novaCat) => setCategorias(prev => [...prev, novaCat])} />}
        />
      </Box>

      <PageSection title="Categorias do hotel" description="Filtre categorias e acompanhe o total cadastrado.">
        <FiltroCategorias busca={busca} setBusca={setBusca} />
        <ResumoCategorias categorias={categorias} />
      </PageSection>

      <PageSection title="Tabela de categorias" description="Edite ou remova tipologias usadas em reservas e quartos.">
        {loading ? <Skeleton variant="rounded" height={240} aria-label="Carregando categorias" /> : loadError ? <Alert severity="error" action={<Button color="inherit" onClick={() => setReload(value => value + 1)}>Tentar novamente</Button>}>Não foi possível carregar categorias.</Alert> : (<TabelaCategorias categoria={categoriasFiltradas} onEditar={handleAbrirModal} />)}
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
