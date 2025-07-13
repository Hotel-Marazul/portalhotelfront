"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Home",
  "/about": "About Us",
  "/contact": "Contact",
  "/services": "Services",
};

export default function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Portal Hotel";

  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow-md text-black py-4 text-center z-50">
      <h1 className="text-xl font-bold">{title}</h1>
    </header>
  );
}