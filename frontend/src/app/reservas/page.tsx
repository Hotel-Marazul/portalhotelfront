"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Toolbar,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from "@mui/material";
import { Visibility, Edit, Delete } from "@mui/icons-material";
import { isAxiosError } from "axios";
import apiClient from "../../services/api";
import {
  ReservationDto,
  ReservationsFilters,
  ReservationStatus,
  ReservationsResponse,
  CreateReservationDto
} from "../../types/reservations";
import ReservationsFiltersComponent from "../../components/reservations/ReservationsFilters";
import ReservationDrawer from "../../components/reservations/ReservationDrawer";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function normalizeStatus(status: ReservationStatus): ReservationStatus {
  return status === "Concluida" ? "Concluída" : status;
}

function toIsoDateTime(dateValue: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? dateValue : parsed.toISOString();
}


function chipColor(status: ReservationStatus) {
  switch (normalizeStatus(status)) {
    case "Confirmada":
      return "success";
    case "Pendente":
      return "warning";
    case "Cancelada":
      return "error";
    case "Concluída":
      return "info";
    case "EmAndamento":
      return "primary";
    default:
      return "default";
  }
}

export default function ReservationsPage() {
  const [allReservations, setAllReservations] = useState<ReservationDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ReservationsFilters>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [editing, setEditing] = useState<ReservationDto | null>(null);
  const [deleting, setDeleting] = useState<ReservationDto | null>(null);
  const [viewing, setViewing] = useState<ReservationDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadReservations = useCallback(async (
    targetPage: number,
    targetLimit: number,
    activeFilters: ReservationsFilters = {}
  ) => {
    setLoading(true);
    setError(null);
    try {
      // MUI usa base-0; backend usa base-1
      // Filters are sent as query params so the backend applies them server-side,
      // returning a filtered total — this keeps TablePagination counts correct.
      const res = await apiClient.get<ReservationsResponse>("/api/Reservations", {
        params: {
          page: targetPage + 1,
          limit: targetLimit,
          ...(activeFilters.status?.length ? { status: activeFilters.status.join(",") } : {}),
          ...(activeFilters.search ? { search: activeFilters.search } : {}),
          ...(activeFilters.cpf ? { cpf: activeFilters.cpf } : {}),
          ...(activeFilters.id ? { id: activeFilters.id } : {}),
          ...(activeFilters.roomId ? { roomId: activeFilters.roomId } : {}),
          ...(activeFilters.checkInFrom ? { checkInFrom: activeFilters.checkInFrom } : {}),
          ...(activeFilters.checkInTo ? { checkInTo: activeFilters.checkInTo } : {}),
          ...(activeFilters.checkOutFrom ? { checkOutFrom: activeFilters.checkOutFrom } : {}),
          ...(activeFilters.checkOutTo ? { checkOutTo: activeFilters.checkOutTo } : {})
        }
      });
      const envelope = res.data;
      setAllReservations(Array.isArray(envelope.items) ? envelope.items : []);
      setTotalCount(typeof envelope.total === "number" ? envelope.total : 0);
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        setError(e.response?.data?.message ?? "Erro ao carregar reservas");
      } else {
        setError(e instanceof Error ? e.message : "Erro ao carregar reservas");
      }
      setAllReservations([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReservations(page, rowsPerPage, filters);
  }, [loadReservations, page, rowsPerPage, filters]);

  // Filters are applied server-side; allReservations already reflects the active
  // filter state. The backend returns results sorted by check_in_date DESC.

  const handleSave = async () => {
    if (!editing) return;

    setSaving(true);
    setError(null);
    try {
      const payload: CreateReservationDto = {
        roomId: editing.roomId,
        clientId: editing.clientId,
        checkInDate: toIsoDateTime(editing.checkInDate),
        checkOutDate: toIsoDateTime(editing.checkOutDate),
        status: normalizeStatus(editing.status),
        guests: (editing.guests ?? []).map((guest) => ({
          name: guest.name,
          age: guest.age,
          pricingRuleId: guest.pricingRuleId ?? null
        }))
      };

      await apiClient.put<ReservationDto>(`/api/Reservations/${editing.id}`, payload);
      setEditing(null);
      void loadReservations(page, rowsPerPage, filters);
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        setError(e.response?.data?.message ?? "Erro ao salvar edição");
      } else {
        setError(e instanceof Error ? e.message : "Erro ao salvar edição");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!deleting) return;

    setRemoving(true);
    setError(null);
    try {
      await apiClient.delete(`/api/Reservations/${deleting.id}`);
      setDeleting(null);
      void loadReservations(page, rowsPerPage, filters);
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        setError(e.response?.data?.message ?? "Erro ao remover");
      } else {
        setError(e instanceof Error ? e.message : "Erro ao remover");
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Box className="w-full pr-10">
      <Toolbar className="flex items-center justify-between px-4 sm:px-6">
        <Typography variant="h6">Gestão de Reservas</Typography>
        <Button variant="contained" color="primary" onClick={() => void loadReservations(page, rowsPerPage, filters)}>
          Recarregar
        </Button>
      </Toolbar>

      <Box className="px-4 sm:px-6 pb-4">
        <ReservationsFiltersComponent
          filters={filters}
          onFiltersChange={(partial) => {
            setFilters((previous) => ({ ...previous, ...partial }));
            setPage(0);
          }}
          onClear={() => {
            setFilters({});
            setPage(0);
          }}
        />
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
                  <TableCell>Hóspede</TableCell>
                  <TableCell>Quarto</TableCell>
                  <TableCell>Check-in</TableCell>
                  <TableCell>Check-out</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Valor Total</TableCell>
                  <TableCell align="center">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allReservations.length > 0 ? (
                  allReservations.map((reservation) => (
                    <TableRow key={reservation.id} hover>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {reservation.client?.fullName ?? reservation.client?.name}
                          </span>
                          <span className="text-xs text-gray-500">CPF: {reservation.client?.cpf}</span>
                        </div>
                      </TableCell>
                      <TableCell>{reservation.room?.number}</TableCell>
                      <TableCell>{formatDate(reservation.checkInDate)}</TableCell>
                      <TableCell>{formatDate(reservation.checkOutDate)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={normalizeStatus(reservation.status)}
                          color={chipColor(reservation.status)}
                          sx={{ textTransform: "capitalize" }}
                        />
                      </TableCell>
                      <TableCell>{brl.format(reservation.totalPrice ?? 0)}</TableCell>
                      <TableCell align="center">
                        <div className="flex items-center justify-center gap-1">
                          <IconButton
                            size="small"
                            aria-label="ver"
                            onClick={() => setViewing(reservation)}
                          >
                            <Visibility />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="editar"
                            color="primary"
                            onClick={() => setEditing(reservation)}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="excluir"
                            color="error"
                            onClick={() => setDeleting(reservation)}
                          >
                            <Delete />
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
                count={totalCount}
                page={page}
                onPageChange={(_event, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 20, 50, 100]}
              />
            </Box>
          </>
        )}
      </TableContainer>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar Reserva</DialogTitle>
        <DialogContent>
          <TextField
            label="Check-in"
            type="date"
            fullWidth
            value={editing?.checkInDate?.slice(0, 10) || ""}
            onChange={(event) =>
              editing && setEditing({ ...editing, checkInDate: event.target.value })
            }
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />
          <TextField
            label="Check-out"
            type="date"
            fullWidth
            value={editing?.checkOutDate?.slice(0, 10) || ""}
            onChange={(event) =>
              editing && setEditing({ ...editing, checkOutDate: event.target.value })
            }
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={editing?.status || ""}
              label="Status"
              onChange={(event) =>
                editing &&
                setEditing({
                  ...editing,
                  status: normalizeStatus(event.target.value as ReservationStatus)
                })
              }
            >
              <MenuItem value="Confirmada">Confirmada</MenuItem>
              <MenuItem value="Pendente">Pendente</MenuItem>
              <MenuItem value="Cancelada">Cancelada</MenuItem>
              <MenuItem value="Concluída">Concluída</MenuItem>
              <MenuItem value="EmAndamento">EmAndamento</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancelar</Button>
          <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>Confirmação</DialogTitle>
        <DialogContent>
          Tem certeza que deseja remover a reserva de <b>{deleting?.client?.fullName}</b>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button color="error" variant="contained" disabled={removing} onClick={() => void handleRemove()}>
            {removing ? <CircularProgress size={18} /> : "Remover"}
          </Button>
        </DialogActions>
      </Dialog>

      <ReservationDrawer
        open={!!viewing}
        reservation={viewing}
        mode="view"
        onClose={() => setViewing(null)}
        onSave={(updated) => {
          setAllReservations((prev) => prev.map((r) => r.id === updated.id ? updated : r));
          setViewing(null);
        }}
        onStatusChange={async (id, status) => {
          const r = viewing!;
          await apiClient.put(`/api/Reservations/${id}`, {
            roomId: r.roomId,
            clientId: r.clientId,
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
            status,
            guests: (r.guests ?? []).map((g) => ({
              name: g.name,
              age: g.age,
              pricingRuleId: g.pricingRuleId ?? null
            }))
          });
          void loadReservations(page, rowsPerPage, filters);
        }}
      />
    </Box>
  );
}

