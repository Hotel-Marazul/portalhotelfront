import axios from "axios";
import { clearAgentConversationStorage, requestCache } from "../utils/cache";

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

api.interceptors.response.use(undefined, (error) => {
  const isLoginRequest = String(error?.config?.url ?? "").includes("/User/login");
  if (
    typeof window !== "undefined" &&
    axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    !isLoginRequest &&
    window.location.pathname !== "/login"
  ) {
    requestCache.clear();
    clearAgentConversationStorage();
    // The global interceptor has no React router; a hard navigation is intentional.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  return Promise.reject(error);
});

export default api;
