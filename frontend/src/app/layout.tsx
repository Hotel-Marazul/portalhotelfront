"use client";

import "../styles/globals.css";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@mui/material/styles";
import AppShell from "../components/layout/AppShell";
import Toaster from "../components/ui/Toast";
import theme from "../theme";
import { geistMono, hankenGrotesk } from "../styles/fonts";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/";

  return (
    <html lang="pt-BR" className={`${hankenGrotesk.variable} ${geistMono.variable}`}>
      <body>
        {/* O tema do MUI fica até a última tela migrar (seção 13 do tasks.md). */}
        <ThemeProvider theme={theme}>
          {isPublicRoute ? children : <AppShell>{children}</AppShell>}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
