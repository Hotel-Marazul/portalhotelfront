"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { CommandBarProvider } from "../command/CommandBar";
import WhatsappWatcher from "../whatsapp/WhatsappWatcher";

/**
 * Menu à esquerda e um painel branco único. O layout ocupa a altura da janela:
 * cada tela nova rola só as próprias listas; as telas que ainda não migraram
 * rolam dentro do painel.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <CommandBarProvider>
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <WhatsappWatcher />
      <div className="flex h-dvh flex-col bg-bg text-fg min-[900px]:flex-row">
        <Sidebar />
        <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 px-2 pb-2 min-[900px]:py-2 min-[900px]:pr-2 min-[900px]:pl-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-panel border border-border-soft bg-surface">
            {children}
          </div>
        </main>
      </div>
    </CommandBarProvider>
  );
}
