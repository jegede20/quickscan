import type { Settings } from "./storage";

/** Vibrate when a tapped scan opens its result (if enabled and supported). */
export function buzz(settings: Settings): void {
  if (!settings.vibrate) return;
  try {
    navigator.vibrate?.(30);
  } catch {
    // unsupported
  }
}

let audioCtx: AudioContext | null = null;

/** Short confirmation beep via WebAudio (if enabled). */
export function beep(settings: Settings): void {
  if (!settings.sound) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // unsupported
  }
}

export function confirmFeedback(settings: Settings): void {
  buzz(settings);
  beep(settings);
}
