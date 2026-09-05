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
  CircularProgress,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { Close, Save, Add, Delete } from "@mui/icons-material";
import { ReservationDto, ReservationStatus } from "../../types/reservations";
import { formatCurrency, calculateNights, formatDateTime } from "../../utils/format";
import { formatCPF } from "../../utils/cpf";
import StatusBadge from "./StatusBadge";
import apiClient from "../../services/api";
import { formatReservationCalendarDate, parseReservationDate } from "../../utils/reservation";

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

interface PricingRuleOption {
  id: string;
  description: string;
  price: number;
  minAge: number;
  maxAge: number;
}

interface ReservationPaymentForm {
  stage: "Confirmacao" | "CheckIn" | "CheckOut";
  method: "Dinheiro" | "Pix" | "CartaoDebito" | "CartaoCredito";
  amount: string;
  note: string;
}

const PAYMENT_STAGE_LABELS: Record<ReservationPaymentForm["stage"], string> = {
  Confirmacao: "Confirmação",
  CheckIn: "Check-in",
  CheckOut: "Check-out"
};

const PAYMENT_METHOD_LABELS: Record<ReservationPaymentForm["method"], string> = {
  Dinheiro: "Dinheiro",
  Pix: "Pix",
  CartaoDebito: "Cartão de débito",
  CartaoCredito: "Cartão de crédito"
};

