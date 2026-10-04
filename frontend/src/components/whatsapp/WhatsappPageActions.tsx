"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiBell, FiBellOff, FiMessageCircle, FiSettings, FiTrendingUp } from "react-icons/fi";
import { api } from "../../services/api";
import { setWhatsappSoundOn, useWhatsappWaiting } from "../../hooks/useWhatsappWaiting";

export default function WhatsappPageActions() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const { soundOn } = useWhatsappWaiting();

  useEffect(() => {
    let active = true;
    api.get<{ role?: string }>("/api/User/me")
      .then((response) => {
        if (active) setIsAdmin(response.data.role === "admin");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const linkClass = (href: string) => `header-action${pathname === href ? " active" : ""}`;

  return (
    <>
      <button
        type="button"
        className="header-action"
        aria-pressed={soundOn}
        aria-label={soundOn ? "Desligar som de mensagem nova" : "Ligar som de mensagem nova"}
        title={soundOn ? "Som de mensagem nova ligado" : "Som de mensagem nova desligado"}
        onClick={() => setWhatsappSoundOn(!soundOn)}
      >
        {soundOn ? <FiBell size={14} aria-hidden="true" /> : <FiBellOff size={14} aria-hidden="true" />}
      </button>
      {pathname !== "/whatsapp" && (
        <Link href="/whatsapp" className="header-action" aria-label="Fila">
          <FiMessageCircle size={14} aria-hidden="true" />
          <span className="header-action-label">Fila</span>
        </Link>
      )}
      <Link href="/whatsapp/aprendizado" className={linkClass("/whatsapp/aprendizado")} aria-label="Aprendizado da IA">
        <FiTrendingUp size={14} aria-hidden="true" />
        <span className="header-action-label">Aprendizado da IA</span>
      </Link>
      {isAdmin && (
        <Link href="/whatsapp/configuracoes" className={linkClass("/whatsapp/configuracoes")} aria-label="Configurações">
          <FiSettings size={14} aria-hidden="true" />
          <span className="header-action-label">Configurações</span>
        </Link>
      )}
    </>
  );
}
