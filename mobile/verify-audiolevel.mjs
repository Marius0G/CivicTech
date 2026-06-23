// Node test for the PURE part of the audio-level spike (readInboundAudioLevel).
// Transpiles audioLevel.ts on the fly (like verify-mascot.mjs does for realtimeEvents.ts) and
// asserts the stats-report -> 0..1 level extraction, both the audioLevel path and the energy
// fallback. Does NOT need a device — it feeds fake RTCStatsReport Maps.
//
// Run: node verify-audiolevel.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const b64 = (s) => Buffer.from(s).toString('base64');
const tx = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 },
  }).outputText;

const mod = await import(
  'data:text/javascript;base64,' + b64(tx(readFileSync(join(here, 'src', 'audioLevel.ts'), 'utf8')))
);
const { readInboundAudioLevel } = mod;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } };

const report = (entries) => new Map(entries.map((e) => [e.id, e]));

// 1) Direct audioLevel on inbound audio is read straight through.
{
  const r = report([
    { id: 'A', type: 'inbound-rtp', kind: 'audio', audioLevel: 0.42, totalAudioEnergy: 5, totalSamplesDuration: 10 },
    { id: 'B', type: 'outbound-rtp', kind: 'audio', audioLevel: 0.99 },
  ]);
  const { level } = readInboundAudioLevel(r);
  ok('reads inbound audioLevel', Math.abs(level - 0.42) < 1e-9);
}

// 2) audioLevel is clamped to 0..1.
{
  const r = report([{ id: 'A', type: 'inbound-rtp', kind: 'audio', audioLevel: 1.7 }]);
  ok('clamps >1', readInboundAudioLevel(r).level === 1);
}

// 3) Energy fallback: RMS from delta energy / delta duration when audioLevel absent.
{
  const prev = { energy: 1.0, dur: 9.0 };
  const r = report([{ id: 'A', type: 'inbound-rtp', kind: 'audio', totalAudioEnergy: 1.25, totalSamplesDuration: 10.0 }]);
  // dE=0.25, dT=1.0 -> rms=sqrt(0.25)=0.5
  ok('energy fallback rms', Math.abs(readInboundAudioLevel(r, prev).level - 0.5) < 1e-9);
}

// 4) No inbound audio report -> undefined (mascot keeps idle).
{
  const r = report([{ id: 'A', type: 'inbound-rtp', kind: 'video', audioLevel: 0.5 }]);
  ok('no audio report -> undefined', readInboundAudioLevel(r).level === undefined);
}

// 5) mediaType alias (older libwebrtc emits mediaType instead of kind).
{
  const r = report([{ id: 'A', type: 'inbound-rtp', mediaType: 'audio', audioLevel: 0.3 }]);
  ok('mediaType alias', Math.abs(readInboundAudioLevel(r).level - 0.3) < 1e-9);
}

console.log(`audio-level spike: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
