import { describe, it, expect, vi } from "vitest";
import {
  validateShortcut, validateMessage, normalizeKeywords, matchesSearch, sortReplies,
  hasDraft, sniffImageType, validateImageMeta, getSavedReplyImages, movePicture, removedPicturePaths,
  validatePictureCount, loadSavedReplyFiles, type SavedReply, type SavedReplyImage,
} from "./savedReplies";

const r = (o: Partial<SavedReply>): SavedReply => ({
  id: "x", shortcut: "abc", message: "m", keywords: [], image_path: null, image_name: null,
  image_mime_type: null, image_size: null, created_by: "u", use_count: 0, last_used_at: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...o,
});

describe("0–4 ordered pictures", () => {
  const image = (path: string, position: number): SavedReplyImage => ({ image_path: path,
    image_name: `${path}.png`, image_mime_type: "image/png", image_size: 100, position });
  it("keeps text-only entries empty", () => expect(getSavedReplyImages(r({}))).toEqual([]));
  it("falls back to the unchanged legacy picture at position zero", () => {
    expect(getSavedReplyImages(r({ image_path: "original", image_name: "original.png",
      image_mime_type: "image/png", image_size: 100, images: [] }))).toEqual([image("original", 0)]);
  });
  it("prefers child records in position order", () => {
    expect(getSavedReplyImages(r({ image_path: "legacy", images: [image("b", 1), image("a", 0)] }))
      .map((i) => i.image_path)).toEqual(["a", "b"]);
  });
  it("accepts four pictures", () => expect(validatePictureCount(4)).toBeNull());
  it("rejects a fifth picture", () => expect(validatePictureCount(5)).not.toBeNull());
  it("reorders without dropping or mutating retained pictures", () => {
    const before = [image("a", 0), image("b", 1), image("c", 2), image("d", 3)];
    const after = movePicture(before, 0, 3);
    expect(after.map((i) => i.image_path)).toEqual(["b", "c", "d", "a"]);
    expect(before.map((i) => i.image_path)).toEqual(["a", "b", "c", "d"]);
    expect(removedPicturePaths(before, after)).toEqual([]);
  });
  it("queues only the removed/replaced path", () => {
    expect(removedPicturePaths([image("a", 0), image("b", 1)], [image("a", 0), image("new", 1)]))
      .toEqual(["b"]);
  });
  it("keeps downloaded files ordered even when completion order differs", async () => {
    const download = vi.fn(async (i: SavedReplyImage) => {
      if (i.position === 0) await new Promise((resolve) => setTimeout(resolve, 10));
      return { name: i.image_name } as File;
    });
    expect((await loadSavedReplyFiles([image("a", 0), image("b", 1)], download)).map((f) => f.name))
      .toEqual(["a.png", "b.png"]);
  });
  it("rejects the whole selection when any download fails", async () => {
    const apply = vi.fn();
    await expect(loadSavedReplyFiles([image("a", 0), image("b", 1)], async (i) => {
      if (i.position === 1) throw new Error("missing");
      return { name: i.image_name } as File;
    }).then(apply)).rejects.toThrow("missing");
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("shortcut", () => {
  it("rejects under 3 chars after trim", () => expect(validateShortcut("  ab  ")).not.toBeNull());
  it("accepts 3 chars", () => expect(validateShortcut("abc")).toBeNull());
  it("rejects 51 chars", () => expect(validateShortcut("a".repeat(51))).not.toBeNull());
  it("accepts 50 chars", () => expect(validateShortcut("a".repeat(50))).toBeNull());
});

describe("message", () => {
  it("rejects whitespace only", () => expect(validateMessage("   \n ")).not.toBeNull());
  it("rejects 1001 chars", () => expect(validateMessage("a".repeat(1001))).not.toBeNull());
  it("accepts 1000 chars", () => expect(validateMessage("a".repeat(1000))).toBeNull());
});

describe("keywords", () => {
  it("trims, collapses whitespace and dedupes case-insensitively", () =>
    expect(normalizeKeywords([" Visa  fee ", "visa fee", "", "តម្លៃ", "តម្លៃ"])).toEqual(["Visa fee", "តម្លៃ"]));
});

describe("search", () => {
  const item = r({ shortcut: "Greeting", message: "Hello there", keywords: ["សួស្តី", "hi"] });
  it("matches shortcut case-insensitively", () => expect(matchesSearch(item, "greet")).toBe(true));
  it("matches message", () => expect(matchesSearch(item, "THERE")).toBe(true));
  it("matches keyword", () => expect(matchesSearch(item, "hi")).toBe(true));
  it("matches Khmer", () => expect(matchesSearch(item, "សួស")).toBe(true));
  it("no match", () => expect(matchesSearch(item, "visa")).toBe(false));
});

describe("sort", () => {
  const a = r({ id: "a", shortcut: "beta", use_count: 5, last_used_at: "2026-01-02T00:00:00Z", created_at: "2026-01-01T00:00:00Z" });
  const b = r({ id: "b", shortcut: "alpha", use_count: 1, last_used_at: "2026-01-05T00:00:00Z", created_at: "2026-01-03T00:00:00Z" });
  const c = r({ id: "c", shortcut: "gamma", use_count: 0, last_used_at: null, created_at: "2026-01-02T00:00:00Z" });
  const ids = (l: SavedReply[]) => l.map((x) => x.id);
  it("frequent", () => expect(ids(sortReplies([c, b, a], "frequent"))).toEqual(["a", "b", "c"]));
  it("recently used", () => expect(ids(sortReplies([a, c, b], "recent_used"))).toEqual(["b", "a", "c"]));
  it("recently created", () => expect(ids(sortReplies([a, b, c], "recent_created"))).toEqual(["b", "c", "a"]));
  it("alphabetical", () => expect(ids(sortReplies([a, c, b], "alpha"))).toEqual(["b", "a", "c"]));
});

describe("draft detection", () => {
  it("empty", () => expect(hasDraft({ text: "  ", fileCount: 0, hasRecordedAudio: false })).toBe(false));
  it("text", () => expect(hasDraft({ text: "x", fileCount: 0, hasRecordedAudio: false })).toBe(true));
  it("files", () => expect(hasDraft({ text: "", fileCount: 1, hasRecordedAudio: false })).toBe(true));
  it("audio", () => expect(hasDraft({ text: "", fileCount: 0, hasRecordedAudio: true })).toBe(true));
});

describe("images", () => {
  it("sniffs jpeg", () => expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe("image/jpeg"));
  it("sniffs png", () => expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png"));
  it("rejects gif bytes", () => expect(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull());
  it("rejects gif type", () => expect(validateImageMeta("image/gif", 100)).not.toBeNull());
  it("rejects over 10 MB", () => expect(validateImageMeta("image/png", 10 * 1024 * 1024 + 1)).not.toBeNull());
  it("accepts exactly 10 MB", () => expect(validateImageMeta("image/png", 10 * 1024 * 1024)).toBeNull());
  it("rejects 0 bytes", () => expect(validateImageMeta("image/png", 0)).not.toBeNull());
});
