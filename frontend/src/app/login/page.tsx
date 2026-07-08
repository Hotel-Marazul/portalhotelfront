"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { FiMail, FiLock, FiLogIn } from "react-icons/fi";
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--sidebar-bg)",
        backgroundImage:
          "radial-gradient(circle at 25% 25%, rgba(245,158,11,0.06) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(14,165,233,0.04) 0%, transparent 50%)",
      }}
    >
      {/* Left panel — brand */}
      <div
        style={{
          flex: "0 0 420px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 52px",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.85rem",
              letterSpacing: "0.02em",
            }}
          >
            PH
          </div>
          <span
            style={{
              color: "#f1f5f9",
              fontWeight: 600,
              fontSize: "0.95rem",
              letterSpacing: "-0.01em",
            }}
          >
            Portal Hotel
          </span>
        </div>

        {/* Main headline */}
        <div>
          <div
            style={{
              color: "var(--accent)",
              fontSize: "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Gestão Hoteleira
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3.2rem",
              fontWeight: 400,
              color: "#f1f5f9",
              margin: 0,
              lineHeight: 1.1,
              marginBottom: "16px",
            }}
          >
            Bem-vindo
            <br />
            ao painel
            <br />
            administrativo
          </h1>
          <p
            style={{
              color: "var(--sidebar-text)",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Gerencie reservas, quartos e hóspedes em um único lugar.
          </p>
        </div>

        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--sidebar-text)",
            opacity: 0.6,
          }}
        >
          © {new Date().getFullYear()} Portal Hotel
        </div>
      </div>

      {/* Right panel — form */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "16px",
            padding: "40px 44px",
            width: "100%",
            maxWidth: "400px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              marginBottom: "32px",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "0.62rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "6px",
              }}
            >
              Acesso restrito
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Entrar no sistema
            </h2>
          </div>

          <form onSubmit={(e) => void handleLogin(e)}>
            {/* Email */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                }}
              >
                E-mail
              </label>
              <div style={{ position: "relative" }}>
                <FiMail
                  size={15}
                  style={{
                    position: "absolute",
                    left: "13px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    fontFamily: "DM Sans, sans-serif",
                    color: "var(--text-primary)",
                    background: "var(--surface)",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: "28px" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "6px",
                }}
              >
                Senha
              </label>
              <div style={{ position: "relative" }}>
                <FiLock
                  size={15}
                  style={{
                    position: "absolute",
                    left: "13px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    fontFamily: "DM Sans, sans-serif",
                    color: "var(--text-primary)",
                    background: "var(--surface)",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px 20px",
                background: loading ? "#d97706" : "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#d97706"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent)"; }}
            >
              <FiLogIn size={16} />
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>

      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
