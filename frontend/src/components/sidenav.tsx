"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { LuWaves } from "react-icons/lu";
import HotelLogo from "./layout/HotelLogo";
import { APP_SECTIONS } from "../config/navigation";
import { useWhatsappWaiting } from "../hooks/useWhatsappWaiting";
import { api } from "../services/api";

interface SidenavProps {
  onNavigate?: () => void;
  /** Só no desktop: trilho de ícones que expande pela seta. */
  collapsed?: boolean;
  onToggle?: () => void;
}

const ROLE_LABELS: Record<string, string> = { admin: "Gerente", receptionist: "Recepção" };

export default function Sidenav({ onNavigate, collapsed = false, onToggle }: SidenavProps) {
  const pathname = usePathname();
  const { count: whatsappCount } = useWhatsappWaiting();
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null);

  useEffect(() => {
    let active = true;
    api.get<{ email?: string; role?: string }>("/api/User/me")
      .then((response) => { if (active) setUser(response.data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const userInitials = (user?.email ?? "").split("@")[0].slice(0, 2).toUpperCase() || "··";

  return (
    <aside className={`app-sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="brand">
        {collapsed
          ? <span className="brand-mark" aria-label="Hotel Marazul"><LuWaves size={20} aria-hidden="true" /></span>
          : <HotelLogo />}
        {onToggle && (
          <button type="button" className="nav-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
            {collapsed ? <FiChevronRight size={14} aria-hidden="true" /> : <FiChevronLeft size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
      <nav aria-label="Navegação principal">
        {APP_SECTIONS.map(section => (
          <div key={section.label} className="nav-group">
            <p className="nav-group-label">{section.label}</p>
            {section.items.map(({ key, path, label, Icon, size }) => (
              <Link key={key} href={path} onClick={onNavigate}
                aria-current={isActive(path) ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                className={`sidebar-link${isActive(path) ? " active" : ""}`}>
                <Icon size={size} aria-hidden="true" /><span>{label}</span>{key === "whatsapp" && whatsappCount > 0 && <b className="nav-badge" aria-label={`${whatsappCount} conversas aguardando`}>{whatsappCount}</b>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="user-avatar" aria-hidden="true">{userInitials}</span>
        <span className="user-copy">
          <strong>{user?.email ?? "Usuário"}</strong>
          <small>{ROLE_LABELS[user?.role ?? ""] ?? "Gestão hoteleira"}</small>
        </span>
      </div>
    </aside>
  );
}
