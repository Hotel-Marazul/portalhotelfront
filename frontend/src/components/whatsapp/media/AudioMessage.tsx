"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { formatDuration } from "../../../utils/whatsapp";
import type { TimelineMedia } from "../../../types/whatsapp";
import { DownloadLink, MediaNotice, claimPlayback, mediaNoticeClass, mediaSrc, releasePlayback } from "./shared";

const SPEEDS = [1, 1.5, 2] as const;
const SPEED_LABELS: Record<(typeof SPEEDS)[number], string> = { 1: "1×", 1.5: "1,5×", 2: "2×" };
const STEP_SECONDS = 5;

/**
 * Player compacto de áudio. O <audio> fica sempre montado com o mesmo src,
 * então o polling da conversa (a cada 4 s) não interrompe quem está ouvindo.
 */
export default function AudioMessage({ messageId, media }: { messageId: string; media: TimelineMedia }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number | null>(null);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const ready = media.status === "ready";
  const duration = loadedDuration ?? (media.seconds && media.seconds > 0 ? media.seconds : 0);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const speed = SPEEDS[speedIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
  }, [speed, ready]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !ready) return;
    if (audio.paused) {
      claimPlayback(audio);
      void audio.play().catch((error: unknown) => {
        if ((error as { name?: string })?.name !== "AbortError") setFailed(true);
      });
    } else {
      audio.pause();
    }
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !ready || duration <= 0) return;
    const target = Math.max(0, Math.min(duration, seconds));
    audio.currentTime = target;
    setCurrent(target);
  }

  function seekFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekTo(((event.clientX - rect.left) / rect.width) * duration);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowRight: current + STEP_SECONDS,
      ArrowUp: current + STEP_SECONDS,
      ArrowLeft: current - STEP_SECONDS,
      ArrowDown: current - STEP_SECONDS,
      PageUp: current + STEP_SECONDS * 2,
      PageDown: current - STEP_SECONDS * 2,
      Home: 0,
      End: duration,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    seekTo(moves[event.key]);
  }

  if (failed) {
    return (
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className={mediaNoticeClass}>Não deu para tocar aqui.</span>
        <DownloadLink media={media} />
      </div>
    );
  }

  const shownTime = playing || current > 0 ? formatDuration(current) : formatDuration(duration);

  return (
    <div className="mb-1.5 grid w-[288px] max-w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5">
      {ready && (
        <audio
          ref={audioRef}
          src={mediaSrc(media)}
          preload={media.seconds ? "none" : "metadata"}
          onPlay={(event) => { claimPlayback(event.currentTarget); setPlaying(true); }}
          onPause={(event) => { releasePlayback(event.currentTarget); setPlaying(false); }}
          onEnded={(event) => { setPlaying(false); setCurrent(0); event.currentTarget.currentTime = 0; }}
          onTimeUpdate={(event) => { if (!draggingRef.current) setCurrent(event.currentTarget.currentTime); }}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setLoadedDuration(value);
          }}
          onDurationChange={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setLoadedDuration(value);
          }}
          onError={() => setFailed(true)}
        />
      )}
      <button
        type="button"
        className="grid size-[34px] place-items-center rounded-full bg-fg text-on-dark transition-colors hover:bg-fg/85 disabled:cursor-default disabled:bg-border disabled:text-fg-2"
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
      >
        {playing ? <Pause aria-hidden="true" className="size-3.5" fill="currentColor" /> : <Play aria-hidden="true" className="ml-0.5 size-3.5" fill="currentColor" />}
      </button>
      <div className="grid min-w-0 gap-0.5">
        <div
          className="group relative h-[18px] cursor-pointer touch-none rounded-bar before:absolute before:inset-x-0 before:top-[7px] before:h-1 before:rounded-sm before:bg-border aria-disabled:cursor-default"
          role="slider"
          tabIndex={ready ? 0 : -1}
          aria-label="Posição do áudio"
          aria-disabled={!ready}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatDuration(current)} de ${formatDuration(duration)}`}
          onKeyDown={handleKey}
          onPointerDown={(event) => {
            if (!ready || duration <= 0) return;
            draggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromPointer(event);
          }}
          onPointerMove={(event) => { if (draggingRef.current) seekFromPointer(event); }}
          onPointerUp={() => { draggingRef.current = false; }}
          onPointerCancel={() => { draggingRef.current = false; }}
        >
          <span className="absolute top-[7px] left-0 h-1 rounded-sm bg-accent" style={{ width: `${progress * 100}%` }} />
          <span className="absolute top-[3px] size-3 -translate-x-1/2 rounded-full bg-accent group-aria-disabled:bg-fg-3" style={{ left: `${progress * 100}%` }} />
        </div>
        <div className="flex min-h-4 items-center gap-1.5 text-[11px] text-fg-2">
          {ready ? <span className="font-mono">{shownTime}</span> : <MediaNotice messageId={messageId} media={media} />}
          {media.ptt && <Mic className="size-3 shrink-0 text-accent" aria-label="Mensagem de voz" role="img" />}
        </div>
      </div>
      <button
        type="button"
        className="h-[26px] min-w-[42px] rounded-full border border-border bg-surface px-2 font-mono text-xs font-medium text-fg disabled:cursor-default disabled:text-fg-3"
        onClick={() => setSpeedIndex((index) => (index + 1) % SPEEDS.length)}
        disabled={!ready}
        aria-label={`Velocidade ${SPEED_LABELS[speed]}. Trocar velocidade`}
      >
        {SPEED_LABELS[speed]}
      </button>
    </div>
  );
}
