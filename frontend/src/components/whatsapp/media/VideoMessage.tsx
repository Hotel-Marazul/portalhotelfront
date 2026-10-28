"use client";

/* eslint-disable @next/next/no-img-element -- miniatura em data: URL vinda do WhatsApp. */

import { useState } from "react";
import type { TimelineMedia } from "../../../types/whatsapp";
import { frameClass, loadingOverlayClass, mediaBoxStyle, pulseClass, thumbnailClass, visualClass } from "./ImageMessage";
import { DownloadLink, MediaNotice, claimPlayback, mediaNoticeClass, mediaNoticeRowClass, mediaSrc, releasePlayback } from "./shared";
import { cx } from "../../ui/cx";

export default function VideoMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const [failed, setFailed] = useState(false);
  const ready = media.status === "ready";

  if (ready && !failed) {
    return (
      <div className={visualClass}>
        <video
          className="block h-auto max-w-full rounded-control bg-fg object-contain"
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
    <div className={visualClass}>
      <div className={frameClass} style={mediaBoxStyle(media)}>
        {media.thumbnail ? <img className={thumbnailClass} src={media.thumbnail} alt="" aria-hidden="true" /> : <span className={cx("absolute inset-0 bg-border", media.status === "pending" && pulseClass)} aria-hidden="true" />}
        {media.status === "pending" && <span className={loadingOverlayClass} role="status">Baixando…</span>}
      </div>
      {failed ? (
        <span className={mediaNoticeRowClass}>
          <span className={mediaNoticeClass}>Não deu para tocar aqui.</span>
          <DownloadLink media={media} />
        </span>
      ) : media.status !== "pending" && <MediaNotice messageId={messageId} media={media} />}
    </div>
  );
}
