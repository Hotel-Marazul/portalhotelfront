"use client";

import { forwardRef, type RefObject } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { Suggestion } from "../../types/whatsapp";
import { cx } from "../ui/cx";
import { gapNotice } from "./whatsapp-view";

interface ReplyComposerProps {
  contactName: string;
  firstName: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onTextChange: (value: string) => void;
  onSend: () => void;
  sendBlocked: boolean;
  remainingGaps: number;
  suggestion: Suggestion | null;
  suggestionCollapsed: boolean;
  onToggleSuggestion: () => void;
  onUseSuggestion: () => void;
  onDismissSuggestion: () => void;
  showFirstContact: boolean;
  onInsertPrivacyNotice: (() => void) | null;
  conversationChanged: boolean;
  onForceSend: () => void;
}

const linkButton = "border-0 bg-transparent p-0 text-xs font-medium text-accent-700 underline underline-offset-[3px] hover:text-accent";

// Caixa de resposta: a sugestão da IA fica acima e só entra no texto com "Usar e editar".
const ReplyComposer = forwardRef<HTMLDivElement, ReplyComposerProps>(function ReplyComposer(props, ref) {
  const { suggestion, text, sendBlocked, remainingGaps } = props;
  const gaps = gapNotice(remainingGaps);
  const notice = sendBlocked
    ? { text: "Envio bloqueado enquanto o número estiver desconectado.", className: "text-danger" }
    : gaps ? { text: gaps, className: "text-warn-fg" } : null;
  const canSend = Boolean(text.trim()) && !sendBlocked && remainingGaps === 0;

  return (
    <div ref={ref} className="flex shrink-0 flex-col gap-2.5 border-t border-rule px-5 pt-3 pb-4 max-[899px]:px-3">
      {suggestion && (
        <section aria-label="Sugestão da IA" className="flex flex-col gap-2 rounded-block border border-accent-200 bg-accent-50 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={!props.suggestionCollapsed}
              onClick={props.onToggleSuggestion}
              className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold text-accent-700"
            >
              <Sparkles aria-hidden="true" className="size-[13px] shrink-0" />
              <span className="shrink-0">Sugestão</span>
              {props.suggestionCollapsed && <span className="min-w-0 truncate font-normal text-fg-2">{suggestion.text}</span>}
              {props.suggestionCollapsed ? <ChevronUp aria-hidden="true" className="size-3.5 shrink-0" /> : <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />}
            </button>
            <span className="flex gap-1">
              <button type="button" onClick={props.onDismissSuggestion} className="min-h-7 rounded-[7px] px-2.5 text-[13px] text-fg-2 transition-colors hover:bg-accent-100 hover:text-fg">Descartar</button>
              <button type="button" onClick={props.onUseSuggestion} className="min-h-7 rounded-[7px] bg-accent px-3 text-[13px] font-medium text-on-dark transition-colors hover:bg-accent-700">Usar e editar</button>
            </span>
          </div>
          {!props.suggestionCollapsed && (
            <>
              <p className="m-0 max-h-[7.5em] overflow-y-auto text-sm leading-normal whitespace-pre-wrap">
                {suggestion.parts.map((part, index) => part.gap
                  ? <mark key={`${part.text}-${index}`} className="rounded px-[3px] font-medium bg-warn-bg text-warn-fg">{part.text}</mark>
                  : <span key={`${part.text}-${index}`}>{part.text}</span>)}
              </p>
              {suggestion.basis.length > 0 && <span className="text-xs text-fg-2">Baseada em: {suggestion.basis.join(" · ")}</span>}
            </>
          )}
        </section>
      )}

      {props.showFirstContact && (
        <p className="m-0 flex items-center justify-between gap-2 text-xs text-fg-2">
          Primeiro contato: inclua o aviso de registro.
          {props.onInsertPrivacyNotice && <button type="button" onClick={props.onInsertPrivacyNotice} className={linkButton}>Inserir aviso</button>}
        </p>
      )}
      {props.conversationChanged && (
        <p className="m-0 flex items-center justify-between gap-2 text-xs text-warn-fg">
          A conversa mudou enquanto você escrevia.
          <button type="button" onClick={props.onForceSend} className={linkButton}>Enviar mesmo assim</button>
        </p>
      )}

      <div className="flex flex-col rounded-block border border-border bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-100">
        <textarea
          ref={props.textareaRef}
          aria-label={`Resposta para ${props.contactName}`}
          placeholder={sendBlocked ? "Envio bloqueado enquanto o número estiver desconectado" : `Responder ${props.firstName}`}
          rows={2}
          value={text}
          onChange={(event) => props.onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            props.onSend();
          }}
          className="max-h-40 min-h-[52px] resize-none border-0 bg-transparent px-3.5 py-2 text-sm leading-normal text-fg outline-none [field-sizing:content] placeholder:text-fg-3"
        />
        <div className="flex items-center justify-between gap-2 pr-2 pb-2 pl-3.5">
          <span className={cx("text-xs", notice?.className ?? "text-fg-3")}>{notice?.text ?? "Enter envia · Shift + Enter quebra a linha"}</span>
          <button
            type="button"
            onClick={props.onSend}
            disabled={!canSend}
            className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-control bg-fg px-3.5 text-[13px] font-medium text-on-dark transition-colors hover:bg-fg/85 disabled:cursor-not-allowed disabled:bg-done-bg disabled:text-fg-2"
          >
            Enviar
            <ArrowRight aria-hidden="true" className="size-[13px]" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default ReplyComposer;
