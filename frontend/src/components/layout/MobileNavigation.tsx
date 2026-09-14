"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiCalendar, FiHome, FiMenu, FiUsers } from "react-icons/fi";

interface MobileNavigationProps {
  onOpenMenu: () => void;
}

const items = [
  { href: "/dashboard", label: "Hoje", Icon: FiHome },
  { href: "/reservas", label: "Agenda", Icon: FiCalendar },
  { href: "/cliente", label: "Hóspedes", Icon: FiUsers },
];

export default function MobileNavigation({ onOpenMenu }: MobileNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="app-bottom-nav" aria-label="Navegação operacional">
      {items.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={pathname === href ? "active" : undefined}
        >
          <Icon aria-hidden="true" size={20} />
          <span>{label}</span>
        </Link>
      ))}
      <button type="button" onClick={onOpenMenu} aria-label="Abrir mais opções">
        <FiMenu aria-hidden="true" size={21} />
        <span>Mais</span>
      </button>
    </nav>
  );
}
