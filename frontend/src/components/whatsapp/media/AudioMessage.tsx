"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { FiMic, FiPause, FiPlay } from "react-icons/fi";
import { formatDuration } from "../../../utils/whatsapp";
import type { TimelineMedia } from "../../../types/whatsapp";
import { DownloadLink, MediaNotice, claimPlayback, mediaSrc, releasePlayback } from "./shared";
import styles from "./media.module.css";

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
      <div className={styles.audioError}>
        <span className={styles.notice}>Não deu para tocar aqui.</span>
        <DownloadLink media={media} />
      </div>
    );
  }

  const shownTime = playing || current > 0 ? formatDuration(current) : formatDuration(duration);

  return (
    <div className={styles.audio}>
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
        className={styles.playButton}
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
      >
        {playing ? <FiPause size={16} aria-hidden="true" /> : <FiPlay size={16} aria-hidden="true" className={styles.playIcon} />}
      </button>
      <div className={styles.audioBody}>
        <div
          className={styles.track}
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
          <span className={styles.trackFill} style={{ width: `${progress * 100}%` }} />
          <span className={styles.trackThumb} style={{ left: `${progress * 100}%` }} />
        </div>
        <div className={styles.audioMeta}>
          {ready ? <span className={styles.audioTime}>{shownTime}</span> : <MediaNotice messageId={messageId} media={media} />}
          {media.ptt && <FiMic size={12} className={styles.mic} aria-label="Mensagem de voz" role="img" />}
        </div>
      </div>
      <button
        type="button"
        className={styles.speedButton}
        onClick={() => setSpeedIndex((index) => (index + 1) % SPEEDS.length)}
        disabled={!ready}
        aria-label={`Velocidade ${SPEED_LABELS[speed]}. Trocar velocidade`}
      >
        {SPEED_LABELS[speed]}
      </button>
    </div>
  );
}
