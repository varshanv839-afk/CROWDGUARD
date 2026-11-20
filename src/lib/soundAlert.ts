/**
 * Synthesizes a clean tactical alert chime via Web Audio API.
 * Zero external audio assets required; respects mute state safely.
 */
export function playAlertTone(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', muted: boolean): void {
  if (muted) return;
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const triggerBeep = (startOffset: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = severity === 'CRITICAL' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.14, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (severity === 'CRITICAL') {
      triggerBeep(0, 880, 0.16);
      triggerBeep(0.2, 880, 0.16);
      triggerBeep(0.4, 1046, 0.22);
    } else if (severity === 'HIGH') {
      triggerBeep(0, 740, 0.18);
      triggerBeep(0.22, 740, 0.18);
    } else {
      triggerBeep(0, 587, 0.15);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignore autoplay restrictions before first user gesture
  }
}
