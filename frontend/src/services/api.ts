import axios from "axios";

const DEFAULT_API_URL = "http://localhost:5000";

function getApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  return (configuredUrl || DEFAULT_API_URL).replace(/\/+$/, "");
}

/**
 * Cliente HTTP compartilhado pelo frontend.
 *
 * A API autentica a sessão por cookie HttpOnly. `withCredentials` é necessário
 * para que o navegador envie esse cookie nas requisições para o backend.
 */
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
