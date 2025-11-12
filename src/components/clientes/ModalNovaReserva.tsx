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
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { Close, Add, Delete } from "@mui/icons-material";
import apiClient from "@/service/api";
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
  isClient?: boolean; // Indica se é o cliente selecionado
}

interface ReservationFormData {
  roomId: string;
  clientId: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guests: GuestForm[];
}

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
          // Se o endpoint não existir, tenta alternativas
          return apiClient.get<PricingRule[]>("/api/pricing-rules").catch(() => {
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
    onClose();
  }, [onClose]);

  const handleChange = (field: keyof ReservationFormData, value: any) => {
    if (field === "clientId") {
      setFormData((prev) => {
        const newData = { ...prev, [field]: value };
        
        // Quando o cliente é selecionado, adiciona ele como primeiro hóspede
        if (value) {
          const selectedClient = clients.find(c => c.id === value);
          if (selectedClient) {
            // Remove o hóspede do cliente anterior se existir
            const guestsWithoutClient = newData.guests.filter(g => !g.isClient);
            // Adiciona o novo cliente como primeiro hóspede
            newData.guests = [
              {
                name: selectedClient.fullName,
                age: 0,
                pricingRuleId: null,
                isClient: true,
              },
              ...guestsWithoutClient,
            ];
          }
        } else {
          // Se o cliente for removido, remove o hóspede do cliente
          newData.guests = newData.guests.filter(g => !g.isClient);
        }
        
        return newData;
      });
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleGuestChange = (index: number, field: keyof GuestForm, value: any) => {
    setFormData((prev) => {
      const newGuests = [...prev.guests];
      newGuests[index] = { ...newGuests[index], [field]: value };
      return { ...prev, guests: newGuests };
    });
  };

  const handleAddGuest = () => {
    setFormData((prev) => ({
      ...prev,
      guests: [
        ...prev.guests,
        { name: "", age: 0, pricingRuleId: null, isClient: false },
      ],
    }));
  };

  const handleRemoveGuest = (index: number) => {
    setFormData((prev) => {
      const guest = prev.guests[index];
      // Não permite remover o hóspede que é o cliente
      if (guest.isClient) {
        return prev;
      }
      return {
        ...prev,
        guests: prev.guests.filter((_, i) => i !== index),
      };
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validações
    if (!formData.roomId || !formData.clientId || !formData.checkInDate || !formData.checkOutDate) {
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
        message: "A data de check-out deve ser posterior à data de check-in.",
        severity: "error",
      });
      return;
    }

    // Validação do cliente
    if (!formData.clientId) {
      setSnackbar({
        open: true,
        message: "Selecione um cliente.",
        severity: "error",
      });
      return;
    }

    // Validação dos hóspedes
    if (formData.guests.length === 0) {
      setSnackbar({
        open: true,
        message: "Adicione pelo menos um hóspede.",
        severity: "error",
      });
      return;
    }

    // Valida cada hóspede
    for (let i = 0; i < formData.guests.length; i++) {
      const guest = formData.guests[i];
      if (!guest.name || guest.age <= 0) {
        setSnackbar({
          open: true,
          message: `Preencha o nome e a idade do hóspede ${i + 1}.`,
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
          pricingRuleId: g.pricingRuleId || null, // Pode ser null se não selecionar regra
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
  const availableRooms = rooms.filter((room) => room.status === "Livre" || room.status === "Disponível");

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                      Quarto {room.number} - {room.type} (Capacidade: {room.capacity})
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
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
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

              {/* Hóspedes */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Hóspedes</Typography>
                  <Button
                    startIcon={<Add />}
                    onClick={handleAddGuest}
                    variant="outlined"
                    size="small"
                  >
                    Adicionar Hóspede
                  </Button>
                </Box>

                {formData.guests.map((guest, index) => {
                  const availableRules = getAvailablePricingRules(guest.age);
                  return (
                    <Paper
                      key={index}
                      elevation={1}
                      sx={{ p: 2, mb: 2, bgcolor: "#f9fafb" }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {guest.isClient ? "Cliente (Hóspede Principal)" : `Hóspede ${index + 1}`}
                        </Typography>
                        {!guest.isClient && (
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
                          onChange={(e) =>
                            handleGuestChange(index, "name", e.target.value)
                          }
                          disabled={guest.isClient}
                          fullWidth
                          required
                          size="small"
                          helperText={guest.isClient ? "Nome do cliente selecionado" : ""}
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
                          inputProps={{ min: 0, max: 120 }}
                        />

                        <FormControl fullWidth size="small">
                          <InputLabel>Regra de Preço (Opcional)</InputLabel>
                          <Select
                            value={guest.pricingRuleId || ""}
                            label="Regra de Preço (Opcional)"
                            onChange={(e) =>
                              handleGuestChange(index, "pricingRuleId", e.target.value || null)
                            }
                            disabled={guest.age <= 0}
                          >
                            <MenuItem value="">
                              <em>Nenhuma regra de preço</em>
                            </MenuItem>
                            {availableRules.length === 0 && guest.age > 0 ? (
                              <MenuItem disabled>
                                Nenhuma regra disponível para esta idade
                              </MenuItem>
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
                    Selecione um cliente para adicioná-lo como hóspede, ou clique em "Adicionar Hóspede" para adicionar outros hóspedes.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={loading || loadingData}>
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

