"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  TableRow,
  TablePagination,
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
  InputLabel,
} from "@mui/material";
import { Visibility, Edit, Delete } from "@mui/icons-material";
import apiClient from "@/services/api";
import { ReservationDto, ReservationsFilters, ReservationStatus } from "@/types/reservations";
import ReservationsFiltersComponent from "@/components/reservations/ReservationsFilters";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function chipColor(status: ReservationStatus) {
  switch (status) {
    case "Confirmada": return "success";
    case "Pendente": return "warning";
    case "Cancelada": return "error";
    case "Concluída": return "info";
    case "EmAndamento": return "primary";
    default: return "default";
  }
}

export default function ReservationsPage() {
  const [allReservations, setAllReservations] = useState<ReservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros e paginação
  const [filters, setFilters] = useState<ReservationsFilters>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialogs
  const [editing, setEditing] = useState<ReservationDto | null>(null);
  const [deleting, setDeleting] = useState<ReservationDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<ReservationDto[]>("/api/Reservations")
      .then((res) => setAllReservations(Array.isArray(res.data) ? res.data : []))
      .catch((e) => {
        setError(e?.message || "Erro ao carregar reservas");
        setAllReservations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtragem básica
  const filteredSorted = useMemo(() => {
    let items = allReservations;
    if (filters.status && filters.status.length > 0) {
      items = items.filter(r => filters.status!.includes(r.status));
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(r => (r.client?.fullName ?? "").toLowerCase().includes(search));
    }
    return items;
  }, [allReservations, filters]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredSorted.slice(start, start + rowsPerPage);
  }, [filteredSorted, page, rowsPerPage]);

  // Handlers de atualização API
  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/Reservations/${editing.id}`, editing);
      setAllReservations(reservas => reservas.map(r => r.id === editing.id ? editing : r));
      setEditing(null);
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar edição");
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await apiClient.delete(`/api/Reservations/${deleting.id}`);
      setAllReservations(reservas => reservas.filter(r => r.id !== deleting.id));
      setDeleting(null);
    } catch (e: any) {
      setError(e?.message || "Erro ao remover");
    }
    setRemoving(false);
  };

  return (
    <Box className="w-full pr-10">
      <Toolbar className="flex items-center justify-between px-4 sm:px-6">
        <Typography variant="h6">Gestão de Reservas</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setLoading(true);
            setError(null);
            apiClient
              .get<ReservationDto[]>("/api/Reservations")
              .then((res) => setAllReservations(Array.isArray(res.data) ? res.data : []))
              .catch((e) => setError(e?.message || "Erro ao recarregar"))
              .finally(() => setLoading(false));
          }}
        >
          Recarregar
        </Button>
      </Toolbar>
      <Box className="px-4 sm:px-6 pb-4">
        <ReservationsFiltersComponent
          filters={filters}
          onFiltersChange={(partial) => { setFilters({ ...filters, ...partial }); setPage(0); }}
          onClear={() => { setFilters({}); setPage(0); }}
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
                  <TableCell>Check‑in</TableCell>
                  <TableCell>Check‑out</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Valor Total</TableCell>
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
                          label={r.status}
                          color={chipColor(r.status)}
                          sx={{ textTransform: "capitalize" }}
                        />
                      </TableCell>
                      <TableCell>
                        {brl.format(r.room?.dailyPrice ?? r.totalPrice ?? 0)}
                      </TableCell>
                      <TableCell align="center">
                        <div className="flex items-center justify-center gap-1">
                          <IconButton size="small" aria-label="ver"><Visibility /></IconButton>
                          <IconButton size="small" aria-label="editar" color="primary" onClick={() => setEditing(r)}><Edit /></IconButton>
                          <IconButton size="small" aria-label="excluir" color="error" onClick={() => setDeleting(r)}><Delete /></IconButton>
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
      {/* Dialog de Edição */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar Reserva</DialogTitle>
        <DialogContent>
          <TextField
            label="Check-in"
            type="date"
            fullWidth
            value={editing?.checkInDate?.slice(0,10) || ''}
            onChange={e => editing && setEditing({ ...editing, checkInDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />
          <TextField
            label="Check-out"
            type="date"
            fullWidth
            value={editing?.checkOutDate?.slice(0,10) || ''}
            onChange={e => editing && setEditing({ ...editing, checkOutDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={editing?.status || ''}
              label="Status"
              onChange={e => editing && setEditing({ ...editing, status: e.target.value as ReservationStatus })}
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
          <Button variant="contained" disabled={saving} onClick={handleSave}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Dialog de Confirmação de Remoção */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>Confirmação</DialogTitle>
        <DialogContent>
          Tem certeza que deseja remover a reserva de <b>{deleting?.client?.fullName}</b>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button color="error" variant="contained" disabled={removing} onClick={handleRemove}>
            {removing ? <CircularProgress size={18} /> : "Remover"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
