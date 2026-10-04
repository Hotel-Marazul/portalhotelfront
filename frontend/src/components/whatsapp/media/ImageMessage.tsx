"use client";

/* eslint-disable @next/next/no-img-element -- a mídia vem autenticada por cookie do backend; next/image não repassa o cookie. */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FiX } from "react-icons/fi";
import { mediaAspectRatio } from "../../../utils/whatsapp";
import type { TimelineMedia } from "../../../types/whatsapp";
import { DownloadLink, MediaNotice, mediaSrc } from "./shared";
import styles from "./media.module.css";

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
    <div className={styles.visual}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.frame}
        style={mediaBoxStyle(media)}
        onClick={() => setOpen(true)}
        disabled={!ready || broken || !loaded}
        aria-label={ready && loaded ? (caption ? `Ampliar foto: ${caption}` : "Ampliar foto") : alt}
      >
        {media.thumbnail && !loaded && <img className={styles.thumbnail} src={media.thumbnail} alt="" aria-hidden="true" />}
        {!media.thumbnail && !loaded && (
          <span className={`${styles.skeleton} ${loading ? styles.loading : ""}`} aria-hidden="true" />
        )}
        {ready && !broken && (
          <img
            key={src}
            className={`${styles.full} ${loaded ? styles.fullLoaded : ""}`}
            src={src}
            alt={alt}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
          />
        )}
        {loading && (
          <span className={styles.overlay} role="status">Baixando…</span>
        )}
      </button>
      {!ready && media.status !== "pending" && <MediaNotice messageId={messageId} media={media} />}
      {ready && broken && (
        <span className={styles.noticeRow}>
          <span className={styles.notice}>Não deu para mostrar a foto.</span>
          <button type="button" className={styles.action} onClick={() => { setBroken(false); setLoaded(false); setAttempt((value) => value + 1); }}>Tentar de novo</button>
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
      className={styles.lightbox}
      aria-label="Foto ampliada"
      onClick={(event) => {
        // Clique no fundo escuro (fora da foto e da barra) fecha.
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className={styles.lightboxBar}>
        <DownloadLink media={media} />
        <button ref={closeRef} type="button" className={styles.lightboxClose} onClick={() => dialogRef.current?.close()} aria-label="Fechar">
          <FiX size={18} aria-hidden="true" />
        </button>
      </div>
      <img className={styles.lightboxImage} src={src} alt={alt} />
    </dialog>
  );
}