const INCLUDED_ADDITIONAL_GUESTS = 1;

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
  const [dailyRateOverride, setDailyRateOverride] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [priceOverrideReason, setPriceOverrideReason] = useState("");
  const [clearDailyRateOverride, setClearDailyRateOverride] = useState(false);
  const [pricingRules, setPricingRules] = useState<PricingRuleOption[]>([]);
  const [payments, setPayments] = useState(reservation?.payments ?? []);
  const [paymentForm, setPaymentForm] = useState<ReservationPaymentForm>({
    stage: "Confirmacao",
    method: "Pix",
    amount: "",
    note: ""
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

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
      setCheckInDate(parseReservationDate(reservation.checkInDate));
      setCheckOutDate(parseReservationDate(reservation.checkOutDate));
      setGuests(
        reservation.guests.map((g) => ({
          id: g.id,
          name: g.name,
          age: g.age,
          pricingRuleId: g.pricingRuleId || null,
        }))
      );
      setDailyRateOverride(
        reservation.pricing?.priceSource === "manual"
          ? reservation.pricing.dailyRate.toFixed(2)
          : ""
      );
      setDiscountAmount(
        reservation.pricing && reservation.pricing.discountAmount > 0
          ? reservation.pricing.discountAmount.toFixed(2)
          : ""
      );
      setPriceOverrideReason(reservation.pricing?.overrideReason ?? "");
      setClearDailyRateOverride(false);
      setError(null);
      setPayments(reservation.payments ?? []);
      setPaymentForm({
        stage: "Confirmacao",
        method: "Pix",
        amount: "",
        note: ""
      });
    }
  }, [reservation]);

  useEffect(() => {
    if (!open || !reservation) return;

    apiClient
      .get(`/api/Reservations/${reservation.id}/payments`)
      .then((response) => {
        setPayments(response.data?.items ?? []);
      })
      .catch(() => {
        setPayments(reservation.payments ?? []);
      });
  }, [open, reservation]);

  const handleAddGuest = () => {
    setGuests([
      ...guests,
      {
        name: "",
        age: 0,
        pricingRuleId: guests.length >= INCLUDED_ADDITIONAL_GUESTS ? "" : null
      }
    ]);
  };

  const handleRemoveGuest = (index: number) => {
    setGuests(guests.filter((_, i) => i !== index));
  };

  const handleGuestChange = <K extends keyof GuestForm>(
    index: number,
    field: K,
    value: GuestForm[K]
  ) => {
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

    for (const [index, guest] of guests.entries()) {
      if (!guest.name || guest.age < 0) {
        setError("Preencha todos os dados dos hóspedes");
        return;
      }

      if (index >= INCLUDED_ADDITIONAL_GUESTS && !guest.pricingRuleId) {
        setError("Selecione uma regra de preço para os hóspedes adicionais pagos");
        return;
      }
    }

    const parsedDailyRate = dailyRateOverride.trim() ? Number(dailyRateOverride) : undefined;
    const parsedDiscount = discountAmount.trim()
      ? Number(discountAmount)
      : reservation.pricing
        ? 0
        : undefined;
    if (parsedDailyRate !== undefined && (!Number.isFinite(parsedDailyRate) || parsedDailyRate <= 0)) {
      setError("Informe uma diária válida.");
      return;
    }
    if (parsedDiscount !== undefined && (!Number.isFinite(parsedDiscount) || parsedDiscount < 0)) {
      setError("Informe um desconto válido.");
      return;
    }
    if (
      (parsedDailyRate !== undefined || (parsedDiscount ?? 0) > 0) &&
      !priceOverrideReason.trim()
    ) {
      setError("Informe o motivo do ajuste manual de preço.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updateData = {
        id: reservation.id,
        roomId: reservation.roomId,
        clientId: reservation.clientId,
        checkInDate: formatReservationCalendarDate(checkInDate),
        checkOutDate: formatReservationCalendarDate(checkOutDate),
        status: reservation.status === "Concluida" ? "Concluída" : reservation.status,
        guests: guests.map((g) => ({
          name: g.name,
          age: g.age,
          pricingRuleId: g.pricingRuleId || null,
        })),
        ...(parsedDailyRate !== undefined ? { dailyRateOverride: parsedDailyRate } : {}),
        ...(parsedDiscount !== undefined ? { discountAmount: parsedDiscount } : {}),
        ...(priceOverrideReason.trim()
          ? { priceOverrideReason: priceOverrideReason.trim() }
          : {}),
        ...(clearDailyRateOverride ? { clearDailyRateOverride: true } : {})
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

  const handleRegisterPayment = async () => {
    if (!reservation) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido para o pagamento");
      return;
    }

    setPaymentLoading(true);
    setError(null);

    try {
      const response = await apiClient.post(`/api/Reservations/${reservation.id}/payments`, {
        stage: paymentForm.stage,
        method: paymentForm.method,
        amount,
        note: paymentForm.note
      });

      const updatedReservation = response.data?.reservation ?? reservation;
      setPayments(updatedReservation.payments ?? []);
      onSave(updatedReservation);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao registrar pagamento";
      setError(errorMessage);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleQuickPaymentSetup = (
    stage: ReservationPaymentForm["stage"],
    amount?: number
  ) => {
    setPaymentForm((prev) => ({
      ...prev,
      stage,
      amount: typeof amount === "number" ? amount.toFixed(2) : prev.amount
    }));
  };

  const getAvailablePricingRules = (age: number) => {
    return pricingRules.filter((rule) => age >= rule.minAge && age <= rule.maxAge);
  };

  if (!reservation) return null;

  const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);
  const isEditMode = mode === "edit";
  const pricing = reservation.pricing;
  const totalGuestCount = guests.length + 1;

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

        {/* Precificação */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" mb={1}>
            Precificação
          </Typography>
          {isEditMode && (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Diária aplicada (opcional)"
                type="number"
                value={dailyRateOverride}
                onChange={(event) => {
                  setDailyRateOverride(event.target.value);
                  setClearDailyRateOverride(false);
                }}
                helperText="Vazia usa a tarifa da categoria; preenchida vale somente para esta reserva."
                inputProps={{ min: 0.01, step: "0.01" }}
                fullWidth
                size="small"
              />
              <TextField
                label="Desconto total (opcional)"
                type="number"
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
                size="small"
              />
              {(dailyRateOverride.trim() !== "" || Number(discountAmount) > 0) && (
                <TextField
                  label="Motivo do ajuste"
                  value={priceOverrideReason}
                  onChange={(event) => setPriceOverrideReason(event.target.value)}
                  helperText="Fica registrado com o usuário que lançou a alteração."
                  required
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                />
              )}
              {reservation.pricing?.priceSource === "manual" && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setDailyRateOverride("");
                    setClearDailyRateOverride(true);
                    if (!(reservation.pricing?.discountAmount ?? 0)) {
                      setPriceOverrideReason("");
                    }
                  }}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Usar tarifa da categoria
                </Button>
              )}
            </Stack>
          )}

          {pricing ? (
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Tarifa:</strong> {pricing.rateType === "single" ? "solteiro" : "casal"} · {formatCurrency(pricing.dailyRate)}/noite
              </Typography>
              <Typography variant="body2">
                <strong>Adicionais por noite:</strong> {formatCurrency(pricing.additionalDailyTotal)}
              </Typography>
              <Typography variant="body2">
                <strong>Período:</strong> {pricing.nights} {pricing.nights === 1 ? "noite" : "noites"}
              </Typography>
              <Typography variant="body2">
                <strong>Subtotal:</strong> {formatCurrency(pricing.subtotal)}
              </Typography>
              <Typography variant="body2">
                <strong>Desconto:</strong> {formatCurrency(pricing.discountAmount)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Origem: {pricing.priceSource === "manual" ? "ajuste manual" : "tarifa da categoria"} · {totalGuestCount} {totalGuestCount === 1 ? "hóspede" : "hóspedes"}
              </Typography>
              {pricing.overrideReason && (
                <Typography variant="caption" color="text.secondary">
                  Motivo: {pricing.overrideReason}
                </Typography>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              O detalhamento será calculado pelo servidor ao salvar esta reserva.
            </Typography>
          )}
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
              const freeGuest = index < INCLUDED_ADDITIONAL_GUESTS;
              return (
                <Paper key={index} elevation={1} sx={{ p: 2, bgcolor: "#f9fafb" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="caption" fontWeight="bold">
                      Hóspede {index + 1} {freeGuest ? "(incluído)" : "(adicional)"}
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
                      value={guest.age}
                      onChange={(e) => handleGuestChange(index, "age", parseInt(e.target.value) || 0)}
                      disabled={!isEditMode}
                      fullWidth
                      size="small"
                      inputProps={{ min: 0, max: 120 }}
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel>{freeGuest ? "Regra de Preço (Opcional)" : "Regra de Preço *"}</InputLabel>
                      <Select
                        value={guest.pricingRuleId || ""}
                        label={freeGuest ? "Regra de Preço (Opcional)" : "Regra de Preço *"}
                        onChange={(e) => handleGuestChange(index, "pricingRuleId", e.target.value || null)}
                        disabled={!isEditMode || guest.age < 0}
                        required={!freeGuest}
                      >
                        <MenuItem value="">
                          <em>{freeGuest ? "Nenhuma regra de preço" : "Selecione uma regra (obrigatório)"}</em>
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

        {/* Pagamentos */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" mb={2}>
            Pagamentos
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickPaymentSetup("Confirmacao", pricing?.dailyRate ?? reservation.room?.dailyPrice ?? 0)}
            >
              Receber entrada
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickPaymentSetup("CheckIn")}
            >
              Registrar check-in
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickPaymentSetup("CheckOut")}
            >
              Registrar check-out
            </Button>
          </Stack>

          <Stack spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Etapa</InputLabel>
              <Select
                value={paymentForm.stage}
                label="Etapa"
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    stage: e.target.value as ReservationPaymentForm["stage"]
                  }))
                }
              >
                <MenuItem value="Confirmacao">Confirmação</MenuItem>
                <MenuItem value="CheckIn">Check-in</MenuItem>
                <MenuItem value="CheckOut">Check-out</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Forma de pagamento</InputLabel>
              <Select
                value={paymentForm.method}
                label="Forma de pagamento"
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    method: e.target.value as ReservationPaymentForm["method"]
                  }))
                }
              >
                <MenuItem value="Pix">Pix</MenuItem>
                <MenuItem value="Dinheiro">Dinheiro</MenuItem>
                <MenuItem value="CartaoDebito">Cartão de débito</MenuItem>
                <MenuItem value="CartaoCredito">Cartão de crédito</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Valor"
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: "0.01" }}
            />

            <TextField
              label="Observação"
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />

            <Typography variant="caption" color="text.secondary">
              Pagamento de confirmação com valor mínimo de 1 diária muda a reserva para confirmada.
            </Typography>

            <Button
              variant="contained"
              onClick={handleRegisterPayment}
              disabled={paymentLoading}
            >
              Registrar pagamento
            </Button>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1}>
            {payments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum pagamento registrado.
              </Typography>
            ) : (
              payments.map((payment) => (
                <Paper key={payment.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {PAYMENT_STAGE_LABELS[payment.stage]} · {PAYMENT_METHOD_LABELS[payment.method]}
                  </Typography>
                  <Typography variant="body2">{formatCurrency(payment.amount)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(payment.createdAt)}
                  </Typography>
                  {payment.note ? (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {payment.note}
                    </Typography>
                  ) : null}
                </Paper>
              ))
            )}
          </Stack>
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
