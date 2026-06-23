// WEB twin of realtime.ts — OpenAI Realtime over the browser's NATIVE WebRTC.
//
// Same flow as the native file (mint token → peer connection + mic + data channel → POST SDP to
// OpenAI → audio both ways → surface function calls), but:
//   • RTCPeerConnection / getUserMedia are browser globals — no react-native-webrtc.
//   • Hoppy's voice plays through a hidden <audio> element — browsers don't auto-play remote
//     tracks, and there's no loudspeaker routing to do (no InCallManager).
// The data-channel parsing, tool-call surfacing and getStats() lip-sync probe are shared logic
// (audioLevel.ts works as-is because browser getStats() returns a Map-like RTCStatsReport).

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

export async function connectRealtime(opts: ConnectOpts = {}): Promise<RealtimeHandle> {
  const status = (s: string) => opts.onStatus?.(s);

  // 1) Mint an ephemeral token from our backend.
  status('Getting session token…');
  const tokenRes = await fetch(`${BACKEND_URL}/realtime/token`, { method: 'POST' });
  if (!tokenRes.ok) throw new Error(`token endpoint ${tokenRes.status}: ${await tokenRes.text()}`);
  const token = await tokenRes.json();
  const ephemeralKey: string = token.value;
  if (!ephemeralKey) throw new Error('no .value in token response');

  // 2) Peer connection + microphone + data channel.
  status('Setting up audio…');
  const pc = new RTCPeerConnection({ iceServers: [] });

  // Hidden <audio> element actually plays Hoppy's voice (the browser won't auto-play the remote
  // track on its own). autoplay + playsInline is the iOS-Safari-friendly combo.
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.setAttribute('playsinline', 'true');
  audioEl.style.display = 'none';
  document.body.appendChild(audioEl);

  let stopLevelProbe: (() => void) | null = null;
  pc.addEventListener('track', (e: RTCTrackEvent) => {
    if (e.track.kind === 'audio') {
      audioEl.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      // play() can reject if the gesture window lapsed; the mic-permission grant usually counts as
      // activation, so this normally succeeds. Ignore the rejection either way.
      audioEl.play().catch(() => {});
      status('🐸 Hoppy is connected — say hi!');
      if (opts.onLevel && !stopLevelProbe) {
        stopLevelProbe = attachAudioLevelProbe(pc as any, opts.onLevel);
      }
    }
  });

  const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  mic.getTracks().forEach((t) => pc.addTrack(t, mic));

  const dc = pc.createDataChannel('oai-events');
  const send = (event: any) => {
    try {
      if (dc.readyState === 'open') dc.send(JSON.stringify(event));
    } catch {
      /* ignore send errors */
    }
  };

  const handleMessage = (e: MessageEvent) => {
    const raw = e.data;
    const text = typeof raw === 'string' ? raw : null;
    if (!text) return;
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }

    const sig = interpretEvent(msg);
    if (sig.functionCall) opts.onFunctionCall?.(sig.functionCall);
    if (sig.speaking !== undefined) opts.onSpeakingChange?.(sig.speaking);
    if (sig.pulse) opts.onAudioPulse?.();

    opts.onEvent?.(msg);
  };
  dc.addEventListener('message', handleMessage);
  dc.addEventListener('open', () => status('Channel open. Listening…'));

  // 3) Offer -> OpenAI -> answer.
  status('Connecting to Hoppy…');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(OPENAI_CALLS_URL, {
    method: 'POST',
    body: offer.sdp,
    headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
  });
  if (!sdpRes.ok) throw new Error(`realtime/calls ${sdpRes.status}: ${await sdpRes.text()}`);

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

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
        mic.getTracks().forEach((t) => t.stop());
        pc.close();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {
        /* ignore */
      }
    },
  };
}
