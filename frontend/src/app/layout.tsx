"use client";

import "../styles/globals.css";
import { usePathname } from "next/navigation";
import AppShell from "../components/layout/AppShell";
import Toaster from "../components/ui/Toast";
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
        {isPublicRoute ? children : <AppShell>{children}</AppShell>}
        <Toaster />
      </body>
    </html>
  );
}
