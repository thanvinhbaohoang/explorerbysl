/**
 * Convert browser-recorded audio (webm/opus, mp4/aac, ogg) to MP3.
 * Messenger's Send API only reliably renders MP3 voice attachments;
 * webm/opus and ogg/opus return 0:00 duration and refuse to play.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

const TARGET_SAMPLE_RATE = 44100;
const MP3_BITRATE_KBPS = 64; // mono voice

/** Linear resample a Float32 channel to a new sample rate. */
const resample = (input: Float32Array, fromRate: number, toRate: number): Float32Array => {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const newLength = Math.round(input.length / ratio);
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
};

const floatToInt16 = (input: Float32Array): Int16Array => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

/**
 * Convert any browser-decodable audio Blob into an MP3 File.
 * Returns a mono 44.1kHz MP3 suitable for Messenger voice messages.
 */
export const convertBlobToMp3 = async (blob: Blob): Promise<File> => {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) throw new Error("AudioContext not supported in this browser");

  const ctx = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    // Best-effort close; some browsers (Safari) may throw if already closed.
    try { await ctx.close(); } catch { /* noop */ }
  }

  // Downmix to mono.
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  // Resample to 44.1kHz.
  const resampled = resample(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
  const samples = floatToInt16(resampled);

  // Encode MP3.
  const encoder = new Mp3Encoder(1, TARGET_SAMPLE_RATE, MP3_BITRATE_KBPS);
  const chunkSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    const chunk = samples.subarray(i, i + chunkSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
  }
  const flush = encoder.flush();
  if (flush.length > 0) chunks.push(new Uint8Array(flush));

  const mp3Blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
  const fileName = `voice_${Date.now()}.mp3`;
  return new File([mp3Blob], fileName, { type: "audio/mpeg" });
};
