"use client";

import { usePathname, useRouter } from "next/navigation";
import { FiLogOut } from "react-icons/fi";
import apiClient from "../services/api";
import { APP_PAGE_TITLES } from "../config/navigation";
import { clearAgentConversationStorage, requestCache } from "../utils/cache";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const title = APP_PAGE_TITLES[pathname] || "Portal Hotel";
  const isLoginRoute = pathname === "/login";

  async function handleLogout() {
    try {
      await apiClient.post("/api/User/logout");
    } catch {
      // Mesmo com erro de rede, redireciona para evitar sessão inconsistente no cliente.
    } finally {
      requestCache.clear();
      clearAgentConversationStorage();
      router.replace("/login");
    }
  }

  if (isLoginRoute) return null;

  return (
    <header className="app-header">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>Hotel Marazul <span aria-hidden="true"> / </span> <strong style={{ color: "var(--text-primary)" }}>{title}</strong></span>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-slate-100"
        style={{
          color: "var(--text-muted)",
          background: "transparent",
          border: "1px solid var(--border)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <FiLogOut size={14} />
        Sair
      </button>
    </header>
  );
}
