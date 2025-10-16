"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Box,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { Room } from "@/utils/models";
import { Category } from "@/utils/models";
import apiClient from "@/service/api";
import { NumericFormat } from "react-number-format";
import CustomSnackbar from "@/components/snackbar";

interface CriarQuartoProps {
  onCreate: (q: Room) => void;
}

export default function CriarQuarto({ onCreate }: CriarQuartoProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Room>>({
    number: "",
    type: "",
    capacity: undefined,
    price: undefined,
    status: "",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success" as "success" | "error" | "info" | "warning",
      });

  useEffect(() => {
    async function fetchCategories() {
      const response = await apiClient.get("/api/categories");
      setCategories(response.data);
    }
    fetchCategories();
  }, []);

  const handleChange = (field: keyof Room, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    // Validação básica
    if (!form.number || !form.type || !form.capacity || !form.price || !form.categoryId || !form.status) {
      setSnackbar({
        open: true,
        message: "Preencha todos os campos antes de continuar.",
        severity: "warning",
      });
      return;
    }

    try {

      console.log(form.status);

      const response = await apiClient.post("/api/Rooms", {
        roomNumber: form.number,
        categoryId: form.categoryId,
        capacity: form.capacity,
        status: form.status
      });

      onCreate(response.data);
      setSnackbar({
        open: true,
        message: "Quarto criado com sucesso!",
        severity: "success",
      });

      setOpen(false);
      setForm({
        number: "",
        type: "",
        capacity: undefined,
        price: undefined,
        status: "",
      });
    } catch (error) {
      console.error("Erro ao criar quarto", error);
      setSnackbar({
        open: true,
        message: "Erro ao criar quarto.",
        severity: "error",
      });
    }
  };

  return (
    <>
      {/* Botão principal */}
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
          py: 1.2,
        }}
      >
        Adicionar Quarto
      </Button>

      {/* Modal */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <div className="flex flex-col">
            <span className="text-xl font-semibold text-gray-800">Criar Novo Quarto</span>
            <span className="text-sm text-gray-500 mt-1">
              Preencha as informações abaixo para cadastrar um novo quarto.
            </span>
          </div>
          <IconButton
            onClick={() => setOpen(false)}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ minHeight: "260px", mt: 2 }}>
          <Box className="flex flex-col gap-4">
            {/* Número e Tipo */}
            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Número</span>
                <TextField
                  type="text"
                  placeholder="Ex: 101"
                  value={form.number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ""); // remove tudo que não for dígito
                    handleChange("number", value);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.5rem",
                      backgroundColor: "#f3f4f6",
                      "& fieldset": { border: "none" },
                      "&.Mui-focused": {
                        boxShadow: "0 0 0 2px rgba(107,114,128,0.3)",
                      },
                    },
                  }}
                />
              </Box>

              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Tipo</span>
                <Select
                  displayEmpty
                  value={form?.type || ""}
                  onChange={(e) => {
                    const selectedCategory = categories.find(c => c.name === e.target.value);
                    if (form && selectedCategory) {
                      setForm({
                        ...form,
                        type: selectedCategory.name,
                        price: selectedCategory.price,
                        categoryId: selectedCategory.id
                      });
                    }
                  }}
                  fullWidth
                  sx={{
                    height: "55px",
                    borderRadius: "0.5rem",
                    backgroundColor: "#f3f4f6",
                    "& fieldset": { border: "none" },
                    "&.Mui-focused": {
                      boxShadow: "0 0 0 2px rgba(107,114,128,0.3)",
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        borderRadius: "0.5rem",
                        mt: 1,
                        "& .MuiMenuItem-root": {
                          borderRadius: "0.5rem",
                          mx: 1,
                          my: 0.5,
                          position: "relative",
                        },
                        "& .Mui-selected": {
                          fontWeight: "bold",
                          backgroundColor: "#f3f3f5",
                          position: "relative",
                          "&::after": {
                            content: "'✔'",
                            position: "absolute",
                            right: "8px",
                            top: "50%",
                            transform: "translateY(-50%)",
                          },
                        },
                        "& .MuiMenuItem-root:hover": {
                          backgroundColor: "#e5e7eb",
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="" disabled>
                    <em>Selecione uma categoria</em>
                  </MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            {/* Capacidade e Preço */}
            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Capacidade</span>
                <TextField
                  type="number"
                  value={form.capacity ?? 0}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    handleChange("capacity", value < 0 ? 0 : value);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "0.5rem",
                      backgroundColor: "#f3f4f6",
                      "& fieldset": { border: "none" },
                      "&.Mui-focused": {
                        boxShadow: "0 0 0 2px rgba(107,114,128,0.3)",
                      },
                    },
                  }}
                />
              </Box>

              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Preço</span>
                <TextField
                    placeholder="Ex: R$ 250,00"
                    value={form?.price ?? ""}
                    variant="outlined"
                    fullWidth
                    disabled
                    slotProps={{
                      input: {
                        inputComponent: NumericFormat as any,
                        inputProps: {
                          thousandSeparator: ".",
                          decimalSeparator: ",",
                          prefix: "R$ ",
                          decimalScale: 2,
                          fixedDecimalScale: true,
                          allowNegative: false,
                          onValueChange: (values: any) => {
                            handleChange("price", values.floatValue);
                          },
                        },
                      },
                    }}
                    InputLabelProps={{ shrink: false }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "0.5rem",
                        backgroundColor: "#e5e7eb", 
                        "& fieldset": { border: "none" },
                        "&.Mui-focused": {
                          boxShadow: "0 0 0 2px rgba(107,114,128,0.3)",
                        },
                      },
                    }}
                  />
              </Box>
            </Box>

            {/* Status */}
            <Box className="flex flex-col gap-1 w-full">
              <span className="font-semibold text-gray-700">Status</span>
              <Select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                displayEmpty
                fullWidth
                sx={{
                  height: "40px",
                  borderRadius: "0.5rem",
                  backgroundColor: "#f3f4f6",
                  "& fieldset": { border: "none" },
                  "&.Mui-focused": {
                    boxShadow: "0 0 0 2px rgba(107,114,128,0.3)",
                  },
                }}
                MenuProps={{
                    PaperProps: {
                      sx: {
                        borderRadius: "0.5rem",
                        mt: 1,
                        "& .MuiMenuItem-root": {
                          borderRadius: "0.5rem",
                          mx: 1,
                          my: 0.5,
                        },
                        "& .Mui-selected": {
                          fontWeight: "bold",
                          backgroundColor: "#f3f3f5",
                          "&::after": {
                            content: "'✔'",
                            position: "absolute",
                            right: "8px",
                          },
                        },
                        "& .MuiMenuItem-root:hover": {
                          backgroundColor: "#e5e7eb",
                        },
                      },
                    },
                  }}
            >
                <MenuItem disabled value="">
                    <em>Selecione o tipo</em>
                </MenuItem>
                <MenuItem value="Livre">Livre</MenuItem>
                <MenuItem value="Ocupado">Ocupado</MenuItem>
                <MenuItem value="Manutenção">Manutenção</MenuItem>
              </Select>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ pb: 4, pr: 4 }}>
          <Button
            onClick={handleCreate}
            variant="contained"
            sx={{ textTransform: "none", fontWeight: "bold" }}
          >
            Criar Quarto
          </Button>
        </DialogActions>

        <CustomSnackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        />
      </Dialog>
    </>
  );
}
