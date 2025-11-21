"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  TablePagination,
  CircularProgress,
  Tooltip,
  Select,
  FormControl,
} from "@mui/material";
import {
  MoreVert,
  Edit,
  ContentCopy,
  Cancel,
  Visibility,
} from "@mui/icons-material";
import { ReservationDto, ReservationStatus } from "@/types/reservations";
import StatusBadge from "./StatusBadge";
import { formatDate, formatCurrency, calculateNights, formatReservationId } from "@/utils/format";
import { formatCPF } from "@/utils/cpf";

interface ReservationsTableProps {
  reservations: ReservationDto[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (reservation: ReservationDto) => void;
  onEdit: (reservation: ReservationDto) => void;
  onDuplicate: (reservation: ReservationDto) => void;
  onCancel: (reservation: ReservationDto) => void;
  onStatusChange: (reservationId: string, status: ReservationStatus) => void;
}

const STATUS_OPTIONS: ReservationStatus[] = [
  "Pendente",
  "Confirmada",
  "EmAndamento",
  "Concluída",
  "Cancelada",
];

export default function ReservationsTable({
  reservations,
  loading = false,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onDuplicate,
  onCancel,
  onStatusChange,
}: ReservationsTableProps) {
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, reservationId: string) => {
    setAnchorEl({ [reservationId]: event.currentTarget });
  };

  const handleMenuClose = (reservationId: string) => {
    setAnchorEl({ [reservationId]: null });
  };

  const handleStatusChange = async (reservationId: string, newStatus: ReservationStatus) => {
    try {
      await onStatusChange(reservationId, newStatus);
      handleMenuClose(reservationId);
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  };

  // Garante que reservations seja sempre um array
  const reservationsList = reservations || [];

  if (loading && reservationsList.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!loading && reservationsList.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">
          Nenhuma reserva encontrada
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Tente ajustar os filtros de busca
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Código</strong></TableCell>
              <TableCell><strong>Cliente</strong></TableCell>
              <TableCell><strong>CPF</strong></TableCell>
              <TableCell><strong>Quarto</strong></TableCell>
              <TableCell><strong>Check-in</strong></TableCell>
              <TableCell><strong>Check-out</strong></TableCell>
              <TableCell><strong>Noites</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="center"><strong>Ações</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservationsList.map((reservation) => {
              const menuOpen = Boolean(anchorEl[reservation.id]);
              const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);

              return (
                <TableRow key={reservation.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {formatReservationId(reservation.id)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {reservation.client?.name || reservation.client?.fullName || "-"}
                  </TableCell>
                  <TableCell>{formatCPF(reservation.client?.cpf)}</TableCell>
                  <TableCell>
                    {reservation.room?.number
                      ? `Quarto ${reservation.room.number}`
                      : reservation.room?.name || "-"}
                  </TableCell>
                  <TableCell>{formatDate(reservation.checkInDate)}</TableCell>
                  <TableCell>{formatDate(reservation.checkOutDate)}</TableCell>
                  <TableCell>{nights} {nights === 1 ? "noite" : "noites"}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(reservation.totalPrice)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={reservation.status} />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                      <Tooltip title="Alterar Status">
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={reservation.status}
                            onChange={(e) =>
                              handleStatusChange(reservation.id, e.target.value as ReservationStatus)
                            }
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Tooltip>

                      <Tooltip title="Mais opções">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, reservation.id)}
                        >
                          <MoreVert />
                        </IconButton>
                      </Tooltip>

                      <Menu
                        anchorEl={anchorEl[reservation.id] || null}
                        open={menuOpen}
                        onClose={() => handleMenuClose(reservation.id)}
                      >
                        <MenuItem onClick={() => { onView(reservation); handleMenuClose(reservation.id); }}>
                          <Visibility fontSize="small" sx={{ mr: 1 }} />
                          Ver Detalhes
                        </MenuItem>
                        <MenuItem onClick={() => { onEdit(reservation); handleMenuClose(reservation.id); }}>
                          <Edit fontSize="small" sx={{ mr: 1 }} />
                          Editar
                        </MenuItem>
                        <MenuItem onClick={() => { onDuplicate(reservation); handleMenuClose(reservation.id); }}>
                          <ContentCopy fontSize="small" sx={{ mr: 1 }} />
                          Duplicar
                        </MenuItem>
                        {reservation.status !== "Cancelada" && (
                          <MenuItem
                            onClick={() => {
                              onCancel(reservation);
                              handleMenuClose(reservation.id);
                            }}
                            sx={{ color: "error.main" }}
                          >
                            <Cancel fontSize="small" sx={{ mr: 1 }} />
                            Cancelar
                          </MenuItem>
                        )}
                      </Menu>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Itens por página:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
        }
      />
    </>
  );
}

