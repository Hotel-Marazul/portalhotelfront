import { useSyncExternalStore } from "react";

// A partir desta largura o painel do quarto fica ao lado da tabela; abaixo, abre num Sheet.
const QUERY = "(min-width: 1200px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useWideLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
