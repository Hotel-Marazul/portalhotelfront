"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado compartilhado do aviso de WhatsApp: quantas conversas esperam resposta
 * e se a recepção quer ouvir o som. Um único WhatsappWatcher escreve; a barra
 * lateral, a navegação do celular e o botão de som leem.
 */
interface WaitingState {
  count: number;
  soundOn: boolean;
}

const SOUND_KEY = "whatsapp:sound";
const listeners = new Set<() => void>();
let state: WaitingState = { count: 0, soundOn: readSoundPreference() };

function readSoundPreference(): boolean {
  try {
    return typeof window === "undefined" || window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function emit(next: Partial<WaitingState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const SERVER_STATE: WaitingState = { count: 0, soundOn: true };

export function useWhatsappWaiting(): WaitingState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

export function setWhatsappWaitingCount(count: number) {
  if (count !== state.count) emit({ count });
}

export function getWhatsappSoundOn(): boolean {
  return state.soundOn;
}

export function setWhatsappSoundOn(soundOn: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  } catch {
    // Sem armazenamento a preferência vale só nesta aba.
  }
  emit({ soundOn });
}
