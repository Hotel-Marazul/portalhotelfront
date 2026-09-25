"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FiCalendar, FiHome, FiMenu, FiMessageCircle } from "react-icons/fi";
import { api } from "../../services/api";

interface MobileNavigationProps {
  onOpenMenu: () => void;
}

export default function MobileNavigation({ onOpenMenu }: MobileNavigationProps) {
  const pathname = usePathname();
  const [whatsappCount, setWhatsappCount] = useState(0);

  useEffect(() => {
    api.get<{ enabled: boolean }>("/api/whatsapp/status")
      .then(async (response) => {
        if (response.data.enabled) {
          const queue = await api.get<{ counts?: { todas?: number } }>("/api/whatsapp/queue");
          setWhatsappCount(queue.data.counts?.todas ?? 0);
        }
      })
      .catch(() => {
        setWhatsappCount(0);
      });
  }, []);

  const items = [
    { key: "dashboard", href: "/dashboard", label: "Hoje", Icon: FiHome },
    { key: "reservas", href: "/reservas", label: "Agenda", Icon: FiCalendar },
    { key: "whatsapp", href: "/whatsapp", label: "WhatsApp", Icon: FiMessageCircle },
  ];

  return (
    <nav className="app-bottom-nav" aria-label="Navegação operacional">
      {items.map(({ key, href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={pathname === href ? "active" : undefined}
        >
          <Icon aria-hidden="true" size={20} />
          <span>{label}</span>
          {key === "whatsapp" && whatsappCount > 0 && <b className="nav-badge" aria-label={`${whatsappCount} conversas aguardando`}>{whatsappCount}</b>}
        </Link>
      ))}
      <button type="button" onClick={onOpenMenu} aria-label="Abrir mais opções">
        <FiMenu aria-hidden="true" size={21} />
        <span>Mais</span>
      </button>
    </nav>
  );
}
