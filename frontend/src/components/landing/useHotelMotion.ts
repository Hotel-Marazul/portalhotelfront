"use client";

import { useEffect, useRef } from "react";

export function useHotelMotion(paused: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    const update = () => {
      observer?.disconnect();
      if (paused || preference.matches) {
        root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(node => {
          node.dataset.seen = "true";
          delete node.dataset.entered;
        });
        return;
      }
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const node = entry.target as HTMLElement;
            node.dataset.seen = "true";
            node.dataset.entered = "true";
            observer?.unobserve(node);
          }
        });
      }, { threshold: 0.12 });
      root.querySelectorAll("[data-reveal]:not([data-seen])").forEach(node => observer?.observe(node));
    };
    update();
    preference.addEventListener("change", update);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", update);
    };
  }, [paused]);

  return rootRef;
}
