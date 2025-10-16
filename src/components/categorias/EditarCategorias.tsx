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
  IconButton,
  Box,
} from "@mui/material";
import { Category } from "@/utils/models";
import apiClient from "@/service/api";
import { NumericFormat } from "react-number-format";
import CustomSnackbar from "@/components/snackbar";

interface EditarCategoriasProps {
  open: boolean;
  onClose: () => void;
  categoria: Category | null;
  onSave: (q: Category) => void;
  onDelete: (id: string) => void;
}

export default function EditarCategorias({
  open,
  onClose,
  categoria,
  onSave,
  onDelete,
}: EditarCategoriasProps) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<Category | null>(categoria);

  useEffect(() => {
    setForm(categoria);
  }, [categoria]);

  const [snackbar, setSnackbar] = useState({
      open: false,
      message: "",
      severity: "success" as "success" | "error" | "info" | "warning",
    });

   const handleUpdate = async (categoria: Category) => {
    if (!categoria.name?.trim() || categoria.price == null || categoria.price <= 0) {
        setSnackbar({
        open: true,
        message: "Preencha todos os campos corretamente antes de continuar.",
        severity: "warning",
        });
        return;
    }

    try {
        const res = await apiClient.put(`/api/Categories/update/${categoria.id}`, {
        name: categoria.name,
        price: categoria.price,
        });

        const categoriaAtualizada = res.data;
        onSave(categoriaAtualizada);

        setSnackbar({
            open: true,
            message: "Categoria atualizada com sucesso!",
            severity: "success",
        });
    } catch (err: any) {
        console.error("Erro ao atualizar categoria", err);
        const msg = err.response?.data?.message || "Erro ao atualizar categoria!";
        setSnackbar({ open: true, message: msg, severity: "error" });
    }
   };

   const handleDelete = async (id: string) => {
    try {
        const res = await apiClient.delete(`/api/Categories/delete/${id}`);

        onDelete(id); //atualiza a lista no front
        setSnackbar({
            open: true,
            message: "Categoria excluída com sucesso!",
            severity: "success",
        });

        onClose(); 
    } catch (err: any) {
        console.error("Erro ao deletar categoria", err);
        const msg = err.response?.data?.message || "Erro ao deletar categoria!";
        setSnackbar({ open: true, message: msg, severity: "error" });
    }
    };

  
  const handleChange = (field: keyof Category, value: any) => {
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
            <span className="text-xl font-semibold text-gray-800">Gerenciar Categoria</span>
            <span className="text-sm text-gray-500 mt-1">
                Edite as informações ou exclua a categoria permanentemente.
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

      <DialogContent sx={{ minHeight: "170px", mt: 2 }}>
        {tab === 0 && form && (
          <Box className="flex flex-col gap-4">
            <Box className="flex gap-4 w-full">
              <Box className="flex flex-col gap-1 flex-1">
                <span className="font-semibold text-gray-700">Número</span>
                <TextField
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
        )}

        {tab === 1 && form && (
          <Box className="flex flex-col gap-4 justify-center items-center text-center h-full">
            <p>
              Tem certeza que deseja deletar a categoria <b>{form.name}</b>?
              Essa mudança é irreversível, e irá deletar todas os quartos associados a essa categoria e suas reservas.
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
