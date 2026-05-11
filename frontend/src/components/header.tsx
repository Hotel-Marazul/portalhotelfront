"use client";

import { Button } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import apiClient from "../services/api";

const pageTitles: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/quarto": "Quartos",
  "/categoria": "Categorias",
  "/reservas": "Reservas",
  "/cliente": "Hóspedes",
  "/about": "About Us",
  "/contact": "Contact",
  "/services": "Services",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || "Portal Hotel";
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
    <header className="relative fixed top-0 left-0 w-full bg-white shadow-md text-black py-4 z-50">
      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
        <span className="text-gray-700 font-medium">Bem vindo ao painel administrativo</span>
        <Button variant="outlined" size="small" onClick={() => void handleLogout()}>
          Sair
        </Button>
      </div>

      <h1 className="text-xl font-bold text-center">{title}</h1>
    </header>
  );
}
