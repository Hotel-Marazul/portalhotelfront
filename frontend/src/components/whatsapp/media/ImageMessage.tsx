"use client";

/* eslint-disable @next/next/no-img-element -- a mídia vem autenticada por cookie do backend; next/image não repassa o cookie. */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { mediaAspectRatio } from "../../../utils/whatsapp";
import type { TimelineMedia } from "../../../types/whatsapp";
import { DownloadLink, MediaNotice, mediaActionClass, mediaNoticeClass, mediaNoticeRowClass, mediaSrc } from "./shared";
import { cx } from "../../ui/cx";

// Peças comuns a foto, vídeo e figurinha.
export const visualClass = "mb-1.5 grid justify-items-start gap-1.5";
export const frameClass = "relative block max-w-full overflow-hidden rounded-control border-0 bg-border p-0 text-inherit cursor-zoom-in disabled:cursor-default";
export const thumbnailClass = "absolute inset-0 size-full scale-110 object-cover blur-[10px]";
export const loadingOverlayClass = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-fg/75 px-2.5 py-1 text-xs font-medium text-on-dark";
export const pulseClass = "animate-pulse motion-reduce:animate-none";

const MAX_WIDTH = 320;
const MAX_HEIGHT = 360;

/** Caixa com a proporção da foto, para a conversa não pular quando a imagem chega. */
export function mediaBoxStyle(media: TimelineMedia, maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT): CSSProperties {
  const ratio = mediaAspectRatio(media.width, media.height);
  return { width: Math.min(maxWidth, Math.round(maxHeight * ratio)), aspectRatio: String(ratio) };
}

export default function ImageMessage({ messageId, media, caption }: { messageId: string; media: TimelineMedia; caption: string }) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ready = media.status === "ready";
  const src = attempt ? `${mediaSrc(media)}?tentativa=${attempt}` : mediaSrc(media);
  const alt = caption ? `Foto: ${caption}` : "Foto enviada pelo WhatsApp";
  // Pulsa só enquanto a foto está chegando; falha, grande demais e quebrada ficam parados.
  const loading = media.status === "pending" || (ready && !broken && !loaded);

  return (
    <div className={visualClass}>
      <button
        ref={triggerRef}
        type="button"
        className={frameClass}
        style={mediaBoxStyle(media)}
        onClick={() => setOpen(true)}
        disabled={!ready || broken || !loaded}
        aria-label={ready && loaded ? (caption ? `Ampliar foto: ${caption}` : "Ampliar foto") : alt}
      >
        {media.thumbnail && !loaded && <img className={thumbnailClass} src={media.thumbnail} alt="" aria-hidden="true" />}
        {!media.thumbnail && !loaded && (
          <span className={cx("absolute inset-0 bg-border", loading && pulseClass)} aria-hidden="true" />
        )}
        {ready && !broken && (
          <img
            key={src}
            className={cx("absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0")}
            src={src}
            alt={alt}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
          />
        )}
        {loading && (
          <span className={loadingOverlayClass} role="status">Baixando…</span>
        )}
      </button>
      {!ready && media.status !== "pending" && <MediaNotice messageId={messageId} media={media} />}
      {ready && broken && (
        <span className={mediaNoticeRowClass}>
          <span className={mediaNoticeClass}>Não deu para mostrar a foto.</span>
          <button type="button" className={mediaActionClass} onClick={() => { setBroken(false); setLoaded(false); setAttempt((value) => value + 1); }}>Tentar de novo</button>
          <DownloadLink media={media} />
        </span>
      )}
      {open && <Lightbox src={mediaSrc(media)} alt={alt} media={media} onClose={() => { setOpen(false); triggerRef.current?.focus(); }} />}
    </div>
  );
}

function Lightbox({ src, alt, media, onClose }: { src: string; alt: string; media: TimelineMedia; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // showModal deixa o resto da página inerte (foco preso) e fecha com Esc.
    if (!dialog.open) dialog.showModal();
    // autoFocus do React roda antes do showModal (dialog ainda fechado) e não vale;
    // sem isto o foco iria para "Baixar", o primeiro item focável.
    closeRef.current?.focus();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-4 backdrop:bg-fg/90 open:grid open:grid-rows-[auto_minmax(0,1fr)] open:gap-3"
      aria-label="Foto ampliada"
      onClick={(event) => {
        // Clique no fundo escuro (fora da foto e da barra) fecha.
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="flex items-center gap-2 justify-self-end">
        <DownloadLink media={media} />
        <button ref={closeRef} type="button" className="grid size-10 place-items-center rounded-full bg-surface text-fg" onClick={() => dialogRef.current?.close()} aria-label="Fechar">
          <X aria-hidden="true" className="size-[18px]" />
        </button>
      </div>
      <img className="max-h-full max-w-full place-self-center rounded-control object-contain" src={src} alt={alt} />
    </dialog>
  );
}
