// Device-independent proof of the Phase 5 mascot signal plumbing.
//
// interpretEvent() turns raw Realtime data-channel events into {speaking, pulse, functionCall}.
// This is the glue that drives the frog's talking state and the celebrate trigger, so we test
// it in plain Node (it has no react-native imports by design).
//
// Needs: typescript.

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
  'data:text/javascript;base64,' + b64(tx(readFileSync(join(here, 'src', 'realtimeEvents.ts'), 'utf8')))
);
const { interpretEvent } = mod;

const checks = [];
const check = (label, cond) => checks.push([label, !!cond]);

// speaking on/off from the WebRTC output-audio-buffer events
check('buffer.started -> speaking true', interpretEvent({ type: 'output_audio_buffer.started' }).speaking === true);
check('buffer.stopped -> speaking false', interpretEvent({ type: 'output_audio_buffer.stopped' }).speaking === false);
check('buffer.cleared -> speaking false', interpretEvent({ type: 'output_audio_buffer.cleared' }).speaking === false);

// transcript delta -> a mouth pulse AND keeps speaking alive
const d = interpretEvent({ type: 'response.audio_transcript.delta', delta: 'hel' });
check('transcript delta -> pulse', d.pulse === true);
check('transcript delta -> speaking true', d.speaking === true);

// response end -> speaking false (safety)
check('response.done -> speaking false', interpretEvent({ type: 'response.done' }).speaking === false);
check('response.cancelled -> speaking false', interpretEvent({ type: 'response.cancelled' }).speaking === false);

// function call passthrough
const fc = interpretEvent({
  type: 'response.function_call_arguments.done',
  name: 'fill_form',
  call_id: 'call_123',
  arguments: '{"country":"RO"}',
});
check('function_call -> name', fc.functionCall?.name === 'fill_form');
check('function_call -> call_id', fc.functionCall?.call_id === 'call_123');
check('function_call -> arguments', fc.functionCall?.arguments === '{"country":"RO"}');
check('function_call -> no speaking field', fc.speaking === undefined);

// unrelated / malformed events are inert
check('unknown event -> empty signal', Object.keys(interpretEvent({ type: 'response.created' })).length === 0);
check('null event -> empty signal', Object.keys(interpretEvent(null)).length === 0);
check('no-type event -> empty signal', Object.keys(interpretEvent({ foo: 1 })).length === 0);

let allPass = true;
console.log('\n  Phase 5 mascot-signal proof\n');
for (const [label, pass] of checks) {
  console.log(`   ${pass ? '✅' : '❌'}  ${label}`);
  if (!pass) allPass = false;
}
console.log('');
if (!allPass) { console.error('  ❌ Phase 5 proof FAILED\n'); process.exit(1); }
console.log('  ✅ Phase 5 proof PASSED — Realtime events map to the right mascot signals.\n');
