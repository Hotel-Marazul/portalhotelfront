"use client";

import { Search } from "lucide-react";
import type { QueueItem, QueueResponse } from "../../types/whatsapp";
import { formatLastMessage, formatWaiting, levelLabel } from "../../utils/whatsapp";
import { cx } from "../ui/cx";

export type QueueFilter = "todas" | "lead" | "reserva" | "outros";

const FILTER_LABELS: Record<QueueFilter, string> = { todas: "Todas", lead: "Leads", reserva: "Reserva", outros: "Outros" };

// A urgência vira a barra à esquerda e a cor do tempo; o nível por extenso fica para leitor de tela.
export const LEVEL_RAIL: Record<NonNullable<QueueItem["level"]>, string> = {
  agora: "bg-danger",
  hoje: "bg-warn",
  espera: "bg-fg-3/40",
};
const LEVEL_TEXT: Record<NonNullable<QueueItem["level"]>, string> = {
  agora: "text-danger",
  hoje: "text-warn",
  espera: "text-fg-3",
};

export function avatarClass(known: boolean) {
  return known ? "bg-accent-100 text-accent-700" : "bg-muted text-fg-2";
}

interface QueueColumnProps {
  queue: QueueResponse;
  queueError: string | null;
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  search: string;
  onSearch: (value: string) => void;
  searchResults: QueueItem[] | null;
  conversationId: string | null;
  nextConversation: QueueItem | undefined;
  aiNotice: string | null;
  onOpen: (id: string) => void;
  className?: string;
}

export default function QueueColumn({ queue, queueError, filter, onFilter, search, onSearch, searchResults, conversationId, nextConversation, aiNotice, onOpen, className }: QueueColumnProps) {
  const waiting = searchResults ?? queue.waiting;
  const answered = searchResults ? [] : queue.answered;

  return (
    <section aria-labelledby="fila-titulo" className={cx("flex min-h-0 min-w-0 flex-col border-rule min-[900px]:border-r", className)}>
      <div className="flex flex-col gap-2.5 px-3.5 pt-4 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <h1 id="fila-titulo" className="m-0 text-lg font-semibold tracking-[-0.02em]">
            Fila <span className="font-mono text-sm font-normal text-fg-3">{queue.counts.todas}</span>
          </h1>
          <button
            type="button"
            onClick={() => nextConversation && onOpen(nextConversation.conversationId)}
            disabled={!nextConversation}
            title="Atalho: Alt + N"
            aria-keyshortcuts="Alt+N"
            className="inline-flex min-h-8 items-center gap-2 rounded-control bg-fg pr-2.5 pl-3 text-[13px] font-medium text-on-dark transition-colors hover:bg-fg/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nextConversation ? "Atender próximo" : "Fila vazia"}
            {nextConversation && <kbd aria-hidden="true" className="rounded bg-on-dark/15 px-1.5 py-px font-mono text-[11px]">Alt N</kbd>}
          </button>
        </div>
        {aiNotice && <p role="status" className="m-0 inline-flex items-center gap-2 text-xs text-warn-fg"><span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />{aiNotice}</p>}
        <label className="flex h-[34px] items-center gap-2 rounded-control border border-border px-2.5 focus-within:border-accent">
          <span className="sr-only">Buscar conversa</span>
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-fg-3" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar nome ou telefone"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-3"
          />
        </label>
        <div role="group" aria-label="Filtros da fila" className="flex rounded-[9px] bg-muted p-[3px]">
          {(Object.keys(FILTER_LABELS) as QueueFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilter(value)}
              className={cx(
                "min-h-7 flex-auto whitespace-nowrap rounded-[7px] px-1 text-xs transition-colors",
                filter === value ? "bg-surface font-medium text-fg shadow-tab" : "text-fg-2 hover:text-fg",
              )}
            >
              {FILTER_LABELS[value]}
              {!searchResults && <span className="ml-1 font-mono text-[11px] text-fg-2">{queue.counts[value]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {queueError && <p role="alert" className="m-1.5 text-[13px] text-danger">{queueError}</p>}
        <h2 className="m-1.5 text-xs font-medium text-fg-3">{searchResults ? "Resultados" : "Aguardando resposta"}</h2>
        {waiting.map((item) => <QueueRow key={item.conversationId} item={item} active={item.conversationId === conversationId} onOpen={onOpen} />)}
        {!waiting.length && !queueError && <p className="m-1.5 text-[13px] text-fg-2">Nenhuma conversa encontrada.</p>}
        {answered.length > 0 && (
          <>
            <h2 className="mx-1.5 mt-3.5 mb-1.5 text-xs font-medium text-fg-3">Conversas recentes</h2>
            {answered.map((item) => <QueueRow key={item.conversationId} item={item} active={item.conversationId === conversationId} onOpen={onOpen} />)}
          </>
        )}
      </div>
    </section>
  );
}

function QueueRow({ item, active, onOpen }: { item: QueueItem; active: boolean; onOpen: (id: string) => void }) {
  const when = (item.awaitingSince ? formatWaiting(item.awaitingSince) : formatLastMessage(item.lastMessageAt)).replace(/^há /, "");
  const unread = item.unreadCount > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.conversationId)}
      aria-current={active ? "true" : undefined}
      className={cx(
        "relative flex w-full gap-2.5 rounded-[9px] py-2.5 pr-2.5 pl-3.5 text-left text-fg transition-colors",
        active ? "bg-muted" : "hover:bg-bg",
      )}
    >
      {item.level && <span aria-hidden="true" className={cx("absolute top-3 bottom-3 left-1 w-[3px] rounded-sm", LEVEL_RAIL[item.level])} />}
      <span aria-hidden="true" className={cx("grid size-[34px] shrink-0 place-items-center rounded-full text-xs font-semibold", avatarClass(item.isKnownClient))}>{item.initials}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cx("truncate", item.level || unread ? "font-semibold" : "font-medium")}>{item.displayName}</span>
          <span className={cx("shrink-0 font-mono text-[11px]", item.level ? LEVEL_TEXT[item.level] : "text-fg-3")}>{when}</span>
        </span>
        {item.level && item.headline && <span className="truncate text-[13px] font-medium">{item.headline}</span>}
        <span className="flex items-center justify-between gap-2">
          <span className={cx("truncate text-xs", unread ? "text-fg" : "text-fg-3")}>{item.preview}</span>
          {unread && !active && (
            <span aria-label={`${item.unreadCount} não lidas`} className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-accent px-1 font-mono text-[11px] text-on-dark">
              {item.unreadCount}
            </span>
          )}
        </span>
        {item.level && <span className="sr-only">Prioridade: {levelLabel(item.level)}</span>}
      </span>
    </button>
  );
}
