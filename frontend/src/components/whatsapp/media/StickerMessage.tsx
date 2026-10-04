"use client";

/* eslint-disable @next/next/no-img-element -- a mídia vem autenticada por cookie do backend; next/image não repassa o cookie. */

import { useState } from "react";
import type { TimelineMedia } from "../../../types/whatsapp";
import { MediaNotice, mediaSrc } from "./shared";
import styles from "./media.module.css";

export default function StickerMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const [broken, setBroken] = useState(false);

  if (media.status === "ready" && !broken) {
    return <img className={styles.sticker} src={mediaSrc(media)} alt="Figurinha" decoding="async" onError={() => setBroken(true)} />;
  }

  return (
    <div className={styles.visual}>
      {media.thumbnail
        ? <img className={styles.sticker} src={media.thumbnail} alt="Figurinha" />
        : <span className={`${styles.sticker} ${styles.stickerSkeleton} ${media.status === "pending" && !broken ? styles.loading : ""}`} aria-hidden="true" />}
      {broken ? <span className={styles.notice}>Figurinha</span> : <MediaNotice messageId={messageId} media={media} />}
    </div>
  );
}
