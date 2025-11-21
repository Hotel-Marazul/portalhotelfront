"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Typography,
  Chip,
  Stack,
  Paper,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { Close, Add, Delete } from "@mui/icons-material";
import apiClient from "@/services/api";
import { AxiosError, isAxiosError } from "axios";
import CustomSnackbar from "@/components/snackbar";

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
  guests: GuestForm[]; // Apenas hóspedes ADICIONAIS (sem o cliente)
}

const INCLUDED_GUESTS = 2; // Cliente + 1 hóspede adicional gratuito

export default function ModalNovaReserva({
  open,
  onClose,
  onSuccess,
  rooms,
}: ModalNovaReservaProps) {
  const [formData, setFormData] = useState<ReservationFormData>({
    roomId: "",
    clientId: "",
    checkInDate: null,
    checkOutDate: null,
    guests: [],
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  // Carrega clientes e pricing rules quando o modal abre
  useEffect(() => {
    if (open) {
      setLoadingData(true);
      Promise.all([
        apiClient.get<Client[]>("/api/client"),
        apiClient.get<PricingRule[]>("/api/GuestPricingRule").catch(() => {
          return apiClient
            .get<PricingRule[]>("/api/pricing-rules")
            .catch(() => {
              return Promise.resolve({ data: [] as PricingRule[] });
            });
        }),
      ])
        .then(([clientsResponse, rulesResponse]) => {
          setClients(clientsResponse.data);
          setPricingRules(rulesResponse.data);
        })
        .catch((error) => {
          console.error("Erro ao carregar dados:", error);
          setSnackbar({
            open: true,
            message: "Erro ao carregar dados necessários.",
            severity: "error",
          });
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Reset form
    setFormData({
      roomId: "",
      clientId: "",
      checkInDate: null,
      checkOutDate: null,
      guests: [],
    });
    setSelectedClient(null);
    onClose();
  }, [onClose]);

  const handleChange = (
    field: keyof ReservationFormData,
    value: string | Date | null
  ) => {
    if (field === "clientId") {
      const client = clients.find((c) => c.id === value as string) || null;
      setSelectedClient(client);
      setFormData((prev) => ({
        ...prev,
        clientId: value as string,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleGuestChange = (
    index: number,
    field: keyof GuestForm,
    value: string | number | null
  ) => {
    setFormData((prev) => {
      const newGuests = [...prev.guests];
      newGuests[index] = { ...newGuests[index], [field]: value };
      return { ...prev, guests: newGuests };
    });
  };

  const handleAddGuest = () => {
    setFormData((prev) => {
      const currentGuestCount = prev.guests.length;
      const isPaidGuest = currentGuestCount >= INCLUDED_GUESTS - 1; // -1 porque cliente não está no array

      return {
        ...prev,
        guests: [
          ...prev.guests,
          {
            name: "",
            age: 0,
            pricingRuleId: isPaidGuest ? "" : null,
          },
        ],
      };
    });
  };

  const handleRemoveGuest = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      guests: prev.guests.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validações
    if (
      !formData.roomId ||
      !formData.clientId ||
      !formData.checkInDate ||
      !formData.checkOutDate
    ) {
      setSnackbar({
        open: true,
        message: "Preencha todos os campos obrigatórios.",
        severity: "error",
      });
      return;
    }

    if (formData.checkOutDate <= formData.checkInDate) {
      setSnackbar({
        open: true,
        message:
          "A data de check-out deve ser posterior à data de check-in.",
        severity: "error",
      });
      return;
    }

    // Validação dos hóspedes adicionais
    for (let i = 0; i < formData.guests.length; i++) {
      const guest = formData.guests[i];

      // Nome e idade são obrigatórios para todos
      if (!guest.name || guest.age <= 0) {
        setSnackbar({
          open: true,
          message: `Preencha o nome e a idade do hóspede adicional ${
            i + 1
          }.`,
          severity: "error",
        });
        return;
      }

      // Para hóspedes adicionais (a partir do 2º do array = 3º total),
      // pricingRuleId é obrigatório
      if (i >= INCLUDED_GUESTS - 1 && !guest.pricingRuleId) {
        setSnackbar({
          open: true,
          message: `Selecione uma regra de preço para o hóspede adicional ${
            i + 1
          } (hóspedes a partir do 3º total são pagos).`,
          severity: "error",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        roomId: formData.roomId,
        clientId: formData.clientId,
        checkInDate: formData.checkInDate.toISOString(),
        checkOutDate: formData.checkOutDate.toISOString(),
        guests: formData.guests.map((g) => ({
          name: g.name,
          age: g.age,
          pricingRuleId: g.pricingRuleId || null,
        })),
      };

      await apiClient.post("/api/Reservations", payload);
      setSnackbar({
        open: true,
        message: "Reserva criada com sucesso!",
        severity: "success",
      });
      onSuccess?.();
      handleClose();
    } catch (error) {
      const defaultMessage = "Erro ao criar reserva.";
      if (isAxiosError(error)) {
        const err = error as AxiosError<{ message?: string }>;
        setSnackbar({
          open: true,
          message: err.response?.data?.message || defaultMessage,
          severity: "error",
        });
      } else {
        setSnackbar({
          open: true,
          message: defaultMessage,
          severity: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Filtra pricing rules baseado na idade do hóspede
  const getAvailablePricingRules = (age: number) => {
    return pricingRules.filter(
      (rule) => age >= rule.minAge && age <= rule.maxAge
    );
  };

  // Quartos disponíveis (filtra por status se necessário)
  const availableRooms = rooms.filter(
    (room) => room.status === "Livre" || room.status === "Disponível"
  );

  // Verifica se o hóspede adicional é gratuito ou pago
  // Index 0 = 2º hóspede total (gratuito)
  // Index 1+ = 3º+ hóspede total (pago)
  const isGuestFree = (index: number) => index < INCLUDED_GUESTS - 1;

  // Contador total de hóspedes (cliente + adicionais)
  const totalGuestCount = 1 + formData.guests.length; // 1 cliente + adicionais

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        disableRestoreFocus
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}
            >
              {/* Alerta informativo sobre política de hóspedes */}
              <Alert severity="info" sx={{ mb: 1 }}>
                O cliente + 1 hóspede adicional estão incluídos no preço base.
                A partir do 3º hóspede total, é necessário selecionar uma regra
                de preço.
              </Alert>

              {/* Quarto */}
              <FormControl fullWidth required>
                <InputLabel>Quarto</InputLabel>
                <Select
                  value={formData.roomId}
                  label="Quarto"
                  onChange={(e) => handleChange("roomId", e.target.value)}
                >
                  {availableRooms.map((room) => (
                    <MenuItem key={room.id} value={room.id}>
                      Quarto {room.number} - {room.type} (Capacidade:{" "}
                      {room.capacity})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Cliente */}
              <FormControl fullWidth required>
                <InputLabel>Cliente</InputLabel>
                <Select
                  value={formData.clientId}
                  label="Cliente"
                  onChange={(e) => handleChange("clientId", e.target.value)}
                >
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.fullName} - {client.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Datas */}
              <LocalizationProvider
                dateAdapter={AdapterDateFns}
                adapterLocale={ptBR}
              >
                <Stack direction="row" spacing={2}>
                  <DatePicker
                    label="Check-in"
                    value={formData.checkInDate}
                    onChange={(date) => handleChange("checkInDate", date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                      },
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
                        required: true,
                      },
                    }}
                    minDate={formData.checkInDate || new Date()}
                  />
                </Stack>
              </LocalizationProvider>

              {/* Seção do Cliente (Hóspede Principal) */}
              {selectedClient && (
                <Paper
                  elevation={2}
                  sx={{
                    p: 2,
                    bgcolor: "#e8f5e9",
                    border: "1px solid #81c784",
                  }}
                >
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Hóspede Principal (Cliente)
                    <Chip
                      size="small"
                      label="Incluído"
                      color="success"
                      sx={{ ml: 1 }}
                    />
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

              {/* Hóspedes Adicionais */}
              <Box>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <Typography variant="h6">
                    Hóspedes Adicionais ({formData.guests.length})
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    onClick={handleAddGuest}
                    variant="outlined"
                    size="small"
                  >
                    Adicionar Hóspede
                  </Button>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  O 1º hóspede adicional é gratuito. A partir do 2º, é cobrado
                  adicional.
                </Typography>

                {formData.guests.map((guest, index) => {
                  const availableRules = getAvailablePricingRules(guest.age);
                  const isFree = isGuestFree(index);
                  const guestNumber = index + 1; // 1º, 2º, 3º...

                  return (
                    <Paper
                      key={index}
                      elevation={1}
                      sx={{
                        p: 2,
                        mb: 2,
                        bgcolor: isFree ? "#e8f5e9" : "#fff3e0",
                        border: "1px solid",
                        borderColor: isFree ? "#81c784" : "#ffb74d",
                      }}
                    >
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          Hóspede Adicional {guestNumber}
                          <Chip
                            size="small"
                            label={isFree ? "Incluído" : "Adicional"}
                            color={isFree ? "success" : "warning"}
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveGuest(index)}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack spacing={2}>
                        <TextField
                          label="Nome"
                          value={guest.name}
                          onChange={(e) =>
                            handleGuestChange(index, "name", e.target.value)
                          }
                          fullWidth
                          required
                          size="small"
                        />

                        <TextField
                          label="Idade"
                          type="number"
                          value={guest.age || ""}
                          onChange={(e) =>
                            handleGuestChange(
                              index,
                              "age",
                              parseInt(e.target.value) || 0
                            )
                          }
                          fullWidth
                          required
                          size="small"
                          inputProps={{ min: 1, max: 120 }}
                        />

                        <FormControl fullWidth size="small">
                          <InputLabel>
                            {isFree
                              ? "Regra de Pre&ccedil;o (Opcional)"
                              : "Regra de Pre&ccedil;o *"}
                          </InputLabel>
                          <Select
                            value={guest.pricingRuleId || ""}
                            label={
                              isFree
                                ? "Regra de Pre&ccedil;o (Opcional)"
                                : "Regra de Pre&ccedil;o *"
                            }
                            onChange={(e) =>
                              handleGuestChange(
                                index,
                                "pricingRuleId",
                                e.target.value || null
                              )
                            }
                            disabled={guest.age <= 0}
                            required={!isFree}
                          >
                            <MenuItem value="">
                              <em>
                                {isFree
                                  ? "Nenhuma regra de preço"
                                  : "Selecione uma regra (obrigatório)"}
                              </em>
                            </MenuItem>
                            {availableRules.length === 0 &&
                            guest.age > 0 ? (
                              <MenuItem disabled>
                                Nenhuma regra disponível para esta idade
                              </MenuItem>
                            ) : (
                              availableRules.map((rule) => (
                                <MenuItem key={rule.id} value={rule.id}>
                                  {rule.description} - R${" "}
                                  {rule.price.toFixed(2)}
                                </MenuItem>
                              ))
                            )}
                          </Select>
                          {!isFree && (
                            <Typography
                              variant="caption"
                              color="error"
                              sx={{ mt: 0.5 }}
                            >
                              * Obrigatório para hóspedes adicionais (3º+ total)
                            </Typography>
                          )}
                        </FormControl>
                      </Stack>
                    </Paper>
                  );
                })}

                {formData.guests.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textAlign="center"
                    py={2}
                  >
                    Clique em &quot;Adicionar H&oacute;spede&quot; para adicionar h&oacute;spedes
                    adicionais.
                  </Typography>
                )}
              </Box>

              {/* Resumo da Contagem */}
              <Paper elevation={0} sx={{ p: 2, bgcolor: "#f5f5f5" }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Resumo de Hóspedes
                </Typography>
                <Stack direction="row" spacing={3} justifyContent="center">
                  <Typography variant="body2">
                    <strong>Cliente:</strong> 1
                  </Typography>
                  <Typography variant="body2">
                    <strong>Hóspedes Incluídos:</strong>{" "}
                    {Math.min(formData.guests.length, INCLUDED_GUESTS - 1)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Hóspedes Adicionais:</strong>{" "}
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
          <Button
            onClick={handleClose}
            color="inherit"
            disabled={loading || loadingData}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={loading || loadingData}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Criar Reserva"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
