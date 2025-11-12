"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import apiClient from "@/service/api"; // seu Axios instance

// Tipos mínimos
type ReservationStatus = "Confirmada" | "Pendente" | "Cancelada";
type ClientLite = { id: string; fullName: string; cpf: string };
type Room = {
  id: string;
  number: number;
  categoryId?: string;
  type?: string;
  status?: string;
  price?: number;
  categoryPrice?: number;
};
type Reservation = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  room: Room;
  client: ClientLite;
};

const STATUS_OPTIONS: ReservationStatus[] = ["Confirmada", "Pendente", "Cancelada"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function normalizeText(v: string) {
  return (v || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}
function chipColor(
  status: string
): "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info" {
  const s = normalizeText(status);
  if (s.includes("confirm")) return "success";
  if (s.includes("pend")) return "warning";
  if (s.includes("cancel")) return "error";
  return "info";
}
function ensureStatus(s: string | undefined): ReservationStatus {
  const fallback: ReservationStatus = "Pendente";
  if (!s) return fallback;
  return STATUS_OPTIONS.includes(s as ReservationStatus) ? (s as ReservationStatus) : fallback;
}
function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function getDailyPrice(r: Reservation): number {
  return r.room?.price ?? r.room?.categoryPrice ?? (typeof r.totalPrice === "number" ? r.totalPrice : 0);
}
function isClientLite(v: unknown): v is ClientLite {
  return !!v && typeof v === "object" && "id" in (v as any) && "fullName" in (v as any);
}

export default function ReservationsPage() {
  // Dados base
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controle UI
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "Todos">("Todos");
  const [sortBy, setSortBy] = useState("checkInDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0); // zero-based
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Busca cliente
  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientLite[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // Abort controllers
  const clientsAbort = useRef<AbortController | null>(null);

  // Debounce
  const debounceRef = useRef<number | undefined>(undefined);
  const debounce = useCallback((fn: () => void, delay = 400) => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(fn, delay);
  }, []);

  // GET simples em /api/Reservations (sem query string)
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiClient
      .get<Reservation[]>("/api/Reservations")
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setAllReservations(list);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message || "Erro ao carregar reservas");
        setAllReservations([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Buscar sugestões em /api/Client com params (sem montar string manualmente)
  useEffect(() => {
    if (!clientQuery || selectedClient) {
      setClientOptions((prev) => (selectedClient ? [selectedClient] : prev));
      return;
    }

    debounce(() => {
      clientsAbort.current?.abort();
      const controller = new AbortController();
      clientsAbort.current = controller;

      setClientLoading(true);

      apiClient
        .get<ClientLite[]>("/api/Client", {
          params: { search: clientQuery.trim(), limit: 8 },
          signal: controller.signal as any,
        })
        .then((res) => setClientOptions(Array.isArray(res.data) ? res.data : []))
        .catch((e) => {
          if ((e as any)?.name === "AbortError") return;
          setClientOptions([]);
        })
        .finally(() => setClientLoading(false));
    }, 350);
  }, [clientQuery, selectedClient, debounce]);

  // Filtro e ordenação em memória (sem enviar query ao backend)
  const filteredSorted = useMemo(() => {
    const byStatus =
      statusFilter === "Todos"
        ? allReservations
        : allReservations.filter((r) => normalizeText(r.status).includes(normalizeText(statusFilter)));

    // Filtro por cliente (selecionado) ou texto/CPF digitado
    const digits = onlyDigits(clientQuery);
    const q = normalizeText(clientQuery);
    const byClient = byStatus.filter((r) => {
      if (selectedClient) return r.client?.id === selectedClient.id;
      if (!clientQuery) return true;
      const name = normalizeText(r.client?.fullName || "");
      const cpf = onlyDigits(r.client?.cpf || "");
      return name.includes(q) || (digits.length >= 3 && cpf.includes(digits));
    });

    const sorted = [...byClient].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "clientName":
          return dir * (a.client?.fullName || "").localeCompare(b.client?.fullName || "");
        case "roomNumber":
          return dir * ((a.room?.number || 0) - (b.room?.number || 0));
        case "checkOutDate":
          return dir * (new Date(a.checkOutDate).getTime() - new Date(b.checkOutDate).getTime());
        case "checkInDate":
        default:
          return dir * (new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime());
      }
    });

    return sorted;
  }, [allReservations, statusFilter, selectedClient, clientQuery, sortBy, sortDir]);

  // Página atual
  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredSorted.slice(start, start + rowsPerPage);
  }, [filteredSorted, page, rowsPerPage]);

  const onSortClick = (key: string) => {
    const isAsc = sortBy === key && sortDir === "asc";
    setSortBy(key);
    setSortDir(isAsc ? "desc" : "asc");
  };

  return (
    <Box className="w-full">
      <Toolbar className="flex items-center justify-between px-4 sm:px-6">
        <Typography variant="h6">Gestão de Reservas</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            // Recarrega apenas a lista base (GET limpo)
            setLoading(true);
            setError(null);
            apiClient
              .get<Reservation[]>("/api/Reservations")
              .then((res) => setAllReservations(Array.isArray(res.data) ? res.data : []))
              .catch((e) => setError(e?.message || "Erro ao recarregar"))
              .finally(() => setLoading(false));
          }}
        >
          Recarregar
        </Button>
      </Toolbar>

      <Box className="px-4 sm:px-6 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Typography variant="body2" className="mr-2">Status:</Typography>
            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setPage(0);
                setStatusFilter(e.target.value as ReservationStatus | "Todos");
              }}
            >
              <MenuItem value="Todos">Todos</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </div>

          <Autocomplete<ClientLite, false, false, true>
            freeSolo
            loading={clientLoading}
            options={clientOptions}
            value={selectedClient}
            onChange={(_e, newValue) => {
              if (isClientLite(newValue)) {
                setSelectedClient(newValue);
                setClientQuery(`${newValue.fullName}`);
              } else {
                setSelectedClient(null);
                if (typeof newValue === "string") setClientQuery(newValue);
              }
              setPage(0);
            }}
            onInputChange={(_e, value, reason) => {
              if (reason === "input") {
                setSelectedClient(null);
                setClientQuery(value);
                setPage(0);
              }
            }}
            getOptionLabel={(opt) => (typeof opt === "string" ? opt : `${opt.fullName} - ${opt.cpf}`)}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Buscar por hóspede ou CPF..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{option.fullName}</span>
                  <span className="text-xs text-gray-500">CPF: {option.cpf}</span>
                </div>
              </li>
            )}
            className="w-full sm:w-96"
          />
        </div>
      </Box>

      <TableContainer component={Paper} className="mx-4 sm:mx-6">
        {loading && (
          <Box className="flex items-center justify-center py-10">
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Box className="p-4">
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {!loading && !error && (
          <>
            <Table size="small" aria-label="Lista de Reservas">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortBy === "clientName" ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === "clientName"}
                      direction={sortBy === "clientName" ? sortDir : "asc"}
                      onClick={() => onSortClick("clientName")}
                    >
                      Hóspede
                    </TableSortLabel>
                  </TableCell>

                  <TableCell sortDirection={sortBy === "roomNumber" ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === "roomNumber"}
                      direction={sortBy === "roomNumber" ? sortDir : "asc"}
                      onClick={() => onSortClick("roomNumber")}
                    >
                      Quarto
                    </TableSortLabel>
                  </TableCell>

                  <TableCell sortDirection={sortBy === "checkInDate" ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === "checkInDate"}
                      direction={sortBy === "checkInDate" ? sortDir : "asc"}
                      onClick={() => onSortClick("checkInDate")}
                    >
                      Check‑in
                    </TableSortLabel>
                  </TableCell>

                  <TableCell sortDirection={sortBy === "checkOutDate" ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === "checkOutDate"}
                      direction={sortBy === "checkOutDate" ? sortDir : "asc"}
                      onClick={() => onSortClick("checkOutDate")}
                    >
                      Check‑out
                    </TableSortLabel>
                  </TableCell>

                  <TableCell>Status</TableCell>
                  <TableCell>Valor Diária</TableCell>
                  <TableCell align="center">Ações</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {paged.length > 0 ? (
                  paged.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.client?.fullName}</span>
                          <span className="text-xs text-gray-500">CPF: {r.client?.cpf}</span>
                        </div>
                      </TableCell>

                      <TableCell>{r.room?.number}</TableCell>
                      <TableCell>{formatDate(r.checkInDate)}</TableCell>
                      <TableCell>{formatDate(r.checkOutDate)}</TableCell>

                      <TableCell>
                        <Chip
                          size="small"
                          label={ensureStatus(r.status)}
                          color={chipColor(r.status)}
                          sx={{ textTransform: "capitalize" }}
                        />
                      </TableCell>

                      <TableCell>{brl.format(getDailyPrice(r))}</TableCell>

                      <TableCell align="center">
                        <div className="flex items-center justify-center gap-1">
                          <IconButton size="small" aria-label="ver">
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" aria-label="editar" color="primary">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" aria-label="excluir" color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" className="text-center py-6">
                        Nenhuma reserva encontrada
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Box className="px-4 sm:px-6 py-2">
              <TablePagination
                component="div"
                count={filteredSorted.length}
                page={page}
                onPageChange={(_e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </Box>
          </>
        )}
      </TableContainer>
    </Box>
  );
}
