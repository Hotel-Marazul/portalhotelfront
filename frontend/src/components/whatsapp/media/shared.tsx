"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { FiDownload, FiRefreshCw } from "react-icons/fi";
import { api } from "../../../services/api";
import { mediaHref } from "../../../utils/whatsapp";
import type { MediaStatus, TimelineMedia } from "../../../types/whatsapp";
import styles from "./media.module.css";

export function mediaSrc(media: TimelineMedia, download = false): string {
  return mediaHref(api.defaults.baseURL, media.url, download);
}

const MEDIA_STATUSES: readonly MediaStatus[] = ["pending", "ready", "failed", "too_large"];
const FIRST_CHECK_MS = 6_000;
const MAX_CHECK_MS = 60_000;

/** Permite ao aviso de falha avisar que um novo download foi pedido. */
const MediaStatusContext = createContext<(status: MediaStatus) => void>(() => undefined);
export const MediaStatusProvider = MediaStatusContext.Provider;

/**
 * Status da mídia que se atualiza sozinho. O polling da conversa só traz as últimas
 * mensagens; mídias de páginas antigas (ou que acabaram de pedir "Tentar de novo")
 * consultam a rota leve de status, com espera crescente, até sair de "pending".
 * O valor local só vale enquanto o status vindo da conversa não mudar.
 */
export function useLiveMediaStatus(messageId: string, media: TimelineMedia) {
  const [override, setOverride] = useState<{ base: MediaStatus; status: MediaStatus } | null>(null);
  const status = override && override.base === media.status ? override.status : media.status;

  useEffect(() => {
    if (status !== "pending") return;
    let cancelled = false;
    let delay = FIRST_CHECK_MS;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const { data } = await api.get<{ status?: string }>(`/api/whatsapp/messages/${messageId}/media/status`);
        if (cancelled) return;
        const next = MEDIA_STATUSES.find((value) => value === data?.status);
        if (next && next !== "pending") {
          setOverride({ base: media.status, status: next });
          return;
        }
      } catch (error) {
        if (cancelled) return;
        // 404: a mensagem não tem mídia para baixar; não adianta insistir.
        if ((error as { response?: { status?: number } })?.response?.status === 404) return;
      }
      delay = Math.min(Math.round(delay * 1.6), MAX_CHECK_MS);
      timer = setTimeout(() => void check(), delay);
    };
    timer = setTimeout(() => void check(), delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [messageId, media.status, status]);

  return {
    status,
    setStatus: (next: MediaStatus) => setOverride({ base: media.status, status: next })
  };
}

/**
 * Só um áudio ou vídeo toca por vez na página, como no WhatsApp.
 * O elemento que começa a tocar pausa o anterior.
 */
let activePlayer: HTMLMediaElement | null = null;

export function claimPlayback(element: HTMLMediaElement) {
  if (activePlayer && activePlayer !== element && !activePlayer.paused) activePlayer.pause();
  activePlayer = element;
}

export function releasePlayback(element: HTMLMediaElement) {
  if (activePlayer === element) activePlayer = null;
}

export function DownloadLink({ media, label = "Baixar" }: { media: TimelineMedia; label?: string }) {
  return (
    <a className={styles.action} href={mediaSrc(media, true)} download={media.fileName ?? true}>
      <FiDownload size={13} aria-hidden="true" />
      {label}
    </a>
  );
}

/**
 * Aviso de mídia que ainda não está disponível. "Tentar de novo" pede ao
 * backend um novo download e volta a mídia para "pending"; a consulta de status
 * (useLiveMediaStatus) traz o novo estado, mesmo fora da janela do polling.
 */
export function MediaNotice({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const setStatus = useContext(MediaStatusContext);

  useEffect(() => {
    setRetrying(false);
    setRetryError(false);
  }, [media.status]);

  if (media.status === "pending") {
    return <span className={styles.notice} role="status">Baixando…</span>;
  }

  if (media.status === "too_large") {
    return <span className={styles.notice}>Arquivo grande demais. Veja no celular.</span>;
  }

  if (media.status !== "failed") return null;

  async function retry() {
    setRetrying(true);
    setRetryError(false);
    try {
      await api.post(`/api/whatsapp/messages/${messageId}/media/retry`);
      setStatus("pending");
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // 409: o download já saiu de "falhou"; a consulta de status mostra o estado certo.
      if (status === 409) {
        setStatus("pending");
      } else {
        setRetrying(false);
        setRetryError(true);
      }
    }
  }

  if (retrying) return <span className={styles.notice} role="status">Baixando…</span>;

  return (
    <span className={styles.noticeRow}>
      <span className={styles.notice}>{retryError ? "Não deu para pedir de novo agora." : "Não foi possível baixar."}</span>
      <button type="button" className={styles.action} onClick={() => void retry()}>
        <FiRefreshCw size={13} aria-hidden="true" />
        Tentar de novo
      </button>
    </span>
  );
}
