// Client-side audio transcoder: decodes any browser-recorded audio blob
// (typically WebM/Opus on desktop Chrome/Firefox) and re-encodes it to MP3
// so it plays reliably as a Facebook Messenger audio attachment.
//
// lamejs is a pure-JS MP3 encoder (no native deps), safe for the browser.
import { Mp3Encoder } from "@breezystack/lamejs";

const MESSENGER_FRIENDLY = /^(audio\/(mpeg|mp3|mp4|m4a|aac|wav|wave|x-wav))/i;

export function isMessengerFriendlyAudio(file: File | Blob): boolean {
  return MESSENGER_FRIENDLY.test(file.type || "");
}

/**
 * Convert an arbitrary audio Blob to a mono 64 kbps MP3 Blob.
 * Yields to the event loop between frames so long clips don't freeze the UI.
 */
export async function convertToMp3(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  // Safari uses webkitAudioContext.
  const Ctx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }

  // Downmix to mono.
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  if (numChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) mono[i] = (left[i] + right[i]) * 0.5;
  }

  // Float32 [-1,1] -> Int16 PCM.
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const sampleRate = audioBuffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 64);
  const mp3Chunks: Uint8Array[] = [];
  const frameSize = 1152;

  for (let i = 0; i < pcm.length; i += frameSize) {
    const slice = pcm.subarray(i, i + frameSize);
    const enc = encoder.encodeBuffer(slice);
    if (enc.length > 0) mp3Chunks.push(enc);
    // Yield every ~50 frames (~1.3s of audio) to keep UI responsive.
    if ((i / frameSize) % 50 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  const tail = encoder.flush();
  if (tail.length > 0) mp3Chunks.push(tail);

  return new Blob(mp3Chunks as BlobPart[], { type: "audio/mpeg" });
}
