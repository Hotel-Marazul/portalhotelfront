"use client";

import { ExternalLink, FileText } from "lucide-react";
import { documentTypeLabel, formatFileSize } from "../../../utils/whatsapp";
import type { TimelineMedia } from "../../../types/whatsapp";
import { DownloadLink, MediaNotice, mediaActionClass, mediaNoticeRowClass, mediaSrc } from "./shared";

export default function DocumentMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const ready = media.status === "ready";
  const type = documentTypeLabel(media.mimetype, media.fileName);
  const size = formatFileSize(media.fileLength);
  const isPdf = type === "PDF";

  return (
    <div className="mb-1.5 grid w-[288px] max-w-full gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface text-fg-2" aria-hidden="true"><FileText className="size-[18px]" /></span>
        <span className="grid min-w-0">
          <span className="font-medium [overflow-wrap:anywhere]">{media.fileName || "Documento"}</span>
          <span className="text-xs text-fg-2">{size ? `${type}, ${size}` : type}</span>
        </span>
      </div>
      {ready ? (
        <span className={mediaNoticeRowClass}>
          {isPdf && (
            <a className={mediaActionClass} href={mediaSrc(media)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Abrir
            </a>
          )}
          <DownloadLink media={media} />
        </span>
      ) : <MediaNotice messageId={messageId} media={media} />}
    </div>
  );
}
