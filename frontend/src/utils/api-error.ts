import { isAxiosError } from "axios";

export type ApiErrorKind = "validation" | "authentication" | "permission" | "conflict" | "network" | "server" | "unknown";

export function classifyApiError(error: unknown): ApiErrorKind {
  if (!isAxiosError(error)) {
    return error instanceof TypeError ? "network" : "unknown";
  }

  const status = error.response?.status;
  if (status === 400) return "validation";
  if (status === 401) return "authentication";
  if (status === 403) return "permission";
  if (status === 409) return "conflict";
  if (status !== undefined && status >= 500) return "server";
  return error.response ? "unknown" : "network";
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const kind = classifyApiError(error);
  if (kind === "authentication") return "Sua sessão expirou. Faça login novamente.";
  if (kind === "permission") return "Você não tem permissão para esta operação.";

  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }

  switch (kind) {
    case "conflict":
      return "Os dados mudaram no servidor. Atualize e tente novamente.";
    case "network":
      return "Não foi possível conectar ao servidor. Tente novamente.";
    default:
      return fallback;
  }
}
