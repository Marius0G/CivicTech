// Pure interpretation of OpenAI Realtime data-channel events -> app signals.
//
// Kept free of any react-native imports so it can be unit-tested in plain Node
// (see verify-mascot.mjs). realtime.ts feeds every parsed event through interpretEvent().

export interface FunctionCall {
  name: string;
  call_id: string;
  arguments: string; // JSON string
}

export interface EventSignal {
  /** Hop started/stopped producing audio (drives the mascot's talking state). */
  speaking?: boolean;
  /** A chunk of speech arrived — pulse the mouth (rough lip-sync without PCM access). */
  pulse?: boolean;
  /** The model wants to run a tool. */
  functionCall?: FunctionCall;
}

/**
 * Map one Realtime event to what the UI cares about. Over WebRTC, Hop's audio flows on the
 * media track (no PCM here), so we approximate lip-sync from the events that bracket and stream
 * speech:
 *   • output_audio_buffer.started/stopped  -> speaking on/off (WebRTC-specific server events)
 *   • response.audio_transcript.delta      -> a pulse per spoken chunk
 *   • response.done / response.cancelled   -> safety: speaking off
 *   • response.function_call_arguments.done-> a tool call
 */
export function interpretEvent(msg: any): EventSignal {
  const out: EventSignal = {};
  if (!msg || typeof msg.type !== 'string') return out;

  switch (msg.type) {
    case 'output_audio_buffer.started':
      out.speaking = true;
      break;
    case 'output_audio_buffer.stopped':
    case 'output_audio_buffer.cleared':
      out.speaking = false;
      break;
    case 'response.audio_transcript.delta':
    case 'response.output_audio_transcript.delta':
      out.pulse = true;
      out.speaking = true; // first delta can precede the buffer.started event
      break;
    case 'response.done':
    case 'response.cancelled':
      out.speaking = false;
      break;
    case 'response.function_call_arguments.done':
      out.functionCall = {
        name: msg.name,
        call_id: msg.call_id,
        arguments: msg.arguments,
      };
      break;
    default:
      break;
  }
  return out;
}
