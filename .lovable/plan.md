## Goal

Eliminate the "underwater / muffled" distortion heard in recorded voice messages (visible already in the local preview, before sending).

## Root cause recap

In `src/hooks/useChatMessages.ts` `startRecording()`:

- `getUserMedia({ audio: true })` uses Chrome defaults — `autoGainControl` and `noiseSuppression` on, no channel/rate hints.
- An `AudioContext` + `AnalyserNode` is connected directly to the live mic stream. Chrome then resamples that stream through the context (often at a mismatched rate vs. the mic track), and the artifact ends up in what `MediaRecorder` captures.
- No `audioBitsPerSecond`, suboptimal codec preference order.

## Changes (single file: `src/hooks/useChatMessages.ts`)

### 1. Tighter mic constraints

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
  },
});
```

### 2. Better codec preference (adds Safari/iOS support)

```ts
const candidates = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/ogg;codecs=opus',
  'audio/webm',
];
const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
const fileExt =
  mimeType.startsWith('audio/mp4') ? 'm4a' :
  mimeType.startsWith('audio/ogg') ? 'ogg' : 'webm';
```

### 3. Explicit bitrate + timesliced start

```ts
const recorder = new MediaRecorder(stream, {
  mimeType,
  audioBitsPerSecond: 64000,
});
recorder.start(250);
```

### 4. Isolate the visualizer onto a cloned stream

The 5-bar animation keeps working, but `AudioContext` no longer touches the recording track:

```ts
const vizStream = stream.clone();
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(vizStream);
// ...connect analyser as today
```

In `recorder.onstop` and in `cancelRecording`, also stop `vizStream` tracks and close `audioContext`.

## Out of scope (per your decision)

- Telegram `sendVoice` behavior is unchanged — voice clips to Telegram will still go as native voice notes (Telegram re-encodes those server-side; that's a separate trade-off we'll leave alone).
- No changes to `messenger-webhook` / `telegram-bot` edge functions.
- No changes to playback UI in `ChatPanel.tsx`.

## Verification

1. Record on desktop Chrome with speakers active → local preview is clean (no underwater).
2. Switch output to Bluetooth headset, record again → still clean.
3. Record on Android Chrome → still clean.
4. Send to Messenger → recipient hears improved fidelity (no transcoding on that path).
5. Send to Telegram → still arrives as a native voice note; quality matches today (capture is cleaner but Telegram's voice-note encoding is the cap).
6. Confirm visualizer bars still animate while recording, and that stopping/canceling fully releases mic (no recording indicator left in browser tab).
