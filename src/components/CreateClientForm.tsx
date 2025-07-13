"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
} from "@mui/material";
import apiClient from "../service/api"; // ✅ caminho corrigido
import CustomSnackbar from "@/components/snackbar";

interface ClientFormData {
  fullName: string;
  cpf: string;
  fone: string;
}

export default function CreateClientForm() {
  const [formData, setFormData] = useState<ClientFormData>({
    fullName: "",
    cpf: "",
    fone: "",
  });

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/api/Client/create", formData); // ✅ remove response
      setSnackbar({
        open: true,
        message: "Cliente cadastrado com sucesso!",
        severity: "success",
      });
      setFormData({ fullName: "", cpf: "", fone: "" });
    } catch (error: unknown) {
      const err = error as any;
      setSnackbar({
        open: true,
        message: err?.response?.data?.message || "Erro ao cadastrar cliente.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" mb={3}>
          Novo Cliente
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Nome Completo"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="CPF"
            name="cpf"
            value={formData.cpf}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="Telefone"
            name="fone"
            value={formData.fone}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </Box>
      </Paper>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />
    </Container>
  );
}
