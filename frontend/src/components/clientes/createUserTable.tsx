"use client";

import React, { useEffect, useRef, useState, useCallback, memo } from "react";
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
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import { Edit, Visibility, PersonAdd } from "@mui/icons-material";
import apiClient from "../../services/api";
import CustomSnackbar from "../snackbar";
import ModalHospede from "./ModalHospede";
import ModalDetalhesCliente from "./ModalDetalhesHospedes";

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
  reservations?: Reservation[];
}


const ListaHospedes = memo(function ListaHospedes() {
  const [hospedes, setHospedes] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  // Paginacao server-side
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(0);         // MUI base-0
  const [tableRowsPerPage, setTableRowsPerPage] = useState(10);

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

  // Refs to always provide fresh page/limit values to carregarHospedes,
  // avoiding the stale-closure problem when the callback is called directly
  // (e.g. from ModalHospede.onSuccess) after state has changed.
  const pageRef = useRef(tablePage);
  const limitRef = useRef(tableRowsPerPage);
  const filterRef = useRef(filtro);
  const filterInitializedRef = useRef(false);
  useEffect(() => { pageRef.current = tablePage; }, [tablePage]);
  useEffect(() => { limitRef.current = tableRowsPerPage; }, [tableRowsPerPage]);
  useEffect(() => { filterRef.current = filtro; }, [filtro]);

  const carregarHospedes = useCallback(async () => {
    const currentPage = pageRef.current;
    const currentLimit = limitRef.current;
    try {
      setLoading(true);
      const response = await apiClient.get<{
        items: Client[];
        total: number;
        page: number;
        pageSize: number;
      }>("/api/client", {
        params: {
          page: currentPage + 1,
          limit: currentLimit,
          search: filterRef.current.trim() || undefined
        }  // MUI base-0 → backend base-1
      });
      const normalized = (response.data.items ?? []).map((client) => ({
        ...client,
        reservations: Array.isArray(client.reservations) ? client.reservations : []
      }));
      setHospedes(normalized);
      setTableTotal(response.data.total ?? 0);
    } catch (error) {
      console.error(error);
      setHospedes([]);
      setTableTotal(0);
      setSnackbar({
        open: true,
        message: "Erro ao carregar hóspedes.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarHospedes();
  }, [carregarHospedes, tablePage, tableRowsPerPage]);

  useEffect(() => {
    if (!filterInitializedRef.current) {
      filterInitializedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      if (pageRef.current !== 0) {
        setTablePage(0);
        return;
      }

      void carregarHospedes();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [filtro, carregarHospedes]);

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
                {hospedes.map((hospede) => {
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
        <TablePagination
          component="div"
          count={tableTotal}
          page={tablePage}
          onPageChange={(_event, newPage) => {
            setTablePage(newPage);
          }}
          rowsPerPage={tableRowsPerPage}
          onRowsPerPageChange={(event) => {
            setTableRowsPerPage(parseInt(event.target.value, 10));
            setTablePage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
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
});

export default ListaHospedes;
