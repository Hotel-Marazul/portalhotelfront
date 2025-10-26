"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import { Edit, Visibility, PersonAdd } from "@mui/icons-material";
import apiClient from "@/service/api";
import CustomSnackbar from "@/components/snackbar";
import ModalHospede from "@/components/clientes/ModalHospede";
import ModalDetalhesCliente from "@/components/clientes/ModalDetalhesHospedes";

interface Reservation {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalPrice: number;
  room: {
    id: string;              // ✅ Adicionar
    roomNumber: number;
    status: string;          // ✅ Adicionar
    categoryName: string;    // ✅ Mudar de category.name para categoryName
    categoryPrice: number;   // ✅ Adicionar
  };
  guests: Array<{
    id: string;
    name: string;
    age: number;
    pricingRuleDescription: string;  // ✅ Adicionar
    pricingRulePrice: number;        // ✅ Adicionar
  }>;
}

interface Client {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
  reservations: Reservation[];
}


export default function ListaHospedes() {
  const [hospedes, setHospedes] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  // Modal de CRUD
  const [openModal, setOpenModal] = useState(false);
  const [modoModal, setModoModal] = useState<"adicionar" | "editar" | "excluir">("adicionar");
  const [hospedeSelecionado, setHospedeSelecionado] = useState<string | undefined>(undefined);

  // Modal de visualização
  const [openDetalhes, setOpenDetalhes] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Client | null>(null);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  const formatarCPF = (cpf?: string) => {
    if (!cpf) return "";
    const apenasNumeros = cpf.replace(/\D/g, "");
    return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const carregarHospedes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/Client");
      setHospedes(response.data);
    } catch (error) {
      console.error(error);
      setSnackbar({
        open: true,
        message: "Erro ao carregar hóspedes.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarHospedes();
  }, []);

  const hospedesFiltrados = hospedes.filter((h) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      h.fullName.toLowerCase().includes(q) ||
      h.email?.toLowerCase().includes(q) ||
      h.fone?.toLowerCase().includes(q) ||
      h.cpf?.toLowerCase().includes(q)
    );
  });

  const handleCloseSnackbar = () =>
    setSnackbar((prev) => ({ ...prev, open: false }));

  const handleAbrirModal = (
    mode: "adicionar" | "editar" | "excluir",
    id?: string
  ) => {
    setModoModal(mode);
    setHospedeSelecionado(id);
    setOpenModal(true);
  };

  const handleFecharModal = () => {
    setOpenModal(false);
    setHospedeSelecionado(undefined);
  };

  const handleAbrirDetalhes = (cliente: Client) => {
    setClienteSelecionado(cliente);
    setOpenDetalhes(true);
  };

  const handleFecharDetalhes = () => {
    setOpenDetalhes(false);
    setClienteSelecionado(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Lista de Hóspedes
        </Typography>

        <Button
          variant="outlined"
          startIcon={<PersonAdd />}
          onClick={() => handleAbrirModal("adicionar")}
        >
          Adicionar Hóspede
        </Button>

        <ModalHospede
          open={openModal}
          onClose={handleFecharModal}
          onSuccess={carregarHospedes}
          mode={modoModal}
          hospedeId={hospedeSelecionado}
        />
      </Box>

      <TextField
        placeholder="Buscar por nome, CPF, telefone ou e-mail..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />

      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><b>Nome</b></TableCell>
                  <TableCell><b>Documento</b></TableCell>
                  <TableCell><b>Telefone</b></TableCell>
                  <TableCell><b>E-mail</b></TableCell>
                  <TableCell><b>Histórico de Estadias</b></TableCell>
                  <TableCell align="center"><b>Ações</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hospedesFiltrados.map((hospede) => {
                  const totalEstadias = hospede.reservations?.length || 0;
                  const ultimaReserva = hospede.reservations?.[0];

                  return (
                    <TableRow key={hospede.id} hover>
                      <TableCell>{hospede.fullName}</TableCell>
                      <TableCell>{formatarCPF(hospede.cpf)}</TableCell>
                      <TableCell>{hospede.fone}</TableCell>
                      <TableCell>{hospede.email}</TableCell>
                      <TableCell>
                        {totalEstadias > 0 ? (
                          <Box>
                            <Typography
                              variant="body2"
                              color="primary"
                              sx={{ fontWeight: 600, cursor: "pointer" }}
                            >
                              {totalEstadias} estadia
                              {totalEstadias > 1 ? "s" : ""}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Última:{" "}
                              {new Date(
                                ultimaReserva?.checkInDate || ""
                              ).toLocaleDateString("pt-BR")}{" "}
                              • Quarto {ultimaReserva?.room?.roomNumber}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Nenhuma estadia
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => handleAbrirModal("editar", hospede.id)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Visualizar">
                          <IconButton
                            color="inherit"
                            size="small"
                            onClick={() => handleAbrirDetalhes(hospede)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Modal de Detalhes do Cliente */}
      <ModalDetalhesCliente
        open={openDetalhes}
        onClose={handleFecharDetalhes}
        cliente={clienteSelecionado}  // ✅ Agora os tipos são compatíveis
      />

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />
    </Box>
  );
}
