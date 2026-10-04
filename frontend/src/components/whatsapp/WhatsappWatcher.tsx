"use client";

import { useEffect } from "react";
import { api } from "../../services/api";
import { getWhatsappSoundOn, setWhatsappWaitingCount } from "../../hooks/useWhatsappWaiting";
import { newestWaitingAt } from "../../utils/whatsapp";
import type { QueueResponse } from "../../types/whatsapp";

const POLL_MS = 15_000;
const STATUS_MS = 5 * 60_000;
const TITLE_PREFIX = /^\(\d+\)\s/;

function playChime() {
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
    [880, 1320].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + 0.5);
    });
    setTimeout(() => void context.close(), 800);
  } catch {
    // Navegador sem áudio ou bloqueado antes do primeiro clique: o título da aba ainda avisa.
  }
}

function updateTitle(count: number) {
  const base = document.title.replace(TITLE_PREFIX, "");
  document.title = count > 0 ? `(${count}) ${base}` : base;
}

/**
 * Consulta a fila mesmo com a aba em segundo plano, para que a recepção perceba
 * mensagem nova pelo título da aba e por um som, em qualquer página do portal.
 */
export default function WhatsappWatcher() {
  useEffect(() => {
    let enabled = false;
    let statusCheckedAt = 0;
    let lastSeen: number | null = null;
    let running = false;
    let stopped = false;

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        if (Date.now() - statusCheckedAt > STATUS_MS) {
          const status = await api.get<{ enabled: boolean }>("/api/whatsapp/status");
          enabled = Boolean(status.data.enabled);
          statusCheckedAt = Date.now();
        }
        if (!enabled) {
          setWhatsappWaitingCount(0);
          updateTitle(0);
          return;
        }
        const queue = await api.get<QueueResponse>("/api/whatsapp/queue");
        if (stopped) return;
        const waiting = queue.data.waiting ?? [];
        const newest = newestWaitingAt(waiting);
        // Na primeira leitura só registra; o som é para o que chega depois.
        if (lastSeen !== null && newest > lastSeen && getWhatsappSoundOn()) playChime();
        lastSeen = Math.max(lastSeen ?? 0, newest);
        setWhatsappWaitingCount(waiting.length);
        updateTitle(waiting.length);
      } catch {
        // Falha de rede: mantém o último número e tenta de novo no próximo ciclo.
      } finally {
        running = false;
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      updateTitle(0);
    };
  }, []);

  return null;
}
