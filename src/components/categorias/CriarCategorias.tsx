"use client";

import { useState } from "react";
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
import { Category } from "@/utils/models";
import { NumericFormat } from "react-number-format";
import apiClient from "@/service/api";
import CustomSnackbar from "@/components/snackbar";

interface CriarCategoriaProps {
  onCreate: (q: Category) => void;
}

export default function CriarCategoria({ onCreate }: CriarCategoriaProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Category>>({
    name: "",
    price: undefined,
  });

const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  const handleChange = (field: keyof Category, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
   
    if (!form.name?.trim() || form.price == null || form.price <= 0) {
        setSnackbar({
            open: true,
            message: "Preencha todos os campos corretamente antes de continuar.",
            severity: "warning",
        });
        return;
    }

      try {
        const res = await apiClient.post("/api/Categories/create", {
          name: form.name,
          price: form.price,
        });

        const novaCategoria = res.data;
        onCreate(novaCategoria);

        setSnackbar({ open: true, message: "Categoria criada com sucesso!", severity: "success" });

        setOpen(false);
        setForm({ name: "", price: undefined });
      } catch (err: any) {
        console.error("Erro ao criar categoria", err);

        const msg = err.response?.data?.message || "Erro ao criar categoria!";
        setSnackbar({ open: true, message: msg, severity: "error" });
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
        Adicionar Categoria
      </Button>

      {/* Modal */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <div className="flex flex-col">
            <span className="text-xl font-semibold text-gray-800">Criar Nova Categoria</span>
            <span className="text-sm text-gray-500 mt-1">
              Preencha as informações abaixo para cadastrar uma nova categoria.
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

        <DialogContent sx={{ minHeight: "170px", mt: 2 }}>
          <Box className="flex flex-col gap-4">
            {/* Número e Tipo */}
            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Nome</span>
                <TextField
                  placeholder="Ex: Standard"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
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
                    value={form.price ?? ""}
                    variant="outlined"
                    fullWidth
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
                        backgroundColor: "#f3f4f6",
                        "& fieldset": { border: "none" },
                        "&.Mui-focused": {
                            boxShadow: "0 0 0 2px rgba(107,114,128,0.3)",
                        },
                        },
                    }}
                />
              </Box>
            </Box>

          </Box>
        </DialogContent>

        <DialogActions sx={{ pb: 4, pr: 4 }}>
          <Button
            onClick={handleCreate}
            variant="contained"
            sx={{ textTransform: "none", fontWeight: "bold" }}
          >
            Criar Categoria
          </Button>
        </DialogActions>
      </Dialog>

    <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      />
    </>
  );
}
