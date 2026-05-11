"use client";

import { useEffect, useState } from "react";
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
  TextField
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { isAxiosError } from "axios";
import apiClient from "../../services/api";
import { Category, Room } from "../../utils/models";
import CustomSnackbar from "../snackbar";
import { OperationalRoomStatus, roomStatusLabel, toApiRoomStatus } from "../../utils/roomStatus";

interface CriarQuartoProps {
  onCreate: (room: Room) => void;
}

interface RoomFormState {
  number: number;
  type: string;
  capacity: number;
  price: number;
  categoryId?: string;
  status: OperationalRoomStatus;
}

const INITIAL_FORM: RoomFormState = {
  number: 0,
  type: "",
  capacity: 0,
  price: 0,
  categoryId: undefined,
  status: "Disponivel"
};

export default function CriarQuarto({ onCreate }: CriarQuartoProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RoomFormState>(INITIAL_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning"
  });

  useEffect(() => {
    async function fetchCategories() {
      const response = await apiClient.get("/api/categories");
      setCategories(response.data);
    }

    void fetchCategories();
  }, []);

  const handleChange = <K extends keyof RoomFormState>(field: K, value: RoomFormState[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleCreate = async () => {
    if (!form.number || !form.type || !form.capacity || !form.price || !form.categoryId) {
      setSnackbar({
        open: true,
        message: "Preencha todos os campos antes de continuar.",
        severity: "warning"
      });
      return;
    }

    try {
      const response = await apiClient.post("/api/Rooms", {
        roomNumber: form.number,
        categoryId: form.categoryId,
        capacity: form.capacity,
        status: toApiRoomStatus(form.status)
      });

      onCreate(response.data);
      setSnackbar({
        open: true,
        message: "Quarto criado com sucesso!",
        severity: "success"
      });

      setOpen(false);
      setForm(INITIAL_FORM);
    } catch (error) {
      setSnackbar({
        open: true,
        message: isAxiosError(error)
          ? (error.response?.data?.message ?? "Erro ao criar quarto.")
          : "Erro ao criar quarto.",
        severity: "error"
      });
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={() => setOpen(true)}
        sx={{
          borderRadius: "0.75rem",
          textTransform: "none",
          fontWeight: "bold",
          px: 3,
          py: 1.2
        }}
      >
        Adicionar Quarto
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <div className="flex flex-col">
            <span className="text-xl font-semibold text-gray-800">Criar Novo Quarto</span>
            <span className="text-sm text-gray-500 mt-1">
              Preencha as informacoes abaixo para cadastrar um novo quarto.
            </span>
          </div>
          <IconButton
            onClick={() => setOpen(false)}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500]
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ minHeight: "260px", mt: 2 }}>
          <Box className="flex flex-col gap-4">
            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Numero</span>
                <TextField
                  type="text"
                  placeholder="Ex: 101"
                  value={form.number}
                  onChange={(event) => {
                    const value = Number(event.target.value);
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
                  displayEmpty
                  value={form.type}
                  onChange={(event) => {
                    const selectedCategory = categories.find((category) => category.name === event.target.value);
                    if (!selectedCategory) return;

                    setForm((previous) => ({
                      ...previous,
                      type: selectedCategory.name,
                      price: selectedCategory.price,
                      categoryId: selectedCategory.id
                    }));
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
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        borderRadius: "0.5rem",
                        mt: 1,
                        "& .MuiMenuItem-root": {
                          borderRadius: "0.5rem",
                          mx: 1,
                          my: 0.5
                        },
                        "& .Mui-selected": {
                          fontWeight: "bold",
                          backgroundColor: "#f3f3f5"
                        }
                      }
                    }
                  }}
                >
                  <MenuItem value="" disabled>
                    <em>Selecione uma categoria</em>
                  </MenuItem>
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
                    handleChange("capacity", Number.isNaN(value) ? 0 : value);
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
                  value={
                    typeof form.price === "number"
                      ? form.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : ""
                  }
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
                value={form.status}
                onChange={(event) => handleChange("status", event.target.value as OperationalRoomStatus)}
                displayEmpty
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
        </DialogContent>

        <DialogActions sx={{ pb: 4, pr: 4 }}>
          <Button onClick={handleCreate} variant="contained" sx={{ textTransform: "none", fontWeight: "bold" }}>
            Criar Quarto
          </Button>
        </DialogActions>

        <CustomSnackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
        />
      </Dialog>
    </>
  );
}
