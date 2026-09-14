"use client";

import "../styles/globals.css";
import { useState } from "react";
import { Drawer } from "@mui/material";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@mui/material/styles";
import DrawerMenu from "../components/sidenav";
import Header from "../components/header";
import MobileNavigation from "../components/layout/MobileNavigation";
import theme from "../theme";


export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/";

  return (
    <html lang="pt-BR">
      <body className="flex flex-col">
        <ThemeProvider theme={theme}>
          {isPublicRoute ? (
            children
          ) : (
            <>
              <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
              <Header />
              <div className="flex flex-1">
                <div className="desktop-sidebar"><DrawerMenu /></div>
                <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} sx={{ display: { xs: "block", md: "none" } }}><DrawerMenu onNavigate={() => setMenuOpen(false)} /></Drawer>
                <main
                  id="main-content" tabIndex={-1} className="app-main"
                >
                  {children}
                </main>
                <MobileNavigation onOpenMenu={() => setMenuOpen(true)} />
              </div>
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
