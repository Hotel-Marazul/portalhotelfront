"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { Close, Add, Delete } from "@mui/icons-material";
import { ptBR } from "date-fns/locale";
import { AxiosError, isAxiosError } from "axios";
import apiClient from "../../services/api";
import CustomSnackbar from "../snackbar";
import {
  formatReservationCalendarDate,
  getReservationRateType,
  getSuggestedDailyRate
} from "../../utils/reservation";

interface ModalNovaReservaProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  rooms: Room[];
}

interface Room {
  id: string;
  number: number;
  type: string;
  capacity: number;
  status: string;
  price: number;
  singlePrice?: number | null;
  couplePrice?: number | null;
}

interface Client {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
}

interface PricingRule {
  id: string;
  description: string;
  minAge: number;
  maxAge: number;
  price: number;
}

interface GuestForm {
  name: string;
  age: number;
  pricingRuleId: string | null;
}

interface ReservationFormData {
  roomId: string;
  clientId: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guests: GuestForm[];
  dailyRateOverride: string;
  discountAmount: string;
  priceOverrideReason: string;
}

const INCLUDED_GUESTS = 2;

export default function ModalNovaReserva({ open, onClose, onSuccess, rooms }: ModalNovaReservaProps) {
  const [formData, setFormData] = useState<ReservationFormData>({
    roomId: "",
    clientId: "",
    checkInDate: null,
    checkOutDate: null,
    guests: [],
    dailyRateOverride: "",
    discountAmount: "",
    priceOverrideReason: ""
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning"
  });

  const baseRooms = useMemo(
    () => rooms.filter((room) => !room.status.toLowerCase().includes("manuten")),
    [rooms]
  );

  useEffect(() => {
    if (!open) return;

    setLoadingData(true);
    Promise.all([
      apiClient.get<{ items: Client[] } | Client[]>("/api/client", {
        params: { page: 1, limit: 100 }
      }),
      apiClient.get<PricingRule[]>("/api/GuestPricingRule").catch(() => {
        return apiClient.get<PricingRule[]>("/api/pricing-rules").catch(() => {
          return Promise.resolve({ data: [] as PricingRule[] });
        });
      })
    ])
      .then(([clientsResponse, rulesResponse]) => {
        const rawClients = clientsResponse.data;
        setClients(Array.isArray(rawClients) ? rawClients : (rawClients as { items: Client[] }).items ?? []);
        setPricingRules(rulesResponse.data);
      })
      .catch(() => {
        setSnackbar({
          open: true,
          message: "Erro ao carregar dados necessarios.",
          severity: "error"
        });
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!formData.checkInDate) {
      setAvailableRooms(baseRooms);
      return;
    }

    let cancelled = false;
    setLoadingAvailability(true);

    const params: Record<string, string> = {
      checkIn: formatReservationCalendarDate(formData.checkInDate)
    };

    if (formData.checkOutDate) {
      params.checkOut = formatReservationCalendarDate(formData.checkOutDate);
    }

    apiClient
      .get<Room[]>("/api/rooms/availability", { params })
      .then((response) => {
        if (cancelled) return;
        const roomsList = Array.isArray(response.data) ? response.data : [];
        setAvailableRooms(roomsList);

        setFormData((previous) => {
          if (!previous.roomId) return previous;
          const stillAvailable = roomsList.some((room) => room.id === previous.roomId);
          return stillAvailable ? previous : { ...previous, roomId: "" };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRooms(baseRooms);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, formData.checkInDate, formData.checkOutDate, baseRooms]);

  const handleClose = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setFormData({
      roomId: "",
      clientId: "",
      checkInDate: null,
      checkOutDate: null,
      guests: [],
      dailyRateOverride: "",
      discountAmount: "",
      priceOverrideReason: ""
    });
    setSelectedClient(null);
    setAvailableRooms(baseRooms);
    onClose();
  }, [onClose, baseRooms]);

  useEffect(() => {
    if (!open) return;
    setAvailableRooms(baseRooms);
  }, [open, baseRooms]);

  const handleChange = (field: keyof ReservationFormData, value: string | Date | null) => {
    if (field === "clientId") {
      const client = clients.find((item) => item.id === (value as string)) ?? null;
      setSelectedClient(client);
      setFormData((previous) => ({ ...previous, clientId: value as string }));
      return;
    }

    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const handleGuestChange = (
    index: number,
    field: keyof GuestForm,
    value: string | number | null
  ) => {
    setFormData((previous) => {
      const updatedGuests = [...previous.guests];
      updatedGuests[index] = { ...updatedGuests[index], [field]: value };
      return { ...previous, guests: updatedGuests };
    });
  };

  const handleAddGuest = () => {
    setFormData((previous) => {
      const currentCount = previous.guests.length;
      const paidGuest = currentCount >= INCLUDED_GUESTS - 1;

      return {
        ...previous,
        guests: [
          ...previous.guests,
          {
            name: "",
            age: 0,
            pricingRuleId: paidGuest ? "" : null
          }
        ]
      };
    });
  };

  const handleRemoveGuest = (index: number) => {
    setFormData((previous) => ({
      ...previous,
      guests: previous.guests.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const getAvailablePricingRules = (age: number) => {
    return pricingRules.filter((rule) => age >= rule.minAge && age <= rule.maxAge);
  };

  const isGuestFree = (index: number) => index < INCLUDED_GUESTS - 1;
  const totalGuestCount = 1 + formData.guests.length;
  const selectedRoom = availableRooms.find((room) => room.id === formData.roomId) ?? null;
  const rateType = getReservationRateType(totalGuestCount);
  const suggestedDailyRate = getSuggestedDailyRate(selectedRoom, totalGuestCount);

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    if (!formData.roomId || !formData.clientId || !formData.checkInDate || !formData.checkOutDate) {
      setSnackbar({
        open: true,
        message: "Preencha todos os campos obrigatorios.",
        severity: "error"
      });
      return;
    }

    if (formData.checkOutDate <= formData.checkInDate) {
      setSnackbar({
        open: true,
        message: "A data de check-out deve ser posterior a data de check-in.",
        severity: "error"
      });
      return;
    }

    for (let index = 0; index < formData.guests.length; index++) {
      const guest = formData.guests[index];
      if (!guest.name || guest.age < 0) {
        setSnackbar({
          open: true,
          message: `Preencha nome e idade do hospede adicional ${index + 1}.`,
          severity: "error"
        });
        return;
      }

      if (index >= INCLUDED_GUESTS - 1 && !guest.pricingRuleId) {
        setSnackbar({
          open: true,
          message: `Selecione uma regra de preco para o hospede adicional ${index + 1}.`,
          severity: "error"
        });
        return;
      }
    }

    const dailyRateOverride = formData.dailyRateOverride.trim()
      ? Number(formData.dailyRateOverride)
      : undefined;
    const discountAmount = formData.discountAmount.trim()
      ? Number(formData.discountAmount)
      : undefined;

    if (dailyRateOverride !== undefined && (!Number.isFinite(dailyRateOverride) || dailyRateOverride <= 0)) {
      setSnackbar({ open: true, message: "Informe uma diária válida.", severity: "error" });
      return;
    }

    if (discountAmount !== undefined && (!Number.isFinite(discountAmount) || discountAmount < 0)) {
      setSnackbar({ open: true, message: "Informe um desconto válido.", severity: "error" });
      return;
    }

    if ((dailyRateOverride !== undefined || (discountAmount ?? 0) > 0) && !formData.priceOverrideReason.trim()) {
      setSnackbar({
        open: true,
        message: "Informe o motivo do ajuste manual de preço.",
        severity: "error"
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        roomId: formData.roomId,
        clientId: formData.clientId,
        checkInDate: formatReservationCalendarDate(formData.checkInDate),
        checkOutDate: formatReservationCalendarDate(formData.checkOutDate),
        guests: formData.guests.map((guest) => ({
          name: guest.name,
          age: guest.age,
          pricingRuleId: guest.pricingRuleId || null
        })),
        ...(dailyRateOverride !== undefined ? { dailyRateOverride } : {}),
        ...(discountAmount !== undefined ? { discountAmount } : {}),
        ...(formData.priceOverrideReason.trim()
          ? { priceOverrideReason: formData.priceOverrideReason.trim() }
          : {})
      };

      await apiClient.post("/api/Reservations", payload);

      setSnackbar({
        open: true,
        message: "Reserva criada com sucesso!",
        severity: "success"
      });

      onSuccess?.();
      handleClose();
    } catch (error) {
      const defaultMessage = "Erro ao criar reserva.";
      if (isAxiosError(error)) {
        const axiosError = error as AxiosError<{ message?: string }>;
        setSnackbar({
          open: true,
          message: axiosError.response?.data?.message || defaultMessage,
          severity: "error"
        });
      } else {
        setSnackbar({
          open: true,
          message: defaultMessage,
          severity: "error"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" disableRestoreFocus>
        <DialogTitle
          sx={{
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          Nova Reserva
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {loadingData ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
              <Alert severity="info" sx={{ mb: 1 }}>
                {totalGuestCount === 1
                  ? "1 hóspede usa a tarifa de solteiro."
                  : "2 hóspedes usam a tarifa de casal; a partir do 3º hóspede total, há cobrança adicional por idade."}
              </Alert>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                <Stack direction="row" spacing={2}>
                  <DatePicker
                    label="Check-in"
                    value={formData.checkInDate}
                    onChange={(date) => handleChange("checkInDate", date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true
                      }
                    }}
                    minDate={new Date()}
                  />
                  <DatePicker
                    label="Check-out"
                    value={formData.checkOutDate}
                    onChange={(date) => handleChange("checkOutDate", date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true
                      }
                    }}
                    minDate={formData.checkInDate || new Date()}
                  />
                </Stack>
              </LocalizationProvider>

              <Typography variant="body2" color="text.secondary">
                {loadingAvailability
                  ? "Consultando quartos disponiveis..."
                  : `Quartos disponiveis no periodo: ${availableRooms.length}`}
              </Typography>

              <FormControl fullWidth required>
                <InputLabel>Quarto</InputLabel>
                <Select
                  value={formData.roomId}
                  label="Quarto"
                  onChange={(event) => handleChange("roomId", event.target.value)}
                >
                  {availableRooms.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      Quarto {room.number} - {room.type} (Capacidade: {room.capacity})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Paper elevation={0} sx={{ p: 2, bgcolor: "#f5f7ff", border: "1px solid #c7d2fe" }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Precificação da reserva
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {rateType === "single" ? "Tarifa de solteiro" : "Tarifa de casal"} · sugestão da categoria:{" "}
                  {suggestedDailyRate == null ? "não cadastrada" : `R$ ${suggestedDailyRate.toFixed(2)}`}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Diária aplicada (opcional)"
                    type="number"
                    value={formData.dailyRateOverride}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, dailyRateOverride: event.target.value }))
                    }
                    inputProps={{ min: 0.01, step: "0.01" }}
                    helperText="Deixe vazio para usar a tarifa sugerida. O valor digitado vale somente para esta reserva."
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Desconto total (opcional)"
                    type="number"
                    value={formData.discountAmount}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, discountAmount: event.target.value }))
                    }
                    inputProps={{ min: 0, step: "0.01" }}
                    fullWidth
                    size="small"
                  />
                  {(formData.dailyRateOverride.trim() !== "" || Number(formData.discountAmount) > 0) && (
                    <TextField
                      label="Motivo do ajuste"
                      value={formData.priceOverrideReason}
                      onChange={(event) =>
                        setFormData((previous) => ({ ...previous, priceOverrideReason: event.target.value }))
                      }
                      helperText="Fica registrado com o usuário que lançou a reserva."
                      required
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                    />
                  )}
                </Stack>
              </Paper>

              <FormControl fullWidth required>
                <InputLabel>Cliente</InputLabel>
                <Select
                  value={formData.clientId}
                  label="Cliente"
                  onChange={(event) => handleChange("clientId", event.target.value)}
                >
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.fullName} - {client.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedClient && (
                <Paper
                  elevation={2}
                  sx={{
                    p: 2,
                    bgcolor: "#e8f5e9",
                    border: "1px solid #81c784"
                  }}
                >
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Hospede Principal
                    <Chip size="small" label="Incluido" color="success" sx={{ ml: 1 }} />
                  </Typography>
                  <Typography variant="body2">
                    <strong>Nome:</strong> {selectedClient.fullName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email:</strong> {selectedClient.email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>CPF:</strong> {selectedClient.cpf}
                  </Typography>
                </Paper>
              )}

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Hospedes Adicionais ({formData.guests.length})</Typography>
                  <Button startIcon={<Add />} onClick={handleAddGuest} variant="outlined" size="small">
                    Adicionar Hospede
                  </Button>
                </Box>

                {formData.guests.map((guest, index) => {
                  const availableRules = getAvailablePricingRules(guest.age);
                  const freeGuest = isGuestFree(index);

                  return (
                    <Paper
                      key={index}
                      elevation={1}
                      sx={{
                        p: 2,
                        mb: 2,
                        bgcolor: freeGuest ? "#e8f5e9" : "#fff3e0",
                        border: "1px solid",
                        borderColor: freeGuest ? "#81c784" : "#ffb74d"
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          Hospede Adicional {index + 1}
                          <Chip
                            size="small"
                            label={freeGuest ? "Incluido" : "Adicional"}
                            color={freeGuest ? "success" : "warning"}
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                        <IconButton size="small" onClick={() => handleRemoveGuest(index)} color="error">
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack spacing={2}>
                        <TextField
                          label="Nome"
                          value={guest.name}
                          onChange={(event) => handleGuestChange(index, "name", event.target.value)}
                          fullWidth
                          required
                          size="small"
                        />
                        <TextField
                          label="Idade"
                          type="number"
                          value={guest.age}
                          onChange={(event) =>
                            handleGuestChange(index, "age", parseInt(event.target.value, 10) || 0)
                          }
                          fullWidth
                          required
                          size="small"
                          inputProps={{ min: 0, max: 120 }}
                        />
                        <FormControl fullWidth size="small">
                          <InputLabel>{freeGuest ? "Regra de Preco (Opcional)" : "Regra de Preco *"}</InputLabel>
                          <Select
                            value={guest.pricingRuleId || ""}
                            label={freeGuest ? "Regra de Preco (Opcional)" : "Regra de Preco *"}
                            onChange={(event) =>
                              handleGuestChange(index, "pricingRuleId", event.target.value || null)
                            }
                            disabled={guest.age < 0}
                            required={!freeGuest}
                          >
                            <MenuItem value="">
                              <em>
                                {freeGuest ? "Nenhuma regra de preco" : "Selecione uma regra (obrigatorio)"}
                              </em>
                            </MenuItem>
                            {availableRules.length === 0 && guest.age > 0 ? (
                              <MenuItem disabled>Nenhuma regra para essa idade</MenuItem>
                            ) : (
                              availableRules.map((rule) => (
                                <MenuItem key={rule.id} value={rule.id}>
                                  {rule.description} - R$ {rule.price.toFixed(2)}
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                      </Stack>
                    </Paper>
                  );
                })}

                {formData.guests.length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                    Clique em &quot;Adicionar Hospede&quot; para incluir acompanhantes.
                  </Typography>
                )}
              </Box>

              <Paper elevation={0} sx={{ p: 2, bgcolor: "#f5f5f5" }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Resumo de Hospedes
                </Typography>
                <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
                  <Typography variant="body2">
                    <strong>Cliente:</strong> 1
                  </Typography>
                  <Typography variant="body2">
                    <strong>Incluidos:</strong> {Math.min(formData.guests.length, INCLUDED_GUESTS - 1)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Adicionais:</strong>{" "}
                    {Math.max(0, formData.guests.length - (INCLUDED_GUESTS - 1))}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total:</strong> {totalGuestCount}
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={loading || loadingData}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading || loadingData}>
            {loading ? <CircularProgress size={22} color="inherit" /> : "Criar Reserva"}
          </Button>
        </DialogActions>
      </Dialog>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      />
    </>
  );
}
