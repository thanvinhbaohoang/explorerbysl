import { describe, it, expect } from "vitest";
import { retrySrc } from "./SavedReplyThumbnail";

describe("retrySrc", () => {
  it("keeps the signed URL unchanged on normal load", () => {
    expect(retrySrc("https://x/a.jpg?token=t", 0)).toBe("https://x/a.jpg?token=t");
  });
  it("makes a different URL on retry even if signed URL is identical", () => {
    expect(retrySrc("https://x/a.jpg?token=t", 1)).toBe("https://x/a.jpg?token=t&r=1");
    expect(retrySrc("https://x/a.jpg", 2)).toBe("https://x/a.jpg?r=2");
  });
});
