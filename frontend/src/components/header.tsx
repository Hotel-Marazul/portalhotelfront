"use client";

import { usePathname, useRouter } from "next/navigation";
import { FiLogOut } from "react-icons/fi";
import apiClient from "../services/api";
import { APP_PAGE_TITLES, HEADER_HEIGHT, NAV_WIDTH } from "../config/navigation";

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
      router.replace("/login");
    }
  }

  if (isLoginRoute) return null;

  return (
    <header
      className="fixed top-0 z-40 flex items-center justify-between px-6"
      style={{
        height: `${HEADER_HEIGHT}px`,
        left: `${NAV_WIDTH}px`,
        right: 0,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <h1
        className="m-0 text-sm font-semibold"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
      >
        {title}
      </h1>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-slate-100"
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
