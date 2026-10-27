"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../services/api";
import { apiErrorMessage, classifyApiError } from "../../utils/api-error";
import { useVisiblePolling } from "../../hooks/useVisiblePolling";
import type { WhatsappConfiguration as Configuration, WhatsappHistorySyncResult, WhatsappQrResponse } from "../../types/whatsapp";
import WhatsappConfigurationView from "./WhatsappConfigurationView";
import styles from "./configuration.module.css";

export default function WhatsappConfiguration() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"qr" | "logout" | "history" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const cancelLogoutRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get<Configuration>("/api/whatsapp/configuration");
      setConfiguration(response.data);
      setPermissionDenied(false);
      setError(null);
    } catch (requestError) {
      setPermissionDenied(classifyApiError(requestError) === "permission");
      setError(apiErrorMessage(requestError, "Não foi possível carregar a configuração do WhatsApp."));
    } finally {
      setLoading(false);
    }
  }, []);

  useVisiblePolling(load, 15_000);

  useEffect(() => {
    if (!qrExpiresAt) return;
    const remaining = Math.max(0, qrExpiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setQrCode(null);
      setQrExpiresAt(null);
      setFeedback("O QR Code expirou. Gere um novo para continuar.");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [qrExpiresAt]);

  useEffect(() => {
    if (!confirmLogout) return;
    cancelLogoutRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy !== "logout") setConfirmLogout(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, confirmLogout]);

  const requestQr = async () => {
    setBusy("qr");
    setError(null);
    setFeedback(null);
    try {
      const response = await api.post<WhatsappQrResponse>("/api/whatsapp/connection/qr");
      if (response.data.state === "open") {
        setQrCode(null);
        setQrExpiresAt(null);
        setFeedback("O número já está conectado.");
      } else {
        setQrCode(response.data.qrCode);
        setQrExpiresAt(Date.now() + response.data.expiresInSeconds * 1_000);
        setFeedback("QR Code gerado. Leia-o pelo WhatsApp do número do hotel.");
      }
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível gerar o QR Code."));
    } finally {
      setBusy(null);
    }
  };

  const importHistory = async () => {
    setBusy("history");
    setError(null);
    setFeedback(null);
    try {
      const { data } = await api.post<WhatsappHistorySyncResult>("/api/whatsapp/history-sync");
      const failed = data.failedConversations > 0 ? ` ${data.failedConversations} conversa(s) não puderam ser importadas.` : "";
      setFeedback(data.messagesImported === 0
        ? `Nada novo para importar. ${data.conversations} conversa(s) já estão na central.${failed}`
        : `${data.messagesImported} mensagem(ns) importada(s) em ${data.conversations} conversa(s); ${data.waiting} voltaram para a fila.${failed}`);
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível importar as conversas."));
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    setBusy("logout");
    setError(null);
    try {
      await api.delete("/api/whatsapp/connection");
      setQrCode(null);
      setQrExpiresAt(null);
      setConfirmLogout(false);
      setFeedback("Número desconectado. As conversas e métricas foram preservadas.");
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Não foi possível desconectar o número."));
    } finally {
      setBusy(null);
    }
  };

  if (loading && !configuration) {
    return <div className={styles.loading} aria-busy="true" aria-label="Carregando configuração"><span /><span /><span /></div>;
  }
  if (permissionDenied) {
    return <section className={styles.permission} role="alert"><h2>Acesso restrito</h2><p>Somente o gerente pode configurar a conexão do WhatsApp.</p></section>;
  }
  if (!configuration) {
    return <section className={styles.permission} role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Tentar novamente</button></section>;
  }

  return <>
    <div aria-live="polite" className={styles.live}>{error ?? feedback}</div>
    <WhatsappConfigurationView
      configuration={configuration}
      qrCode={qrCode}
      busy={busy}
      error={error}
      feedback={feedback}
      onRequestQr={() => void requestQr()}
      onRequestLogout={() => setConfirmLogout(true)}
      onImportHistory={() => void importHistory()}
      onRefresh={() => void load()}
    />
    {confirmLogout && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={() => setConfirmLogout(false)}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="logout-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="logout-title">Desconectar o número?</h2>
        <p>O atendimento será interrompido até um novo pareamento. Conversas, vínculos e métricas serão preservados.</p>
        <div><button ref={cancelLogoutRef} type="button" onClick={() => setConfirmLogout(false)}>Cancelar</button><button type="button" className={styles.dangerButton} disabled={busy === "logout"} onClick={() => void logout()}>{busy === "logout" ? "Desconectando…" : "Desconectar"}</button></div>
      </section>
    </div>}
  </>;
}
