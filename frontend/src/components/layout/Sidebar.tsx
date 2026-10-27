"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import apiClient from "../../services/api";
import { navItemsFor } from "../../config/navigation";
import { clearCurrentUser, displayNameFromEmail, initialsFromName, ROLE_LABELS, useCurrentUser } from "../../hooks/useCurrentUser";
import { useWhatsappWaiting } from "../../hooks/useWhatsappWaiting";
import { clearAgentConversationStorage, requestCache } from "../../utils/cache";
import { cx } from "../ui/cx";

// Menu só de texto. Abaixo de 900 px ele fica acima do painel, com os itens em linha.
export default function Sidebar() {
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
    <aside className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3 pb-2 min-[900px]:w-[216px] min-[900px]:flex-col min-[900px]:flex-nowrap min-[900px]:items-stretch min-[900px]:gap-6 min-[900px]:py-5">
      <div className="flex flex-1 items-center gap-2.5 px-2.5 py-1 min-[900px]:flex-none">
        <span aria-hidden="true" className="grid size-[26px] place-items-center rounded-[7px] bg-fg text-[13px] font-semibold text-on-dark">m</span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Marazul</span>
      </div>

      <nav aria-label="Navegação principal" className="order-last flex w-full flex-wrap gap-px min-[900px]:order-none min-[900px]:flex-col">
        {navItemsFor(user?.role).map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.key}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-sm no-underline transition-colors",
                active ? "bg-nav-active font-medium text-fg" : "text-fg-2 hover:bg-muted hover:text-fg",
              )}
            >
              {item.label}
              {item.key === "whatsapp" && whatsappCount > 0 && (
                <span className="ml-auto font-mono text-xs text-accent">
                  {whatsappCount}
                  <span className="sr-only"> conversas aguardando</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 px-2.5 py-2 min-[900px]:mt-auto">
        {user && (
          <>
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-nav-active text-[11px] font-semibold">{initialsFromName(name)}</span>
            <span className="flex min-w-0 flex-col text-[13px]">
              <span className="truncate font-medium" title={user.email}>{name}</span>
              <span className="text-fg-3">{ROLE_LABELS[user.role]}</span>
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label="Sair"
          title="Sair"
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-control text-fg-2 transition-colors hover:bg-muted hover:text-fg"
        >
          <LogOut aria-hidden="true" className="size-4" />
        </button>
      </div>
    </aside>
  );
}
