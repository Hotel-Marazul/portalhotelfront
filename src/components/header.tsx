"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Home",
  "/quarto": "Quartos",
  "/categoria": "Categorias",
  "/about": "About Us",
  "/contact": "Contact",
  "/services": "Services",
};

export default function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Portal Hotel";

  return (
    <header className="relative fixed top-0 left-0 w-full bg-white shadow-md text-black py-4 z-50">
      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-700 font-medium">
        Bem vindo ao painel administrativo
      </div>

      <h1 className="text-xl font-bold text-center">{title}</h1>
    </header>
  );
}
