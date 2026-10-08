"use client";

import { useEffect } from "react";

/** Register the hand-written service worker (production builds only). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a progressive enhancement; ignore failures.
    });
  }, []);
  return null;
}
