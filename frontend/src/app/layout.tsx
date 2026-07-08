"use client";

import "../styles/globals.css";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@mui/material/styles";
import DrawerMenu from "../components/sidenav";
import Header from "../components/header";
import theme from "../theme";
import { HEADER_HEIGHT, NAV_WIDTH } from "../config/navigation";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";

  return (
    <html lang="pt-BR">
      <body className="flex flex-col">
        <ThemeProvider theme={theme}>
          {isLoginRoute ? (
            children
          ) : (
            <>
              <Header />
              <div className="flex flex-1">
                <DrawerMenu />
                <main
                  className="flex-1 transition-all duration-300"
                  style={{ marginLeft: `${NAV_WIDTH}px`, paddingTop: `${HEADER_HEIGHT}px` }}
                >
                  {children}
                </main>
              </div>
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
