"use client";

import { useEffect, useRef } from "react";

export function useVisiblePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;

    const run = () => {
      if (document.visibilityState !== "visible" || running) return;
      running = true;
      Promise.resolve(callbackRef.current())
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };

    const start = () => {
      if (document.visibilityState !== "visible") return;
      run();
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };

    const onVisibilityChange = () => {
      stop();
      if (document.visibilityState === "visible") start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
