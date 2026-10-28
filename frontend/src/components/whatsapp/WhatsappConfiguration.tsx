"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";
import { apiErrorMessage, classifyApiError } from "../../utils/api-error";
import { useVisiblePolling } from "../../hooks/useVisiblePolling";
import type { WhatsappConfiguration as Configuration, WhatsappHistorySyncResult, WhatsappQrResponse } from "../../types/whatsapp";
import Button from "../ui/Button";
import WhatsappConfigurationView from "./WhatsappConfigurationView";

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
    return (
      <div className="grid flex-1 grid-cols-1 gap-10 min-[1100px]:grid-cols-3" aria-busy="true" aria-label="Carregando configuração">
        {[0, 1, 2].map((index) => <span key={index} className="h-48 animate-pulse rounded-block bg-muted motion-reduce:animate-none" />)}
      </div>
    );
  }
  if (permissionDenied) {
    return (
      <section role="alert" className="flex flex-col gap-1">
        <h2 className="m-0 text-[15px] font-semibold">Acesso restrito</h2>
        <p className="m-0 text-sm text-fg-2">Somente o gerente pode configurar a conexão do WhatsApp.</p>
      </section>
    );
  }
  if (!configuration) {
    return (
      <section role="alert" className="flex flex-col items-start gap-3">
        <p className="m-0 text-sm text-danger">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
      </section>
    );
  }

  return <>
    <div aria-live="polite" className="sr-only">{error ?? feedback}</div>
    <WhatsappConfigurationView
      configuration={configuration}
      qrCode={qrCode}
      busy={busy}
      error={error}
      feedback={feedback}
      confirmingLogout={confirmLogout}
      onRequestQr={() => void requestQr()}
      onRequestLogout={() => setConfirmLogout(true)}
      onCancelLogout={() => setConfirmLogout(false)}
      onConfirmLogout={() => void logout()}
      onImportHistory={() => void importHistory()}
      onRefresh={() => void load()}
    />
  </>;
}
