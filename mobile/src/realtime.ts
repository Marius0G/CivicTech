// Client-side OpenAI Realtime connection over WebRTC.
//
// Flow (mirrors the verified backend):
//   1. POST {BACKEND_URL}/realtime/token  -> { value: "ek_..." }
//   2. RTCPeerConnection: add mic track, open "oai-events" data channel
//   3. POST our SDP offer to OpenAI /v1/realtime/calls with Bearer ek_...
//   4. setRemoteDescription(answer) -> audio flows both ways
//   5. route audio to the LOUDSPEAKER (InCallManager)
//   6. on function-call events: surface them to onFunctionCall for routing
//
// Tools are registered SERVER-SIDE at session creation (see backend), so we don't send them
// from here anymore. Requires react-native-webrtc + react-native-incall-manager (dev client).

import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { BACKEND_URL, OPENAI_CALLS_URL } from './config';
import { interpretEvent, FunctionCall } from './realtimeEvents';
import { attachAudioLevelProbe } from './audioLevel';

export type { FunctionCall };

export interface RealtimeHandle {
  pc: RTCPeerConnection;
  send: (event: any) => void;
  sendToolResult: (callId: string, output: string) => void;
  stop: () => void;
}

interface ConnectOpts {
  onStatus?: (s: string) => void;
  onEvent?: (event: any) => void;
  onFunctionCall?: (call: FunctionCall) => void;
  /** Hoppy started/stopped speaking — drives the mascot's talking animation. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** A spoken chunk arrived — pulse the mascot's mouth (rough lip-sync). */
  onAudioPulse?: () => void;
  /** Real 0..1 voice loudness sampled from getStats() — drives true lip-sync. */
  onLevel?: (level: number) => void;
  /** i18n code (e.g. "fr") so Hoppy greets/answers in the user's chosen language. */
  language?: string;
  /** OpenAI Realtime voice id (e.g. "cedar") so Hoppy uses the user's chosen voice. */
  voice?: string;
}

function forceSpeaker() {
  try { InCallManager.setForceSpeakerphoneOn(true); } catch {}
  try { (InCallManager as any).chooseAudioRoute?.('SPEAKER_PHONE'); } catch {}
  try { (InCallManager as any).setSpeakerphoneOn?.(true); } catch {}
}

// Idempotent: routeToSpeaker(true) is invoked both on the `track` event and after the SDP
// answer. Starting InCallManager twice can double the audio session (garbled/"doubled" voice),
// so only start once per call.
let speakerStarted = false;
function routeToSpeaker(on: boolean) {
  try {
    if (on) {
      if (!speakerStarted) {
        InCallManager.start({ media: 'audio', auto: false });
        speakerStarted = true;
      }
      forceSpeaker();
      // Re-assert after the WebRTC audio session settles (it can grab the route back).
      setTimeout(forceSpeaker, 800);
      setTimeout(forceSpeaker, 2000);
    } else {
      try { InCallManager.setForceSpeakerphoneOn(false); } catch {}
      InCallManager.stop();
      speakerStarted = false;
    }
  } catch {
    /* InCallManager unavailable — ignore, audio still plays (earpiece) */
  }
}

export async function connectRealtime(opts: ConnectOpts = {}): Promise<RealtimeHandle> {
  const status = (s: string) => opts.onStatus?.(s);

  // 1) Mint an ephemeral token from our backend (tell it which language + voice Hoppy should use).
  status('Getting session token…');
  const tokenRes = await fetch(`${BACKEND_URL}/realtime/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: opts.language ?? 'en', voice: opts.voice }),
  });
  if (!tokenRes.ok) throw new Error(`token endpoint ${tokenRes.status}: ${await tokenRes.text()}`);
  const token = await tokenRes.json();
  const ephemeralKey: string = token.value;
  if (!ephemeralKey) throw new Error('no .value in token response');

  // 2) Peer connection + microphone + data channel.
  status('Setting up audio…');
  const pc = new RTCPeerConnection({ iceServers: [] });

  let stopLevelProbe: (() => void) | null = null;
  // @ts-ignore - RN event API
  pc.addEventListener('track', (e: any) => {
    if (e.track?.kind === 'audio') {
      routeToSpeaker(true); // play Hoppy through the loudspeaker
      status('🐸 Hoppy is connected — say hi!');
      // Real loudness envelope for lip-sync (drives the mascot jaw). Started once Hoppy's audio
      // track arrives; getStats() reports its inbound audioLevel. No-op if no listener is wired.
      if (opts.onLevel && !stopLevelProbe) {
        stopLevelProbe = attachAudioLevelProbe(pc, opts.onLevel);
      }
    }
  });

  const mic: MediaStream = await mediaDevices.getUserMedia({ audio: true });
  mic.getTracks().forEach((t) => pc.addTrack(t, mic));

  const dc = pc.createDataChannel('oai-events');
  const send = (event: any) => {
    try {
      // @ts-ignore - readyState exists on RN data channel
      if (dc.readyState === 'open') dc.send(JSON.stringify(event));
    } catch {
      /* ignore send errors */
    }
  };

  // Robust message handling: some RN frames arrive as non-string; normalize before parsing.
  const handleMessage = (e: any) => {
    const raw = e && e.data !== undefined ? e.data : e;
    let text: string | null = null;
    if (typeof raw === 'string') text = raw;
    else if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
      try { text = String(raw); } catch { text = null; }
    }
    if (!text) return;
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }

    const sig = interpretEvent(msg);
    if (sig.functionCall) opts.onFunctionCall?.(sig.functionCall);
    if (sig.speaking !== undefined) opts.onSpeakingChange?.(sig.speaking);
    if (sig.pulse) opts.onAudioPulse?.();

    opts.onEvent?.(msg);
  };
  // @ts-ignore - RN event API (attach both forms; runtimes differ)
  dc.addEventListener('message', handleMessage);
  // @ts-ignore
  dc.onmessage = handleMessage;
  // @ts-ignore
  dc.addEventListener('open', () => status('Channel open. Listening…'));

  // 3) Offer -> OpenAI -> answer.
  status('Connecting to Hoppy…');
  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(OPENAI_CALLS_URL, {
    method: 'POST',
    body: offer.sdp,
    headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
  });
  if (!sdpRes.ok) throw new Error(`realtime/calls ${sdpRes.status}: ${await sdpRes.text()}`);

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
  routeToSpeaker(true); // force loudspeaker once the call is up (also re-asserted on track)

  const sendToolResult = (callId: string, output: string) => {
    send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output },
    });
    send({ type: 'response.create' });
  };

  return {
    pc,
    send,
    sendToolResult,
    stop: () => {
      try {
        stopLevelProbe?.();
        stopLevelProbe = null;
        routeToSpeaker(false);
        mic.getTracks().forEach((t) => t.stop());
        pc.close();
      } catch {
        /* ignore */
      }
    },
  };
}
