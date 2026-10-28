"use client";

/* eslint-disable @next/next/no-img-element -- a mídia vem autenticada por cookie do backend; next/image não repassa o cookie. */

import { useState } from "react";
import type { TimelineMedia } from "../../../types/whatsapp";
import { MediaNotice, mediaNoticeClass, mediaSrc } from "./shared";
import { pulseClass, visualClass } from "./ImageMessage";
import { cx } from "../../ui/cx";

const stickerClass = "relative block size-32 rounded-control object-contain";

export default function StickerMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const [broken, setBroken] = useState(false);

  if (media.status === "ready" && !broken) {
    return <img className={stickerClass} src={mediaSrc(media)} alt="Figurinha" decoding="async" onError={() => setBroken(true)} />;
  }

  return (
    <div className={visualClass}>
      {media.thumbnail
        ? <img className={stickerClass} src={media.thumbnail} alt="Figurinha" />
        : <span className={cx(stickerClass, "bg-border", media.status === "pending" && !broken && pulseClass)} aria-hidden="true" />}
      {broken ? <span className={mediaNoticeClass}>Figurinha</span> : <MediaNotice messageId={messageId} media={media} />}
    </div>
  );
}
