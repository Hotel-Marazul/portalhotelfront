"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import HotelLogo from "./layout/HotelLogo";
import { APP_SECTIONS } from "../config/navigation";

export default function Sidenav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
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
                <Icon size={size} aria-hidden="true" /><span>{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">Gestão hoteleira<br />Uma operação mais simples.</div>
    </aside>
  );
}
