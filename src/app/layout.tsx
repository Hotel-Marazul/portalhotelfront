"use client";

import "@/styles/globals.css";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import DrawerMenu from "@/components/sidenav";
import Header from "@/components/header";
import Snackbar from "@/components/snackbar"; // Importa o componente Snackbar

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });
  const router = useRouter();
  const pathname = usePathname(); // Obtém a rota atual

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Exemplo usando token
      const token = localStorage.getItem("token");
      if (token) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        if (pathname !== "/") {
          router.push("/login");
        }
      }
    }
  }, [router, pathname]);


  // Corrigir o Snackbar para fechar corretamente
  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <html lang="pt-BR">
      <body className="flex flex-col">
        {isAuthenticated === null ? (
          // Enquanto verifica a autenticação, não renderiza nada
          null
        ) : !isAuthenticated && pathname === "/login" ? (
          // Renderiza apenas o conteúdo da página de login
          <>{children}</>
        ) : isAuthenticated ? (
          // Renderiza o layout completo para usuários autenticados
          <>
            <Header />
            <div className="flex flex-1">
              <DrawerMenu />
              <main className="flex-1 ml-48 transition-all duration-300">
                {children}
              </main>
            </div>
          </>
        ) : null}
        <Snackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={handleCloseSnackbar}
        />
      </body>
    </html>
  );
}