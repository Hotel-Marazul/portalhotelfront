"use client";

import "../styles/globals.css";
import { usePathname } from "next/navigation";
import DrawerMenu from "../components/sidenav";
import Header from "../components/header";

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
        {isLoginRoute ? (
          children
        ) : (
          <>
            <Header />
            <div className="flex flex-1">
              <DrawerMenu />
              <main className="flex-1 ml-48 pt-20 transition-all duration-300">{children}</main>
            </div>
          </>
        )}
      </body>
    </html>
  );
}
