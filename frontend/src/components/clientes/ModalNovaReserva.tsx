"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
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
  formatReservationPickerDate,
  getReservationRateType,
  getSuggestedDailyRate,
  parseReservationPickerDate
} from "../../utils/reservation";
import { apiErrorMessage } from "../../utils/api-error";
import { getIdempotencyAttempt } from "../../utils/idempotency";

export interface ReservationClient {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
}

export interface ReservationInitialValues {
  client?: ReservationClient | null;
  checkInDate?: Date | null;
  checkOutDate?: Date | null;
}

interface ModalNovaReservaProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialValues?: ReservationInitialValues;
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

type Client = ReservationClient;

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

export default function ModalNovaReserva({ open, onClose, onSuccess, initialValues }: ModalNovaReservaProps) {
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
  const [clientSearch, setClientSearch] = useState("");
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityRetryNonce, setAvailabilityRetryNonce] = useState(0);
  const availabilityRequestId = useRef(0);
  const createSubmittingRef = useRef(false);
  const [createIdempotencyKey, setCreateIdempotencyKey] = useState<string | null>(null);
  const [createAttemptFingerprint, setCreateAttemptFingerprint] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning"
  });

  const hotelToday = parseReservationPickerDate(formatReservationCalendarDate(new Date()));
  const totalGuestCount = 1 + formData.guests.length;

  const initialClient = initialValues?.client ?? null;
  const initialCheckInDate = initialValues?.checkInDate ?? null;
  const initialCheckOutDate = initialValues?.checkOutDate ?? null;

  useEffect(() => {
    if (!open) return;
    setSelectedClient(initialClient);
    setFormData((previous) => ({
      ...previous,
      clientId: initialClient?.id ?? "",
      checkInDate: initialCheckInDate ?? previous.checkInDate,
      checkOutDate: initialCheckOutDate ?? previous.checkOutDate,
    }));
  }, [open, initialClient, initialCheckInDate, initialCheckOutDate]);

  useEffect(() => {
    if (!open) return;

    setLoadingData(true);
    Promise.all([
      apiClient.get<PricingRule[]>("/api/GuestPricingRule").catch(() => {
        return apiClient.get<PricingRule[]>("/api/pricing-rules").catch(() => {
          return Promise.resolve({ data: [] as PricingRule[] });
        });
      })
    ])
      .then(([rulesResponse]) => {
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
    let cancelled = false;
    setClients([]);
    setClientsError(null);
    const timer = window.setTimeout(() => {
      setClientsLoading(true);
      setClientsError(null);
      apiClient.get<{ items: Client[] } | Client[]>("/api/client", {
        params: { page: 1, pageSize: 20, ...(clientSearch.trim() ? { search: clientSearch.trim() } : {}) }
      }).then((response) => {
        if (cancelled) return;
        const raw = response.data;
        setClients(Array.isArray(raw) ? raw : raw.items ?? []);
      }).catch((error) => {
        if (!cancelled) {
          setClients([]);
          setClientsError(apiErrorMessage(error, "Não foi possível carregar os clientes."));
        }
      }).finally(() => {
        if (!cancelled) setClientsLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientSearch, open]);

  useEffect(() => {
    if (!open) {
      availabilityRequestId.current += 1;
      setLoadingAvailability(false);
      return;
    }

    const requestId = ++availabilityRequestId.current;
    const checkInDate = formData.checkInDate;
    const checkOutDate = formData.checkOutDate;
    const invalidPeriod = !checkInDate || !checkOutDate || checkOutDate <= checkInDate;
    setAvailableRooms([]);
    setFormData((previous) => previous.roomId ? { ...previous, roomId: "" } : previous);
    setAvailabilityError(invalidPeriod && checkInDate && checkOutDate
      ? "O check-out deve ser posterior ao check-in."
      : null);
    if (invalidPeriod) {
      setLoadingAvailability(false);
      return;
    }

    let cancelled = false;
    setLoadingAvailability(true);
    setAvailabilityError(null);

    const params: Record<string, string> = {
      checkIn: formatReservationPickerDate(checkInDate!),
      guestCount: String(totalGuestCount)
    };

    if (formData.checkOutDate) {
      params.checkOut = formatReservationPickerDate(checkOutDate!);
    }

    apiClient
      .get<Room[]>("/api/rooms/availability", { params })
      .then((response) => {
        if (cancelled || requestId !== availabilityRequestId.current) return;
        const roomsList = Array.isArray(response.data) ? response.data : [];
        setAvailableRooms(roomsList);

        setFormData((previous) => {
          if (!previous.roomId) return previous;
          const stillAvailable = roomsList.some((room) => room.id === previous.roomId);
          return stillAvailable ? previous : { ...previous, roomId: "" };
        });
      })
      .catch((error) => {
        if (cancelled || requestId !== availabilityRequestId.current) return;
        setAvailableRooms([]);
        setFormData((previous) => previous.roomId ? { ...previous, roomId: "" } : previous);
        setAvailabilityError(apiErrorMessage(error, "Não foi possível consultar a disponibilidade. Tente novamente."));
      })
      .finally(() => {
        if (!cancelled && requestId === availabilityRequestId.current) {
          setLoadingAvailability(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, formData.checkInDate, formData.checkOutDate, totalGuestCount, availabilityRetryNonce]);

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
    setClientSearch("");
    setClientsError(null);
    setCreateIdempotencyKey(null);
    setCreateAttemptFingerprint(null);
    setAvailabilityError(null);
    setAvailableRooms([]);
    onClose();
  }, [onClose]);

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
  const selectedRoom = availableRooms.find((room) => room.id === formData.roomId) ?? null;
  const rateType = getReservationRateType(totalGuestCount);
  const suggestedDailyRate = getSuggestedDailyRate(selectedRoom, totalGuestCount);

  const revalidateAvailability = async (): Promise<boolean> => {
    const checkInDate = formData.checkInDate;
    const checkOutDate = formData.checkOutDate;
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) return false;

    const requestId = ++availabilityRequestId.current;
    setLoadingAvailability(true);
    setAvailabilityError(null);
    setAvailableRooms([]);
    try {
      const response = await apiClient.get<Room[]>("/api/rooms/availability", {
        params: {
          checkIn: formatReservationPickerDate(checkInDate),
          checkOut: formatReservationPickerDate(checkOutDate),
          guestCount: String(totalGuestCount)
        }
      });
      if (requestId !== availabilityRequestId.current) return false;
      const roomsList = Array.isArray(response.data) ? response.data : [];
      setAvailableRooms(roomsList);
      const selectedStillAvailable = roomsList.some((room) => room.id === formData.roomId);
      if (!selectedStillAvailable) {
        setFormData((previous) => ({ ...previous, roomId: "" }));
        setAvailabilityError("O quarto selecionado deixou de estar disponível. Escolha outro quarto.");
        return false;
      }
      return true;
    } catch (error) {
      if (requestId !== availabilityRequestId.current) return false;
      setAvailableRooms([]);
      setFormData((previous) => ({ ...previous, roomId: "" }));
      setAvailabilityError(apiErrorMessage(error, "Não foi possível consultar a disponibilidade. Tente novamente."));
      return false;
    } finally {
      if (requestId === availabilityRequestId.current) setLoadingAvailability(false);
    }
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (createSubmittingRef.current) return;

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

    if (loadingAvailability || availabilityError || !availableRooms.some((room) => room.id === formData.roomId)) {
      setSnackbar({
        open: true,
        message: availabilityError ?? "A disponibilidade ainda não foi validada para este quarto.",
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
    createSubmittingRef.current = true;
    try {
      if (!(await revalidateAvailability())) {
        setSnackbar({
          open: true,
          message: "A disponibilidade mudou ou não pôde ser confirmada. Escolha um quarto e tente novamente.",
          severity: "error"
        });
        return;
      }

      const payload = {
        roomId: formData.roomId,
        clientId: formData.clientId,
        checkInDate: formatReservationPickerDate(formData.checkInDate),
        checkOutDate: formatReservationPickerDate(formData.checkOutDate),
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
      const attempt = getIdempotencyAttempt(
        createIdempotencyKey && createAttemptFingerprint
          ? { key: createIdempotencyKey, fingerprint: createAttemptFingerprint }
          : null,
        payload,
      );
      setCreateIdempotencyKey(attempt.key);
      setCreateAttemptFingerprint(attempt.fingerprint);

      await apiClient.post("/api/Reservations", { ...payload, idempotencyKey: attempt.key });

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
      createSubmittingRef.current = false;
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
          <IconButton onClick={handleClose} size="small" aria-label="Fechar nova reserva">
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
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
                    minDate={hotelToday}
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
                    minDate={formData.checkInDate || hotelToday}
                  />
                </Stack>
              </LocalizationProvider>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" color={availabilityError ? "error" : "text.secondary"}>
                  {loadingAvailability
                    ? "Consultando quartos disponíveis..."
                    : availabilityError
                      ? availabilityError
                      : !formData.checkOutDate
                        ? "Informe o check-out para consultar quartos."
                        : `Quartos disponíveis no período: ${availableRooms.length}`}
                </Typography>
                {availabilityError && (
                  <Button
                    size="small"
                    onClick={() => setAvailabilityRetryNonce((value) => value + 1)}
                    disabled={loadingAvailability}
                  >
                    Tentar novamente
                  </Button>
                )}
              </Stack>

              <FormControl fullWidth required>
                <InputLabel>Quarto</InputLabel>
                <Select
                  value={formData.roomId}
                  disabled={loadingAvailability || Boolean(availabilityError) || availableRooms.length === 0}
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

              <Autocomplete
                options={selectedClient && !clients.some((client) => client.id === selectedClient.id)
                  ? [selectedClient, ...clients]
                  : clients}
                value={selectedClient}
                loading={clientsLoading}
                onChange={(_event, client) => {
                  setSelectedClient(client);
                  setFormData((previous) => ({ ...previous, clientId: client?.id ?? "" }));
                }}
                onInputChange={(_event, value) => setClientSearch(value)}
                getOptionLabel={(client) => `${client.fullName} — ${client.email}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText={clientsError ?? "Nenhum cliente encontrado"}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente"
                    required
                    error={Boolean(clientsError)}
                    helperText={clientsError ?? "Busque por nome, e-mail, telefone ou CPF."}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: <>{clientsLoading ? <CircularProgress size={18} /> : null}{params.InputProps.endAdornment}</>
                    }}
                  />
                )}
              />

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
                        <IconButton size="small" onClick={() => handleRemoveGuest(index)} color="error" aria-label={`Remover hóspede adicional ${index + 1}`}>
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
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading || loadingData || loadingAvailability || Boolean(availabilityError)}>
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
