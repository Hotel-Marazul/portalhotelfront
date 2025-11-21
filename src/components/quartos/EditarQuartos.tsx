"use client";

import { useState, useEffect } from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Box,
} from "@mui/material";
import { Room } from "@/utils/models";
import { Category } from "@/utils/models";
import apiClient from "@/services/api";
import { NumericFormat } from "react-number-format";
import CustomSnackbar from "@/components/snackbar";

interface EditarQuartosProps {
  open: boolean;
  onClose: () => void;
  quarto: Room | null;
  onSave: (q: Room) => void;
  onDelete: (id: string) => void;
}

export default function EditarQuartos({
  open,
  onClose,
  quarto,
  onSave,
  onDelete,
}: EditarQuartosProps) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<Room | null>(quarto);
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

  useEffect(() => {
    if (open && quarto) {
      setForm({ ...quarto });
    }
  }, [open, quarto]);

    const handleUpdate = async (quarto: Room) => {
      if (!quarto.type?.trim() || quarto.price == null || quarto.price <= 0 || quarto.capacity == null || quarto.capacity < 0) {
          setSnackbar({
          open: true,
          message: "Preencha todos os campos corretamente antes de continuar.",
          severity: "warning",
          });
          return;
      }

      console.log(quarto.id);

      try {
        const res = await apiClient.put(`/api/Rooms/update/${quarto.id}`, {
          roomNumber: quarto.number,
          categoryId: quarto.categoryId,
          capacity: quarto.capacity,
          status: quarto.status
        });
  
          console.log(res.data);
          const quartoAtualizado = res.data;
          onSave(quartoAtualizado);
  
          setSnackbar({
              open: true,
              message: "Quarto atualizado com sucesso!",
              severity: "success",
          });
      } catch (err: any) {
          console.error("Erro ao atualizar quarto", err);
          const msg = err.response?.data?.message || "Erro ao atualizar quarto!";
          setSnackbar({ open: true, message: msg, severity: "error" });
      }
     };
    
const handleDelete = async (id: string) => {
  try {
    console.log(id);

    const res = await apiClient.delete(`/api/Rooms/delete/${id}`);
    
    onDelete(id); // Atualiza a lista no front
    setSnackbar({
      open: true,
      message: "Quarto excluído com sucesso!",
      severity: "success",
    });

    onClose(); 
  } catch (err: any) {
    console.error("Erro ao deletar quarto", err);
    const msg = err.response?.data?.message || "Erro ao deletar quarto!";
    setSnackbar({ open: true, message: msg, severity: "error" });
  }
};

  const handleChange = (field: keyof Room, value: any) => {
    if (form) setForm({ ...form, [field]: value });
  };

  const handleSave = async () => {
    if (form) {
        await handleUpdate(form); 
        onClose(); 
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <div className="flex flex-col">
            <span className="text-xl font-semibold text-gray-800">Gerenciar Quarto</span>
            <span className="text-sm text-gray-500 mt-1">
                Edite as informações ou exclua o quarto permanentemente.
            </span>
        </div>
      </DialogTitle>

        <IconButton
        onClick={onClose}
        sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
        }}
        >
        <CloseIcon />
        </IconButton>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
        <Tab label="Editar" />
        <Tab label="Deletar" />
      </Tabs>

      <DialogContent sx={{ minHeight: "260px", mt: 2 }}>
        {tab === 0 && form && (
          <Box className="flex flex-col gap-4">
            {/* Linha 1 - Número e Tipo */}
            <Box className="flex gap-4 w-full">
              {/* Número */}
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Número</span>
                <TextField
                  type="text"
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

              {/* Tipo */}
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Tipo</span>
                <Select
                  type="number"
                  value={form.type}
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
                  {categories.map(c => (
                    <MenuItem key={c.id} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>

              </Box>
            </Box>

            {/* Linha 2 - Capacidade e Preço */}
            <Box className="flex gap-4 w-full">
              {/* Capacidade */}
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Capacidade</span>
                <TextField
                  type="number"
                  value={form.capacity}
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

              {/* Preço */}
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

            {/* Linha 3 - Status (ocupa toda largura) */}
            <Box className="flex flex-col gap-1 w-full">
              <span className="font-semibold text-gray-700">Status</span>
              <Select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
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
                <MenuItem value="Livre">Livre</MenuItem>
                <MenuItem value="Ocupado">Ocupado</MenuItem>
                <MenuItem value="Manutenção">Manutenção</MenuItem>
              </Select>
            </Box>
          </Box>
        )}

        {tab === 1 && form && (
          <Box className="flex flex-col gap-4 justify-center items-center text-center h-full">
            <p>
              Tem certeza que deseja deletar o quarto <b>{form.number}</b>?
              Essa mudança é irreversível, e irá deletar todas as reservas associadas a esse quarto
            </p>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleDelete(form.id)}
            >
              Deletar
            </Button>
          </Box>
        )}
      </DialogContent>

      {tab === 0 && (
        <DialogActions sx={{ pb: 4, pr: 4 }}>
          <Button onClick={handleSave} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      )}

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      />
    </Dialog>
  );
}
