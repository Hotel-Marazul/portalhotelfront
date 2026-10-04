"use client";

import type { TimelineMedia } from "../../../types/whatsapp";
import AudioMessage from "./AudioMessage";
import DocumentMessage from "./DocumentMessage";
import ImageMessage from "./ImageMessage";
import StickerMessage from "./StickerMessage";
import VideoMessage from "./VideoMessage";
import { MediaStatusProvider, useLiveMediaStatus } from "./shared";

/** Escolhe o player certo para a mídia da mensagem. Fica acima da legenda na bolha. */
export default function MessageMedia({ messageId, mediaType, media: incoming, caption }: {
  messageId: string;
  mediaType: string;
  media: TimelineMedia;
  caption: string;
}) {
  const { status, setStatus } = useLiveMediaStatus(messageId, incoming);
  const media = status === incoming.status ? incoming : { ...incoming, status };
  return (
    <MediaStatusProvider value={setStatus}>
      <MediaByType messageId={messageId} mediaType={mediaType} media={media} caption={caption} />
    </MediaStatusProvider>
  );
}

function MediaByType({ messageId, mediaType, media, caption }: {
  messageId: string;
  mediaType: string;
  media: TimelineMedia;
  caption: string;
}) {
  switch (mediaType) {
    case "image":
      return <ImageMessage messageId={messageId} media={media} caption={caption} />;
    case "audio":
      return <AudioMessage messageId={messageId} media={media} />;
    case "video":
      return <VideoMessage messageId={messageId} media={media} />;
    case "sticker":
      return <StickerMessage messageId={messageId} media={media} />;
    default:
      return <DocumentMessage messageId={messageId} media={media} />;
  }
}
