"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import api from "../../services/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useVisiblePolling } from "../../hooks/useVisiblePolling";
import { setWhatsappSoundOn, useWhatsappWaiting } from "../../hooks/useWhatsappWaiting";
import { cx } from "../ui/cx";

type Connection = "open" | "close" | "connecting" | "disabled";

const CONNECTION: Record<Connection, { label: string; className: string }> = {
  open: { label: "Conectado", className: "bg-accent-100 text-accent-700" },
  close: { label: "Desconectado", className: "bg-danger-bg text-danger" },
  connecting: { label: "Conectando", className: "bg-muted text-fg-2" },
  disabled: { label: "Canal desligado", className: "bg-muted text-fg-2" },
};

// Abas no topo do painel. Configurações só para o gerente; conexão e som à direita.
export default function WhatsappSubnav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { count, soundOn } = useWhatsappWaiting();
  const [connection, setConnection] = useState<Connection | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get<{ enabled?: boolean; connectionState?: string }>("/api/whatsapp/status");
      const { enabled, connectionState } = response.data;
      setConnection(enabled === false ? "disabled" : connectionState === "open" || connectionState === "close" || connectionState === "connecting" ? connectionState : null);
    } catch {
      // Sem resposta, o estado some em vez de mostrar um palpite.
      setConnection(null);
    }
  }, []);
  useVisiblePolling(loadStatus, 30_000);

  const tabs = [
    { href: "/whatsapp", label: "Conversas", count },
    { href: "/whatsapp/aprendizado", label: "Aprendizado da IA" },
    ...(user?.role === "admin" ? [{ href: "/whatsapp/configuracoes", label: "Configurações" }] : []),
  ];

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule pr-4 pl-5">
      <nav aria-label="Seções do WhatsApp" className="flex min-h-[52px] items-stretch gap-0.5">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 px-3 text-sm no-underline transition-colors",
                active ? "font-semibold text-fg shadow-[inset_0_-2px_0_var(--fg)]" : "text-fg-2 hover:text-fg",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="font-mono text-xs text-accent">
                  {tab.count}
                  <span className="sr-only"> aguardando</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 py-2">
        {connection && (
          <span role="status" className={cx("inline-flex h-[30px] items-center gap-2 rounded-control px-2.5 text-[13px]", CONNECTION[connection].className)}>
            <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
            {CONNECTION[connection].label}
          </span>
        )}
        <button
          type="button"
          onClick={() => setWhatsappSoundOn(!soundOn)}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Desligar som de mensagem nova" : "Ligar som de mensagem nova"}
          title={soundOn ? "Som de mensagem nova ligado" : "Som de mensagem nova desligado"}
          className="grid size-8 place-items-center rounded-control border border-border bg-surface text-fg-2 transition-colors hover:bg-bg hover:text-fg"
        >
          {soundOn ? <Bell aria-hidden="true" className="size-[15px]" /> : <BellOff aria-hidden="true" className="size-[15px]" />}
        </button>
      </div>
    </div>
  );
}
