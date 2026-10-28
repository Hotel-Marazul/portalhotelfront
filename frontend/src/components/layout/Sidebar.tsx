"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, BedDouble, CalendarDays, LayoutDashboard, LogOut, MessageCircle, Sun, Tags, Users, type LucideIcon } from "lucide-react";
import apiClient from "../../services/api";
import { navItemsFor } from "../../config/navigation";
import { clearCurrentUser, displayNameFromEmail, initialsFromName, ROLE_LABELS, useCurrentUser } from "../../hooks/useCurrentUser";
import { useWhatsappWaiting } from "../../hooks/useWhatsappWaiting";
import { clearAgentConversationStorage, requestCache } from "../../utils/cache";
import { cx } from "../ui/cx";

const NAV_ICONS: Record<string, LucideIcon> = {
  gestao: LayoutDashboard,
  dashboard: Sun,
  reservas: CalendarDays,
  hospedes: Users,
  quartos: BedDouble,
  categorias: Tags,
  whatsapp: MessageCircle,
};

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { count: whatsappCount } = useWhatsappWaiting();
  const name = user ? displayNameFromEmail(user.email) : "";

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  async function handleLogout() {
    try {
      await apiClient.post("/api/User/logout");
    } catch {
      // Mesmo com erro de rede, redireciona para evitar sessão inconsistente no cliente.
    } finally {
      requestCache.clear();
      clearAgentConversationStorage();
      clearCurrentUser();
      router.replace("/login");
    }
  }

  return (
    <aside
      aria-label="Menu lateral"
      className={cx(
        "relative flex h-full shrink-0 flex-col border-r border-border-soft bg-bg text-fg transition-[width] duration-200 ease-in-out motion-reduce:transition-none",
        open ? "w-[232px]" : "w-[76px]",
      )}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
    >
      <div className="flex h-[76px] shrink-0 items-center overflow-hidden border-b border-border-soft px-5">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-block bg-fg text-base font-semibold text-on-dark">m</span>
        {open && <span className="ml-3 text-[15px] font-semibold">Marazul</span>}
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Recolher navegação" : "Expandir navegação"}
        title={open ? "Recolher navegação" : "Expandir navegação"}
        aria-expanded={open}
        aria-controls="sidebar-navigation"
        className="absolute top-6 -right-3.5 z-20 grid size-7 place-items-center rounded-full border border-border bg-surface text-fg-2 transition-colors hover:bg-muted hover:text-fg before:absolute before:-inset-2 before:content-['']"
      >
        {open ? <ChevronLeft aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />}
      </button>

      <nav id="sidebar-navigation" aria-label="Navegação principal" className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-3 py-6">
        {navItemsFor(user?.role).map((item) => {
          const active = isActive(item.path);
          const Icon = NAV_ICONS[item.key];
          const waiting = item.key === "whatsapp" && whatsappCount > 0;
          return (
            <Link
              key={item.key}
              href={item.path}
              aria-label={waiting ? `${item.label}, ${whatsappCount} conversas aguardando` : item.label}
              title={open ? undefined : item.label}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex min-h-11 shrink-0 items-center rounded-block text-sm no-underline transition-colors",
                open ? "gap-3 px-4" : "justify-center",
                active ? "bg-accent-100 font-medium text-accent-700" : "text-fg-3 hover:bg-muted hover:text-fg",
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}
              {open && <span className="whitespace-nowrap">{item.label}</span>}
              {waiting && (
                <span aria-hidden="true" className={cx("font-mono text-accent", open ? "ml-auto text-xs" : "absolute top-1 right-0 rounded-full bg-accent-100 px-1 text-[9px]")}>
                  {whatsappCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cx("mt-auto flex shrink-0 flex-col gap-3 overflow-hidden border-t border-rule px-3 py-4", !open && "items-center")}>
        {user && (
          <div className="flex items-center gap-2.5 px-2" title={`${name} — ${ROLE_LABELS[user.role]}`}>
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-nav-active text-[11px] font-semibold">{initialsFromName(name)}</span>
            {open && <span className="flex min-w-0 flex-col text-[13px]">
              <span className="truncate font-medium" title={user.email}>{name}</span>
              <span className="text-fg-3">{ROLE_LABELS[user.role]}</span>
            </span>}
          </div>
        )}
        <button type="button" onClick={() => void handleLogout()} aria-label="Sair" title="Sair" className={cx("flex min-h-11 items-center rounded-block text-sm text-fg-2 hover:bg-muted hover:text-fg", open ? "gap-3 px-4" : "w-11 justify-center")}>
          <LogOut aria-hidden="true" className="size-4 shrink-0" />
          {open && "Sair"}
        </button>
      </div>
    </aside>
  );
}
