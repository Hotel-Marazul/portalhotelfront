"use client";

import "../styles/globals.css";
import { useEffect, useState } from "react";
import { Drawer } from "@mui/material";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@mui/material/styles";
import DrawerMenu from "../components/sidenav";
import Header from "../components/header";
import MobileNavigation from "../components/layout/MobileNavigation";
import WhatsappWatcher from "../components/whatsapp/WhatsappWatcher";
import theme from "../theme";
import { geistMono, hankenGrotesk } from "../styles/fonts";

const NAV_EXPANDED_KEY = "nav:expanded";


export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/";
  // A central do WhatsApp usa um header mais baixo para sobrar tela.
  const immersive = pathname === "/whatsapp";
  // No desktop o menu é um trilho de ícones; a seta expande e a escolha fica salva.
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    try {
      setNavExpanded(window.localStorage.getItem(NAV_EXPANDED_KEY) === "1");
    } catch {
      // Sem storage o menu só começa recolhido.
    }
  }, []);

  const toggleNav = () => {
    setNavExpanded((current) => {
      try {
        window.localStorage.setItem(NAV_EXPANDED_KEY, current ? "0" : "1");
      } catch {
        // Preferência só não persiste.
      }
      return !current;
    });
  };

  return (
    <html lang="pt-BR" className={`${hankenGrotesk.variable} ${geistMono.variable}`}>
      <body className="flex flex-col" data-immersive={immersive ? "" : undefined} data-nav={navExpanded ? "expanded" : "collapsed"}>
        <ThemeProvider theme={theme}>
          {isPublicRoute ? (
            children
          ) : (
            <>
              <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
              <Header />
              <WhatsappWatcher />
              <div className="flex flex-1">
                <div className="desktop-sidebar"><DrawerMenu collapsed={!navExpanded} onToggle={toggleNav} /></div>
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
