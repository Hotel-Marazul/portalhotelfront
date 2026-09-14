"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { Button, TextField } from "@mui/material";
import HotelLogo from "../../components/layout/HotelLogo";
import CustomSnackbar from "../../components/snackbar";
import apiClient from "../../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post("/api/User/login", { email, password });
      const { flag, message } = response.data;

      if (flag) {
        setSnackbar({ open: true, message: message || "Login bem-sucedido!", severity: "success" });
        setTimeout(() => router.replace("/dashboard"), 600);
      } else {
        setSnackbar({ open: true, message: message || "Falha no login.", severity: "error" });
      }
    } catch (error) {
      let message = "Erro ao conectar na API.";
      if (isAxiosError(error)) {
        const m = error.response?.data?.message;
        if (typeof m === "string") message = m;
      }
      setSnackbar({ open: true, message, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand"><HotelLogo /></div>
        <h1>Bem-vindo de volta</h1>
        <p>Entre para acompanhar a operação do hotel.</p>
        <form onSubmit={(e) => void handleLogin(e)} aria-busy={loading}>
          <TextField slotProps={{ inputLabel: { shrink: true } }} id="email" label="E-mail" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required fullWidth />
          <TextField slotProps={{ inputLabel: { shrink: true } }} id="password" label="Senha" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required fullWidth />
          <Button type="submit" variant="contained" disableElevation disabled={loading} fullWidth>{loading ? "Entrando…" : "Entrar"}</Button>
        </form>
        <div className="login-footer">Acesso à equipe do hotel</div>
      </div>
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}
