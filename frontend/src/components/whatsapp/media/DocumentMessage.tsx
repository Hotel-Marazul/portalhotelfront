"use client";

import { FiExternalLink, FiFileText } from "react-icons/fi";
import { documentTypeLabel, formatFileSize } from "../../../utils/whatsapp";
import type { TimelineMedia } from "../../../types/whatsapp";
import { DownloadLink, MediaNotice, mediaSrc } from "./shared";
import styles from "./media.module.css";

export default function DocumentMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const ready = media.status === "ready";
  const type = documentTypeLabel(media.mimetype, media.fileName);
  const size = formatFileSize(media.fileLength);
  const isPdf = type === "PDF";

  return (
    <div className={styles.document}>
      <div className={styles.documentInfo}>
        <span className={styles.documentIcon} aria-hidden="true"><FiFileText size={20} /></span>
        <span className={styles.documentText}>
          <span className={styles.documentName}>{media.fileName || "Documento"}</span>
          <span className={styles.documentMeta}>{size ? `${type}, ${size}` : type}</span>
        </span>
      </div>
      {ready ? (
        <span className={styles.noticeRow}>
          {isPdf && (
            <a className={styles.action} href={mediaSrc(media)} target="_blank" rel="noopener noreferrer">
              <FiExternalLink size={13} aria-hidden="true" />
              Abrir
            </a>
          )}
          <DownloadLink media={media} />
        </span>
      ) : <MediaNotice messageId={messageId} media={media} />}
    </div>
  );
}
