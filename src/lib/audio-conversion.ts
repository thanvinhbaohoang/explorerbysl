// Client-side audio transcoder: decodes any browser-recorded audio blob
// (typically WebM/Opus on desktop Chrome/Firefox) and re-encodes it to a
// PCM-16 WAV blob. WAV is on Messenger's supported audio attachment list,
// requires no external library, and embeds duration directly via the RIFF
// header so the Messenger player shows the real length and plays back.

const MESSENGER_FRIENDLY = /^(audio\/(mpeg|mp3|mp4|m4a|aac|wav|wave|x-wav))/i;

export function isMessengerFriendlyAudio(file: File | Blob): boolean {
  return MESSENGER_FRIENDLY.test(file.type || "");
}

/**
 * Convert an arbitrary audio Blob to a mono 16-bit PCM WAV Blob.
 */
export async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

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

  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = 1 * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const out = new ArrayBuffer(bufferSize);
  const view = new DataView(out);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([out], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
