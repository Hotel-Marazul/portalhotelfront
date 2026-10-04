"use client";

/* eslint-disable @next/next/no-img-element -- miniatura em data: URL vinda do WhatsApp. */

import { useState } from "react";
import type { TimelineMedia } from "../../../types/whatsapp";
import { mediaBoxStyle } from "./ImageMessage";
import { DownloadLink, MediaNotice, claimPlayback, mediaSrc, releasePlayback } from "./shared";
import styles from "./media.module.css";

export default function VideoMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const [failed, setFailed] = useState(false);
  const ready = media.status === "ready";

  if (ready && !failed) {
    return (
      <div className={styles.visual}>
        <video
          className={styles.video}
          style={mediaBoxStyle(media)}
          src={mediaSrc(media)}
          poster={media.thumbnail ?? undefined}
          controls
          playsInline
          preload="metadata"
          onPlay={(event) => claimPlayback(event.currentTarget)}
          onPause={(event) => releasePlayback(event.currentTarget)}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={styles.visual}>
      <div className={styles.frame} style={mediaBoxStyle(media)}>
        {media.thumbnail ? <img className={styles.thumbnail} src={media.thumbnail} alt="" aria-hidden="true" /> : <span className={`${styles.skeleton} ${media.status === "pending" ? styles.loading : ""}`} aria-hidden="true" />}
        {media.status === "pending" && <span className={styles.overlay} role="status">Baixando…</span>}
      </div>
      {failed ? (
        <span className={styles.noticeRow}>
          <span className={styles.notice}>Não deu para tocar aqui.</span>
          <DownloadLink media={media} />
        </span>
      ) : media.status !== "pending" && <MediaNotice messageId={messageId} media={media} />}
    </div>
  );
}
