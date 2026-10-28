"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import apiClient from "../../services/api";
import { homePathFor } from "../../config/navigation";
import { cx } from "../../components/ui/cx";

const inputClass =
  "h-10 w-full rounded-control border bg-surface px-3 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none focus-visible:ring-3 focus-visible:ring-accent-100";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post("/api/User/login", { email, password });
      const { flag, message } = response.data;

      if (flag) {
        // O gerente entra pela Gestão; a recepção, pelo Hoje.
        const session = await apiClient.get<{ role?: string }>("/api/User/me").catch(() => null);
        router.replace(homePathFor(session?.data.role));
        return;
      }
      setError(message || "Falha no login.");
    } catch (requestError) {
      let message = "Erro ao conectar na API.";
      if (isAxiosError(requestError)) {
        const m = requestError.response?.data?.message;
        if (typeof m === "string") message = m;
      }
      setError(message);
    }
    setLoading(false);
  };

  const borderClass = error ? "border-danger/50" : "border-border";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-10 text-sm text-fg">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-[34px] place-items-center rounded-[9px] bg-fg text-base font-semibold text-on-dark">m</span>
        <span className="text-lg font-semibold tracking-[-0.01em]">Marazul</span>
      </div>

      <main className="flex w-full max-w-[400px] flex-col gap-5 rounded-panel border border-border-soft bg-surface p-8 max-[420px]:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Entrar</h1>
          <p className="m-0 text-fg-3">Acesso da equipe do hotel.</p>
        </div>

        {error && (
          <p id="login-erro" role="alert" className="m-0 rounded-control bg-danger-bg px-3 py-2.5 text-[13px] leading-[1.45] text-danger">{error}</p>
        )}

        <form onSubmit={(e) => void handleLogin(e)} aria-busy={loading} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-medium">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="nome@hotel.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-erro" : undefined}
              className={cx(inputClass, borderClass)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[13px] font-medium">Senha</label>
            <span className="relative flex">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-erro" : undefined}
                className={cx(inputClass, borderClass, "pr-[84px]")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                aria-controls="password"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute top-1 right-1 h-8 rounded-bar px-2.5 text-[13px] text-fg-2 transition-colors hover:bg-muted hover:text-fg"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </span>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[42px] rounded-control bg-fg font-medium text-on-dark transition-colors hover:bg-fg/85 disabled:cursor-progress disabled:bg-fg-2"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="m-0 text-[13px] text-fg-3">Esqueceu a senha? Peça para a gerência redefinir.</p>
      </main>

      <span className="text-xs text-fg-3">Hotel Marazul · sistema interno</span>
    </div>
  );
}
