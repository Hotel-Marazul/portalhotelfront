"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip,
  IconButton,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { Search, Clear } from "@mui/icons-material";
import { ReservationsFilters, ReservationStatus } from "@/types/reservations";
import { maskCPF, unmaskCPF } from "@/utils/cpf";
import apiClient from "@/service/api";

interface ReservationsFiltersProps {
  filters: ReservationsFilters;
  onFiltersChange: (filters: Partial<ReservationsFilters>) => void;
  onClear: () => void;
}

const STATUS_OPTIONS: ReservationStatus[] = [
  "Pendente",
  "Confirmada",
  "EmAndamento",
  "Concluída",
  "Cancelada",
];

export default function ReservationsFiltersComponent({
  filters,
  onFiltersChange,
  onClear,
}: ReservationsFiltersProps) {
  const [search, setSearch] = useState(filters.search || "");
  const [cpf, setCpf] = useState(filters.cpf || "");
  const [reservationId, setReservationId] = useState(filters.id || "");
  const [selectedStatuses, setSelectedStatuses] = useState<ReservationStatus[]>(
    filters.status || []
  );
  const [roomId, setRoomId] = useState(filters.roomId || "");
  const [checkInFrom, setCheckInFrom] = useState<Date | null>(
    filters.checkInFrom ? new Date(filters.checkInFrom) : null
  );
  const [checkInTo, setCheckInTo] = useState<Date | null>(
    filters.checkInTo ? new Date(filters.checkInTo) : null
  );
  const [checkOutFrom, setCheckOutFrom] = useState<Date | null>(
    filters.checkOutFrom ? new Date(filters.checkOutFrom) : null
  );
  const [checkOutTo, setCheckOutTo] = useState<Date | null>(
    filters.checkOutTo ? new Date(filters.checkOutTo) : null
  );

  const [rooms, setRooms] = useState<Array<{ id: string; number: number; type: string }>>([]);

  // Carrega quartos para o filtro
  useEffect(() => {
    apiClient
      .get("/api/Rooms")
      .then((response) => {
        setRooms(response.data || []);
      })
      .catch((err) => {
        console.error("Erro ao carregar quartos:", err);
      });
  }, []);

  // Debounce para busca - removido para usar botão Filtrar
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (search !== filters.search) {
  //       onFiltersChange({ search: search || undefined });
  //     }
  //   }, 500);

  //   return () => clearTimeout(timer);
  // }, [search, filters.search, onFiltersChange]);

  const handleApplyFilters = useCallback(() => {
    onFiltersChange({
      search: search || undefined,
      cpf: cpf ? unmaskCPF(cpf) : undefined,
      id: reservationId || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      roomId: roomId || undefined,
      checkInFrom: checkInFrom ? checkInFrom.toISOString() : undefined,
      checkInTo: checkInTo ? checkInTo.toISOString() : undefined,
      checkOutFrom: checkOutFrom ? checkOutFrom.toISOString() : undefined,
      checkOutTo: checkOutTo ? checkOutTo.toISOString() : undefined,
    });
  }, [
    search,
    cpf,
    reservationId,
    selectedStatuses,
    roomId,
    checkInFrom,
    checkInTo,
    checkOutFrom,
    checkOutTo,
    onFiltersChange,
  ]);

  const handleClear = useCallback(() => {
    setSearch("");
    setCpf("");
    setReservationId("");
    setSelectedStatuses([]);
    setRoomId("");
    setCheckInFrom(null);
    setCheckInTo(null);
    setCheckOutFrom(null);
    setCheckOutTo(null);
    onClear();
  }, [onClear]);

  const handleStatusToggle = (status: ReservationStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack spacing={2}>
        {/* Primeira linha: Buscas */}
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <TextField
            label="Nome do Cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 200, flex: 1 }}
            placeholder="Buscar por nome..."
          />

          <TextField
            label="CPF"
            value={cpf}
            onChange={(e) => {
              const masked = maskCPF(e.target.value);
              setCpf(masked);
            }}
            size="small"
            sx={{ minWidth: 150 }}
            placeholder="000.000.000-00"
            inputProps={{ maxLength: 14 }}
          />

          <TextField
            label="Código da Reserva"
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
            placeholder="ID da reserva"
          />
        </Stack>

        {/* Segunda linha: Filtros de data e status */}
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
            <DatePicker
              label="Check-in (De)"
              value={checkInFrom}
              onChange={(date) => setCheckInFrom(date)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { minWidth: 150 },
                },
              }}
            />
            <DatePicker
              label="Check-in (Até)"
              value={checkInTo}
              onChange={(date) => setCheckInTo(date)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { minWidth: 150 },
                },
              }}
            />
            <DatePicker
              label="Check-out (De)"
              value={checkOutFrom}
              onChange={(date) => setCheckOutFrom(date)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { minWidth: 150 },
                },
              }}
            />
            <DatePicker
              label="Check-out (Até)"
              value={checkOutTo}
              onChange={(date) => setCheckOutTo(date)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { minWidth: 150 },
                },
              }}
            />
          </LocalizationProvider>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Quarto</InputLabel>
            <Select
              value={roomId}
              label="Quarto"
              onChange={(e) => setRoomId(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {rooms.map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  Quarto {room.number} - {room.type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Terceira linha: Status e ações */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <InputLabel sx={{ mr: 1 }}>Status:</InputLabel>
            {STATUS_OPTIONS.map((status) => (
              <Chip
                key={status}
                label={status}
                onClick={() => handleStatusToggle(status)}
                color={selectedStatuses.includes(status) ? "primary" : "default"}
                variant={selectedStatuses.includes(status) ? "filled" : "outlined"}
                size="small"
              />
            ))}
          </Box>

          <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<Search />}
              onClick={handleApplyFilters}
              size="small"
            >
              Filtrar
            </Button>
            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={handleClear}
              size="small"
            >
              Limpar
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Paper>
  );
}

