"use client";

import { useEffect, useSyncExternalStore } from "react";
import api from "../services/api";
import type { UserRole } from "../config/navigation";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
}

interface CurrentUserState {
  user: CurrentUser | null;
  status: "idle" | "loading" | "ready" | "error";
}

/**
 * Uma leitura de /api/User/me por carga de página. Menu, Hoje, Gestão e
 * WhatsApp leem daqui em vez de cada um repetir a chamada.
 */
const listeners = new Set<() => void>();
const SERVER_STATE: CurrentUserState = { user: null, status: "idle" };
let state: CurrentUserState = SERVER_STATE;

function emit(next: CurrentUserState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function load() {
  if (state.status === "loading" || state.status === "ready") return;
  emit({ user: null, status: "loading" });
  api.get<CurrentUser>("/api/User/me")
    .then((response) => {
      const { id, email, role } = response.data;
      emit(role === "admin" || role === "receptionist" ? { user: { id, email, role }, status: "ready" } : { user: null, status: "error" });
    })
    .catch(() => emit({ user: null, status: "error" }));
}

export function useCurrentUser(): CurrentUserState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(load, []);
  return snapshot;
}

/** Ao sair, a próxima sessão lê o usuário de novo. */
export function clearCurrentUser() {
  emit(SERVER_STATE);
}

export const ROLE_LABELS: Record<UserRole, string> = { admin: "Gerente", receptionist: "Recepção" };

/** O backend não guarda nome; "ana.lima@…" vira "Ana Lima". */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter((word) => word && !/^\d+$/.test(word));
  if (words.length === 0) return email;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

export function initialsFromName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : words[0]?.[1] ?? "")).toUpperCase();
}
