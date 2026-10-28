"use client";

import { forwardRef } from "react";
import { Check, CheckCheck, Clock, Sparkles } from "lucide-react";
import type { TimelineItem } from "../../types/whatsapp";
import { dayLabel, deliveryMark, mediaLabel, type DeliveryMark } from "../../utils/whatsapp";
import { cx } from "../ui/cx";
import MessageMedia from "./media/MessageMedia";

interface ConversationTimelineProps {
  items: TimelineItem[];
  hasMore: boolean;
  onLoadOlder: () => void;
  retryingMessageId: string | null;
  onRetry: (messageId: string) => void;
}

const timeFormat = (value: string) => new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const ConversationTimeline = forwardRef<HTMLDivElement, ConversationTimelineProps>(function ConversationTimeline({ items, hasMore, onLoadOlder, retryingMessageId, onRetry }, ref) {
  return (
    <div ref={ref} aria-live="polite" aria-relevant="additions" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-surface px-[clamp(12px,3%,24px)] py-[18px]">
      {hasMore && (
        <button type="button" onClick={onLoadOlder} className="min-h-7 self-center rounded-full border border-border bg-surface px-3 text-xs text-fg-2 transition-colors hover:text-fg">
          Carregar anteriores
        </button>
      )}
      {items.map((item, index) => {
        if (item.kind === "day") {
          return <span key={`day-${item.date}`} className="sticky top-0 z-[1] my-1 self-center rounded-full bg-surface px-2.5 text-xs text-fg-3">{dayLabel(item.date)}</span>;
        }
        if (item.kind === "ai_marker") {
          return (
            <span key={`ai-${item.readingId}`} className="inline-flex max-w-[90%] items-center gap-1.5 self-center rounded-xl bg-accent-50 px-2.5 py-1 text-xs text-accent-700">
              <Sparkles aria-hidden="true" className="size-3 shrink-0" />
              <span>{item.text} · <time dateTime={item.at} className="font-mono">{timeFormat(item.at)}</time></span>
            </span>
          );
        }
        const outbound = item.direction === "outbound";
        const failed = item.status === "failed";
        const media = item.media ?? null;
        const sticker = Boolean(media && item.mediaType === "sticker" && !item.body);
        const previous = items[index - 1];
        // Mensagens seguidas do mesmo lado ficam juntas, como no WhatsApp.
        const grouped = previous?.kind === "message" && previous.direction === item.direction;
        return (
          <article
            key={item.id}
            className={cx(
              "flex max-w-[min(68%,560px)] flex-col gap-1.5 text-sm leading-[1.45] max-[899px]:max-w-[88%]",
              outbound ? "self-end rounded-[12px_12px_4px_12px]" : "self-start rounded-[12px_12px_12px_4px]",
              // Figurinha aparece solta, sem fundo de bolha.
              sticker ? "py-1" : cx("px-3 py-[9px]", outbound ? "bg-accent-100" : "bg-muted"),
              grouped && "-mt-1",
              media && "w-fit",
              failed && "ring-1 ring-danger",
            )}
          >
            {media && <MessageMedia messageId={item.id} mediaType={item.mediaType} media={media} caption={item.body} />}
            {item.body
              ? <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.body}</p>
              : !media && <p className="m-0 text-fg-2 italic">{mediaLabel(item.mediaType)}</p>}
            <span className="inline-flex items-center gap-1.5 self-end text-[11px] text-fg-3">
              {outbound && <span>{item.origin === "phone" ? "Pelo celular" : item.sentBy ?? "Portal"}</span>}
              <time dateTime={item.sentAt} className="font-mono">{timeFormat(item.sentAt)}</time>
              <DeliveryIcon mark={deliveryMark(item.direction, item.status)} />
            </span>
            {failed && (
              <span className="flex flex-wrap items-center gap-2">
                <small className="text-xs text-danger">{item.failureReason ?? "Falha no envio."}</small>
                <button
                  type="button"
                  onClick={() => onRetry(item.id)}
                  disabled={retryingMessageId === item.id}
                  className="min-h-7 rounded-control border border-border bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:bg-bg disabled:opacity-50"
                >
                  {retryingMessageId === item.id ? "Reenviando…" : "Reenviar"}
                </button>
              </span>
            )}
          </article>
        );
      })}
      {!items.length && <p className="m-0 text-[13px] text-fg-2">Nenhuma mensagem.</p>}
    </div>
  );
});

export default ConversationTimeline;

const DELIVERY_LABELS: Record<NonNullable<DeliveryMark>, string> = {
  pending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Não enviada",
};

function DeliveryIcon({ mark }: { mark: DeliveryMark }) {
  if (!mark || mark === "failed") return null;
  const label = DELIVERY_LABELS[mark];
  const Icon = mark === "pending" ? Clock : mark === "sent" ? Check : CheckCheck;
  return (
    <span role="img" aria-label={label} title={label} className={cx("inline-flex", mark === "read" ? "text-accent" : "text-fg-3")}>
      <Icon aria-hidden="true" className={mark === "pending" ? "size-[11px]" : "size-3.5"} />
    </span>
  );
}
