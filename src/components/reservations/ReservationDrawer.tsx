"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Paper,
  Divider,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { Close, Save, Add, Delete } from "@mui/icons-material";
import { ReservationDto, ReservationStatus } from "@/types/reservations";
import { formatDate, formatCurrency, calculateNights } from "@/utils/format";
import { formatCPF } from "@/utils/cpf";
import StatusBadge from "./StatusBadge";
import apiClient from "@/service/api";

interface ReservationDrawerProps {
  open: boolean;
  reservation: ReservationDto | null;
  mode: "view" | "edit";
  onClose: () => void;
  onSave: (reservation: ReservationDto) => void;
  onStatusChange: (reservationId: string, status: ReservationStatus) => Promise<void>;
}

interface GuestForm {
  id?: string;
  name: string;
  age: number;
  pricingRuleId: string | null;
}

export default function ReservationDrawer({
  open,
  reservation,
  mode,
  onClose,
  onSave,
  onStatusChange,
}: ReservationDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState<GuestForm[]>([]);
  const [pricingRules, setPricingRules] = useState<Array<{ id: string; description: string; price: number }>>([]);

  // Carrega pricing rules
  useEffect(() => {
    if (open) {
      apiClient
        .get("/api/GuestPricingRule")
        .then((response) => {
          setPricingRules(response.data || []);
        })
        .catch(() => {
          // Ignora erro se não existir
        });
    }
  }, [open]);

  // Inicializa form quando reserva muda
  useEffect(() => {
    if (reservation) {
      setCheckInDate(new Date(reservation.checkInDate));
      setCheckOutDate(new Date(reservation.checkOutDate));
      setGuests(
        reservation.guests.map((g) => ({
          id: g.id,
          name: g.name,
          age: g.age,
          pricingRuleId: g.pricingRuleId || null,
        }))
      );
      setError(null);
    }
  }, [reservation]);

  const handleAddGuest = () => {
    setGuests([...guests, { name: "", age: 0, pricingRuleId: null }]);
  };

  const handleRemoveGuest = (index: number) => {
    setGuests(guests.filter((_, i) => i !== index));
  };

  const handleGuestChange = (index: number, field: keyof GuestForm, value: any) => {
    const newGuests = [...guests];
    newGuests[index] = { ...newGuests[index], [field]: value };
    setGuests(newGuests);
  };

  const handleSave = async () => {
    if (!reservation) return;

    // Validações
    if (!checkInDate || !checkOutDate) {
      setError("Preencha as datas de check-in e check-out");
      return;
    }

    if (checkOutDate <= checkInDate) {
      setError("A data de check-out deve ser posterior à data de check-in");
      return;
    }

    if (guests.length === 0) {
      setError("Adicione pelo menos um hóspede");
      return;
    }

    for (const guest of guests) {
      if (!guest.name || guest.age <= 0) {
        setError("Preencha todos os dados dos hóspedes");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const updateData = {
        id: reservation.id,
        roomId: reservation.roomId,
        clientId: reservation.clientId,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guests: guests.map((g) => ({
          name: g.name,
          age: g.age,
          pricingRuleId: g.pricingRuleId || null,
        })),
      };

      const response = await apiClient.put(`/api/Reservations/${reservation.id}`, updateData);
      onSave(response.data);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao salvar reserva";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ReservationStatus) => {
    if (!reservation) return;

    if (newStatus === "Cancelada") {
      if (!confirm("Tem certeza que deseja cancelar esta reserva?")) {
        return;
      }
    }

    try {
      await onStatusChange(reservation.id, newStatus);
      // Atualiza localmente
      if (reservation) {
        reservation.status = newStatus;
      }
    } catch (err) {
      console.error("Erro ao alterar status:", err);
    }
  };

  const getAvailablePricingRules = (age: number) => {
    return pricingRules.filter((rule: any) => age >= rule.minAge && age <= rule.maxAge);
  };

  if (!reservation) return null;

  const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);
  const isEditMode = mode === "edit";

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 600 } } }}>
      <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            {isEditMode ? "Editar Reserva" : "Detalhes da Reserva"}
          </Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Informações da Reserva */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Código
              </Typography>
              <Typography variant="body1" fontFamily="monospace">
                {reservation.id.substring(0, 8).toUpperCase()}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {isEditMode ? (
                  <FormControl size="small" fullWidth>
                    <Select
                      value={reservation.status}
                      onChange={(e) => handleStatusChange(e.target.value as ReservationStatus)}
                    >
                      <MenuItem value="Pendente">Pendente</MenuItem>
                      <MenuItem value="Confirmada">Confirmada</MenuItem>
                      <MenuItem value="EmAndamento">Em Andamento</MenuItem>
                      <MenuItem value="Concluída">Concluída</MenuItem>
                      <MenuItem value="Cancelada">Cancelada</MenuItem>
                    </Select>
                  </FormControl>
                ) : (
                  <StatusBadge status={reservation.status} />
                )}
              </Box>
            </Box>

            <Divider />

            {/* Cliente */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                Cliente
              </Typography>
              <Typography variant="body2">
                <strong>Nome:</strong> {reservation.client?.name || reservation.client?.fullName || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>CPF:</strong> {formatCPF(reservation.client?.cpf)}
              </Typography>
            </Box>

            <Divider />

            {/* Quarto */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                Quarto
              </Typography>
              <Typography variant="body2">
                {reservation.room?.number
                  ? `Quarto ${reservation.room.number}`
                  : reservation.room?.name || "-"}
                {reservation.room?.type && ` - ${reservation.room.type}`}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Datas */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" mb={2}>
            Período
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
            <Stack spacing={2}>
              <DatePicker
                label="Check-in"
                value={checkInDate}
                onChange={setCheckInDate}
                disabled={!isEditMode}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                  },
                }}
              />
              <DatePicker
                label="Check-out"
                value={checkOutDate}
                onChange={setCheckOutDate}
                disabled={!isEditMode}
                minDate={checkInDate || undefined}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                  },
                }}
              />
            </Stack>
          </LocalizationProvider>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {nights} {nights === 1 ? "noite" : "noites"}
          </Typography>
        </Paper>

        {/* Hóspedes */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Hóspedes ({guests.length})
            </Typography>
            {isEditMode && (
              <Button startIcon={<Add />} onClick={handleAddGuest} size="small">
                Adicionar
              </Button>
            )}
          </Box>

          <Stack spacing={2}>
            {guests.map((guest, index) => {
              const availableRules = getAvailablePricingRules(guest.age);
              return (
                <Paper key={index} elevation={1} sx={{ p: 2, bgcolor: "#f9fafb" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="caption" fontWeight="bold">
                      Hóspede {index + 1}
                    </Typography>
                    {isEditMode && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveGuest(index)}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  <Stack spacing={2}>
                    <TextField
                      label="Nome"
                      value={guest.name}
                      onChange={(e) => handleGuestChange(index, "name", e.target.value)}
                      disabled={!isEditMode}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Idade"
                      type="number"
                      value={guest.age || ""}
                      onChange={(e) => handleGuestChange(index, "age", parseInt(e.target.value) || 0)}
                      disabled={!isEditMode}
                      fullWidth
                      size="small"
                      inputProps={{ min: 0, max: 120 }}
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel>Regra de Preço (Opcional)</InputLabel>
                      <Select
                        value={guest.pricingRuleId || ""}
                        label="Regra de Preço (Opcional)"
                        onChange={(e) => handleGuestChange(index, "pricingRuleId", e.target.value || null)}
                        disabled={!isEditMode || guest.age <= 0}
                      >
                        <MenuItem value="">
                          <em>Nenhuma regra de preço</em>
                        </MenuItem>
                        {availableRules.map((rule) => (
                          <MenuItem key={rule.id} value={rule.id}>
                            {rule.description} - R$ {rule.price.toFixed(2)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        {/* Total */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6" fontWeight="bold">
              {formatCurrency(reservation.totalPrice)}
            </Typography>
          </Box>
        </Paper>

        {/* Actions */}
        {isEditMode && (
          <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={onClose} fullWidth disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSave}
              fullWidth
              disabled={loading}
            >
              Salvar
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

