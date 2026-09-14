"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
} from "@mui/material";
import apiClient from "../../services/api";
import { AxiosError, isAxiosError } from "axios";
import CustomSnackbar from "../snackbar";

interface ModalAdicionarHospedeProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode: "adicionar" | "editar" | "excluir";
  hospedeId?: string;
}

interface HospedeFormData {
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
}

export default function ModaAdicionarlHospede({
  open,
  onClose,
  onSuccess,
  mode,
  hospedeId,
}: ModalAdicionarHospedeProps) {
  const [formData, setFormData] = useState<HospedeFormData>({
    fullName: "",
    cpf: "",
    email: "",
    fone: "",
    automovel: "",
    placa: "",
  });

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  // 🔹 Formatar CPF/CNPJ visualmente
  const formatarDocumento = (valor: string): string => {
    const numeros = valor.replace(/\D/g, "");
    if (numeros.length <= 11) {
      return numeros
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2")
        .slice(0, 14);
    } else {
      return numeros
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .slice(0, 18);
    }
  };

  // 🔹 Remove foco antes de fechar
  const handleClose = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "cpf") {
      const numeros = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, cpf: numeros }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // 🟢 SEÇÃO NOVA: Carregar dados ao editar
  useEffect(() => {
    const carregarHospede = async () => {
      if (mode === "editar" && hospedeId) {
        try {
          setLoading(true);
          const response = await apiClient.get(`/api/client/${hospedeId}`);
          const data = response.data;

          setFormData({
            fullName: data.fullName || "",
            cpf: data.cpf || "",
            email: data.email || "",
            fone: data.fone || "",
            automovel: data.automovel || "",
            placa: data.placa || "",
          });
        } catch {
          setSnackbar({
            open: true,
            message: "Erro ao carregar dados do hóspede.",
            severity: "error",
          });
        } finally {
          setLoading(false);
        }
      } else if (mode === "adicionar") {
        // limpa o form quando abrir para novo hóspede
        setFormData({
          fullName: "",
          cpf: "",
          email: "",
          fone: "",
          automovel: "",
          placa: "",
        });
      }
    };

    if (open) carregarHospede();
  }, [open, mode, hospedeId]);

  // 🔹 Envio (criar ou editar)
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      if (mode === "editar" && hospedeId) {
        await apiClient.put(`/api/client/${hospedeId}`, {
          ...formData,
          ...(formData.cpf.includes("*") ? {} : { cpf: formData.cpf.replace(/\D/g, "") }),
        });
        setSnackbar({
          open: true,
          message: "Hóspede atualizado com sucesso!",
          severity: "success",
        });
      } else {
        await apiClient.post("/api/client/create", {
          ...formData,
          cpf: formData.cpf.replace(/\D/g, ""),
        });
        setSnackbar({
          open: true,
          message: "Hóspede cadastrado com sucesso!",
          severity: "success",
        });
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      const defaultMessage = "Erro ao salvar hóspede.";
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

  const titulo =
    mode === "editar"
      ? "Editar Hóspede"
      : mode === "excluir"
      ? "Excluir Hóspede"
      : "Adicionar Hóspede";

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" disableRestoreFocus>
        <DialogTitle sx={{ fontWeight: "bold" }}>{titulo}</DialogTitle>

        <DialogContent>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
          >
            <TextField
              label="Nome Completo"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              fullWidth
              required
            />

            <TextField
              label="Documento (CPF/CNPJ)"
              name="cpf"
              value={formatarDocumento(formData.cpf)}
              onChange={handleChange}
              fullWidth
              required
            />

            <TextField
              label="Telefone"
              name="fone"
              value={formData.fone}
              onChange={handleChange}
              fullWidth
              required
            />

            <TextField
              label="E-mail"
              name="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
            />

            <TextField
              label="Automóvel"
              name="automovel"
              value={formData.automovel}
              onChange={handleChange}
              fullWidth
            />

            <TextField
              label="Placa"
              name="placa"
              value={formData.placa}
              onChange={handleChange}
              fullWidth
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : mode === "editar" ? (
              "Salvar Alterações"
            ) : (
              "Adicionar Hóspede"
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
