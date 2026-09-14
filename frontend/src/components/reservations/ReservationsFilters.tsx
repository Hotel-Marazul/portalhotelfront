"use client";

import React, { useState, useCallback } from "react";
import {
  Box,
  TextField,
  Button,
  Stack,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { Search, Clear } from "@mui/icons-material";
import StatusFilterChips from "./StatusFilterChips";
import { ReservationsFilters, ReservationStatus } from "../../types/reservations";
import { formatReservationPickerDate, parseReservationPickerDate } from "../../utils/reservation";

const STATUS_OPTIONS: ReservationStatus[] = [
  "Pendente",
  "Confirmada",
  "EmAndamento",
  "Concluída",
  "Cancelada",
];

interface Props {
  filters: ReservationsFilters;
  onFiltersChange: (filters: Partial<ReservationsFilters>) => void;
  onClear: () => void;
}

export default function ReservationsFiltersComponent({
  filters,
  onFiltersChange,
  onClear,
}: Props) {
  const [search, setSearch] = useState(filters.search || "");
  const [selectedStatuses, setSelectedStatuses] = useState<ReservationStatus[]>(
    filters.status || []
  );
  const [checkInFrom, setCheckInFrom] = useState<Date | null>(
    filters.checkInFrom ? parseReservationPickerDate(filters.checkInFrom) : null
  );
  const [checkInTo, setCheckInTo] = useState<Date | null>(
    filters.checkInTo ? parseReservationPickerDate(filters.checkInTo) : null
  );

  const handleApplyFilters = useCallback(() => {
    onFiltersChange({
      search: search || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      checkInFrom: checkInFrom ? formatReservationPickerDate(checkInFrom) : undefined,
      checkInTo: checkInTo ? formatReservationPickerDate(checkInTo) : undefined,
    });
  }, [
    search,
    selectedStatuses,
    checkInFrom,
    checkInTo,
    onFiltersChange,
  ]);

  const handleClear = useCallback(() => {
    setSearch("");
    setSelectedStatuses([]);
    setCheckInFrom(null);
    setCheckInTo(null);
    onClear();
  }, [onClear]);

  const handleStatusToggle = (status: ReservationStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap flexWrap="wrap">
        <TextField
          label="Buscar hóspede"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: { xs: 0, sm: 220 }, flex: 1 }}
          placeholder="Nome do hóspede"
        />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", flex: 2 }}>
          <StatusFilterChips
            selected={selectedStatuses}
            onToggle={handleStatusToggle}
            statuses={STATUS_OPTIONS}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={handleApplyFilters}
            size="small"
          >
            Aplicar
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

      <Box component="details" className="reservation-advanced-filters">
          <Box component="summary">Mais filtros: período</Box>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap flexWrap="wrap">
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
              <DatePicker label="Check-in a partir de" value={checkInFrom} onChange={setCheckInFrom} slotProps={{ textField: { size: "small", sx: { minWidth: { xs: 0, sm: 180 }, width: { xs: "100%", sm: "auto" } } } }} />
              <DatePicker label="Check-in até" value={checkInTo} onChange={setCheckInTo} slotProps={{ textField: { size: "small", sx: { minWidth: { xs: 0, sm: 180 }, width: { xs: "100%", sm: "auto" } } } }} />
            </LocalizationProvider>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}
