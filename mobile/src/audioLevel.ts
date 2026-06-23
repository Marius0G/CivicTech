// SPIKE — real loudness envelope for lip-sync.
//
// react-native-webrtc doesn't hand us PCM, but RTCPeerConnection.getStats() passes the native
// libwebrtc RTCStatsReport straight through (see node_modules/.../RTCPeerConnection.ts:getStats —
// it's `new Map(JSON.parse(nativeJson))`). libwebrtc implements the W3C stats spec, so the
// `inbound-rtp` (kind: 'audio') report carries `audioLevel` (0..1, the most recent frame) and
// `totalAudioEnergy` / `totalSamplesDuration` (use these for a smoothed RMS if audioLevel is flaky).
//
// We poll the inbound (remote = Hop's voice) report on an interval and emit a smoothed 0..1 level.
// That level drives the mascot jaw + secondary motion instead of the canned on/off loop.
//
// Verify on-device with `attachAudioLevelProbe(pc, l => console.log('lvl', l.toFixed(2)))` and watch
// Metro logs while Hop talks — the number should track loudness. If `audioLevel` is always
// undefined, fall back to the energy delta (computeFromEnergy) which libwebrtc fills more reliably.

type StatsReport = Map<string, any>;

export interface AudioLevelOptions {
  /** Poll cadence in ms. 50ms (~20fps) is smooth enough for a jaw without burning battery. */
  intervalMs?: number;
  /** Smoothing: fast attack (mouth opens quickly), slow release (closes gently). 0..1 per tick. */
  attack?: number;
  release?: number;
}

/** Pull a 0..1 instantaneous level out of one getStats() report, preferring audioLevel. */
export function readInboundAudioLevel(report: StatsReport, prev?: { energy: number; dur: number }): {
  level: number | undefined;
  energy?: number;
  dur?: number;
} {
  let chosen: any;
  report.forEach((s: any) => {
    if (s && s.type === 'inbound-rtp' && (s.kind === 'audio' || s.mediaType === 'audio')) chosen = s;
  });
  if (!chosen) return { level: undefined };

  // Preferred: direct audioLevel (0..1).
  if (typeof chosen.audioLevel === 'number') {
    return { level: clamp01(chosen.audioLevel), energy: chosen.totalAudioEnergy, dur: chosen.totalSamplesDuration };
  }

  // Fallback: derive RMS from the energy/duration deltas between polls.
  if (typeof chosen.totalAudioEnergy === 'number' && typeof chosen.totalSamplesDuration === 'number' && prev) {
    const dE = chosen.totalAudioEnergy - prev.energy;
    const dT = chosen.totalSamplesDuration - prev.dur;
    const rms = dT > 0 ? Math.sqrt(dE / dT) : 0;
    return { level: clamp01(rms), energy: chosen.totalAudioEnergy, dur: chosen.totalSamplesDuration };
  }

  return { level: undefined, energy: chosen.totalAudioEnergy, dur: chosen.totalSamplesDuration };
}

/**
 * Start polling getStats() and feed a smoothed 0..1 level to `onLevel`.
 * Returns a stop() to clear the interval.
 */
export function attachAudioLevelProbe(
  pc: { getStats: () => Promise<StatsReport> },
  onLevel: (level: number) => void,
  opts: AudioLevelOptions = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 50;
  const attack = opts.attack ?? 0.6;
  const release = opts.release ?? 0.18;

  let smoothed = 0;
  let prev: { energy: number; dur: number } | undefined;
  let alive = true;

  const tick = async () => {
    if (!alive) return;
    try {
      const report = await pc.getStats();
      const { level, energy, dur } = readInboundAudioLevel(report, prev);
      if (energy !== undefined && dur !== undefined) prev = { energy, dur };
      if (level !== undefined) {
        const k = level > smoothed ? attack : release;
        smoothed += (level - smoothed) * k;
        onLevel(smoothed);
      }
    } catch {
      /* transient getStats failure — skip this tick */
    }
  };

  const id = setInterval(tick, intervalMs);
  return () => { alive = false; clearInterval(id); };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
