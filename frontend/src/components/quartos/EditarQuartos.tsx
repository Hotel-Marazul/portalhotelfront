"use client";

import { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField
} from "@mui/material";
import { isAxiosError } from "axios";
import apiClient from "../../services/api";
import { Category, Room } from "../../utils/models";
import CustomSnackbar from "../snackbar";
import {
  normalizeOperationalRoomStatus,
  roomStatusLabel,
  toApiRoomStatus
} from "../../utils/roomStatus";

interface EditarQuartosProps {
  open: boolean;
  onClose: () => void;
  quarto: Room | null;
  onSave: (room: Room) => void;
  onDelete: (id: string) => void;
}

export default function EditarQuartos({
  open,
  onClose,
  quarto,
  onSave,
  onDelete
}: EditarQuartosProps) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<Room | null>(quarto);
  const [categories, setCategories] = useState<Category[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning"
  });

  useEffect(() => {
    let mounted = true;

    async function fetchCategories() {
      try {
        const response = await apiClient.get<Category[]>("/api/categories");
        if (mounted) setCategories(response.data);
      } catch (error) {
        if (mounted) {
          setSnackbar({
            open: true,
            message: "Erro ao carregar categorias.",
            severity: "error"
          });
        }
        console.error("Erro ao carregar categorias", error);
      }
    }

    void fetchCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (open && quarto) {
      setForm({
        ...quarto,
        status: normalizeOperationalRoomStatus(quarto.status)
      });
    }
  }, [open, quarto]);

  const handleChange = <K extends keyof Room>(field: K, value: Room[K] | undefined) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
  };

  async function handleUpdate(updatedRoom: Room): Promise<boolean> {
    if (
      !updatedRoom.type?.trim() ||
      updatedRoom.price == null ||
      updatedRoom.price <= 0 ||
      updatedRoom.capacity == null ||
      updatedRoom.capacity < 0
    ) {
      setSnackbar({
        open: true,
        message: "Preencha todos os campos corretamente antes de continuar.",
        severity: "warning"
      });
      return false;
    }

    try {
      const normalizedStatus = normalizeOperationalRoomStatus(updatedRoom.status);
      const response = await apiClient.put<Room>(`/api/Rooms/update/${updatedRoom.id}`, {
        roomNumber: updatedRoom.number,
        categoryId: updatedRoom.categoryId,
        capacity: updatedRoom.capacity,
        status: toApiRoomStatus(normalizedStatus)
      });

      onSave(response.data);
      setSnackbar({
        open: true,
        message: "Quarto atualizado com sucesso!",
        severity: "success"
      });
      return true;
    } catch (error) {
      const message = isAxiosError(error)
        ? (error.response?.data?.message ?? "Erro ao atualizar quarto!")
        : "Erro ao atualizar quarto!";
      setSnackbar({ open: true, message, severity: "error" });
      return false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/api/Rooms/delete/${id}`);
      onDelete(id);
      setSnackbar({
        open: true,
        message: "Quarto excluido com sucesso!",
        severity: "success"
      });
      onClose();
    } catch (error) {
      const message = isAxiosError(error)
        ? (error.response?.data?.message ?? "Erro ao deletar quarto!")
        : "Erro ao deletar quarto!";
      setSnackbar({ open: true, message, severity: "error" });
    }
  }

  async function handleSave() {
    if (!form) return;
    const saved = await handleUpdate(form);
    if (saved) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <div className="flex flex-col">
          <span className="text-xl font-semibold text-gray-800">Gerenciar Quarto</span>
          <span className="text-sm text-gray-500 mt-1">
            Edite as informacoes ou exclua o quarto permanentemente.
          </span>
        </div>
      </DialogTitle>

      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500]
        }}
      >
        <CloseIcon />
      </IconButton>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} centered>
        <Tab label="Editar" />
        <Tab label="Deletar" />
      </Tabs>

      <DialogContent sx={{ minHeight: "260px", mt: 2 }}>
        {tab === 0 && form && (
          <Box className="flex flex-col gap-4">
            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Numero</span>
                <TextField
                  type="text"
                  value={form.number}
                  onChange={(event) => {
                    const value = Number(event.target.value.replace(/\D/g, ""));
                    handleChange("number", Number.isNaN(value) ? 0 : value);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.5rem",
                      backgroundColor: "#f3f4f6",
                      "& fieldset": { border: "none" },
                      "&.Mui-focused": {
                        boxShadow: "0 0 0 2px rgba(107,114,128,0.3)"
                      }
                    }
                  }}
                />
              </Box>

              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Tipo</span>
                <Select
                  value={form.type}
                  onChange={(event) => {
                    const selectedCategory = categories.find(
                      (category) => category.name === event.target.value
                    );
                    if (!selectedCategory) return;

                    setForm({
                      ...form,
                      type: selectedCategory.name,
                      price: selectedCategory.price,
                      categoryId: selectedCategory.id
                    });
                  }}
                  fullWidth
                  sx={{
                    height: "55px",
                    borderRadius: "0.5rem",
                    backgroundColor: "#f3f4f6",
                    "& fieldset": { border: "none" },
                    "&.Mui-focused": {
                      boxShadow: "0 0 0 2px rgba(107,114,128,0.3)"
                    }
                  }}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.name}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Capacidade</span>
                <TextField
                  type="number"
                  value={form.capacity}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    handleChange("capacity", value < 0 || Number.isNaN(value) ? 0 : value);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.5rem",
                      backgroundColor: "#f3f4f6",
                      "& fieldset": { border: "none" },
                      "&.Mui-focused": {
                        boxShadow: "0 0 0 2px rgba(107,114,128,0.3)"
                      }
                    }
                  }}
                />
              </Box>

              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Preco</span>
                <TextField
                  value={form.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  variant="outlined"
                  fullWidth
                  disabled
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.5rem",
                      backgroundColor: "#e5e7eb",
                      "& fieldset": { border: "none" },
                      "&.Mui-focused": {
                        boxShadow: "0 0 0 2px rgba(107,114,128,0.3)"
                      }
                    }
                  }}
                />
              </Box>
            </Box>

            <Box className="flex flex-col gap-1 w-full">
              <span className="font-semibold text-gray-700">Status operacional</span>
              <Select
                value={normalizeOperationalRoomStatus(form.status)}
                onChange={(event) => handleChange("status", event.target.value)}
                fullWidth
                sx={{
                  height: "40px",
                  borderRadius: "0.5rem",
                  backgroundColor: "#f3f4f6",
                  "& fieldset": { border: "none" },
                  "&.Mui-focused": {
                    boxShadow: "0 0 0 2px rgba(107,114,128,0.3)"
                  }
                }}
              >
                <MenuItem value="Disponivel">{roomStatusLabel("Disponivel")}</MenuItem>
                <MenuItem value="Manutencao">{roomStatusLabel("Manutencao")}</MenuItem>
              </Select>
            </Box>
          </Box>
        )}

        {tab === 1 && form && (
          <Box className="flex flex-col gap-4 justify-center items-center text-center h-full">
            <p>
              Tem certeza que deseja deletar o quarto <b>{form.number}</b>? Essa mudanca e irreversivel.
            </p>
            <Button variant="contained" color="error" onClick={() => void handleDelete(form.id)}>
              Deletar
            </Button>
          </Box>
        )}
      </DialogContent>

      {tab === 0 && (
        <DialogActions sx={{ pb: 4, pr: 4 }}>
          <Button onClick={() => void handleSave()} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      )}

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      />
    </Dialog>
  );
}
