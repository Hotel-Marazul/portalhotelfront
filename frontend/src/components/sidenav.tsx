"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import HotelLogo from "./layout/HotelLogo";
import { APP_SECTIONS } from "../config/navigation";
import { api } from "../services/api";

export default function Sidenav({ onNavigate }: { onNavigate?: () => void }) {
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

  return (
    <aside className="app-sidebar">
      <div className="brand"><HotelLogo /></div>
      <nav aria-label="Navegação principal">
        {APP_SECTIONS.map(section => (
          <div key={section.label} className="nav-group">
            <p className="nav-group-label">{section.label}</p>
            {section.items.map(({ key, path, label, Icon, size }) => (
              <Link key={key} href={path} onClick={onNavigate}
                aria-current={pathname === path ? "page" : undefined}
                className={`sidebar-link${pathname === path ? " active" : ""}`}>
                <Icon size={size} aria-hidden="true" /><span>{label}</span>{key === "whatsapp" && whatsappCount > 0 && <b className="nav-badge" aria-label={`${whatsappCount} conversas aguardando`}>{whatsappCount}</b>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">Gestão hoteleira<br />Uma operação mais simples.</div>
    </aside>
  );
}
