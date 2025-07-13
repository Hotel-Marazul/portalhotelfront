"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
} from "@mui/material";
import CustomSnackbar from "@/components/snackbar";
import apiClient from "@/service/api"; // ajuste o caminho conforme seu projeto

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await apiClient.post("/api/User/login", {
        email,
        password,
      });

      const { flag, message, token } = response.data;

      if (flag) {
        localStorage.setItem("token", token);
        setSnackbar({
          open: true,
          message: message || "Login bem-sucedido!",
          severity: "success",
        });

        // Aguarda 2 segundos para mostrar snackbar e redireciona
        setTimeout(() => router.push("/"), 2000);
      } else {
        setSnackbar({
          open: true,
          message: message || "Falha no login.",
          severity: "error",
        });
      }
    } catch (error: unknown) {
      let message = "Erro ao conectar na API.";

      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data !== null &&
        typeof error.response.data === "object" &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        message = error.response.data.message;
      }

      setSnackbar({
        open: true,
        message,
        severity: "error",
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-black">
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          className="p-8 rounded-lg shadow-lg"
          sx={{
            backgroundColor: "white",
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            align="center"
            gutterBottom
            className="font-bold text-blue-700"
          >
            Login
          </Typography>
          <Box component="form" onSubmit={handleLogin} noValidate>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="outlined"
              required
              className="mb-4"
            />
            <TextField
              label="Senha"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
              required
              className="mb-6"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              className="bg-blue-700 hover:bg-blue-800 text-white py-2 rounded transition"
              sx={{
                "&:hover": { backgroundColor: "#1c2e6d" },
              }}
            >
              Entrar
            </Button>
          </Box>
        </Paper>
      </Container>
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />
    </div>
  );
}
