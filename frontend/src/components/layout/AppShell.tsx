"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { CommandBarProvider } from "../command/CommandBar";
import WhatsappWatcher from "../whatsapp/WhatsappWatcher";

/**
 * Navegação lateral recolhível à esquerda e um painel branco único. O layout ocupa a altura da janela:
 * cada tela nova rola só as próprias listas; as telas que ainda não migraram
 * rolam dentro do painel.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <CommandBarProvider>
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <WhatsappWatcher />
      <div className="flex h-dvh bg-bg text-fg">
        <Sidebar />
        <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 p-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-panel border border-border-soft bg-surface">
            {children}
          </div>
        </main>
      </div>
    </CommandBarProvider>
  );
}
