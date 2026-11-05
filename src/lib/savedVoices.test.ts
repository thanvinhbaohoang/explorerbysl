import { describe, it, expect } from "vitest";
import { sniffAudioType, validateVoiceSize, validateVoiceDuration, matchesVoiceSearch, parseKeywords, type SavedVoice } from "./savedVoices";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("saved voice rules", () => {
  it("accepts the four allowed formats by content", () => {
    expect(sniffAudioType(bytes(0x49, 0x44, 0x33, 0x04))).toBe("mp3");
    expect(sniffAudioType(bytes(0xff, 0xfb, 0x90))).toBe("mp3");
    expect(sniffAudioType(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70))).toBe("m4a");
    expect(sniffAudioType(bytes(0x4f, 0x67, 0x67, 0x53))).toBe("ogg");
    expect(sniffAudioType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("webm");
  });
  it("rejects a picture disguised as audio", () => {
    expect(sniffAudioType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBeNull();
  });
  it("limits size to 5 MB", () => {
    expect(validateVoiceSize(5 * 1024 * 1024)).toBeNull();
    expect(validateVoiceSize(5 * 1024 * 1024 + 1)).not.toBeNull();
  });
  it("requires 1 to 120 seconds", () => {
    expect(validateVoiceDuration(0.5)).not.toBeNull();
    expect(validateVoiceDuration(1)).toBeNull();
    expect(validateVoiceDuration(120)).toBeNull();
    expect(validateVoiceDuration(121)).not.toBeNull();
  });
  it("searches title and keywords", () => {
    const v = { title: "Visa welcome", keywords: ["china"] } as SavedVoice;
    expect(matchesVoiceSearch(v, "WELCOME")).toBe(true);
    expect(matchesVoiceSearch(v, "chin")).toBe(true);
    expect(matchesVoiceSearch(v, "thai")).toBe(false);
  });
  it("parses keywords without duplicates", () => {
    expect(parseKeywords(" a, b ,a,,")).toEqual(["a", "b"]);
  });
});
