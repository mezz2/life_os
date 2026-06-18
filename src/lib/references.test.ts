import { describe, it, expect } from "vitest";
import { normaliseUrl, hostOf, inferSource, groupBySource } from "./references";

describe("normaliseUrl", () => {
  it("keeps full urls, trims, nulls empty", () => {
    expect(normaliseUrl("  https://x.com/a ")).toBe("https://x.com/a");
    expect(normaliseUrl("")).toBeNull();
    expect(normaliseUrl(null)).toBeNull();
  });
  it("prepends https to bare domains", () => {
    expect(normaliseUrl("example.com/path")).toBe("https://example.com/path");
    expect(normaliseUrl("youtu.be/abc")).toBe("https://youtu.be/abc");
  });
  it("leaves non-url free text alone", () => {
    expect(normaliseUrl("just a note")).toBe("just a note");
  });
});

describe("hostOf", () => {
  it("extracts host without www", () => {
    expect(hostOf("https://www.youtube.com/watch?v=1")).toBe("youtube.com");
    expect(hostOf("open.spotify.com/playlist/x")).toBe("open.spotify.com");
  });
  it("is null for junk", () => {
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});

describe("inferSource", () => {
  it("maps known providers", () => {
    expect(inferSource("https://youtu.be/abc")).toBe("youtube");
    expect(inferSource("https://www.youtube.com/watch?v=1")).toBe("youtube");
    expect(inferSource("https://open.spotify.com/playlist/x")).toBe("spotify");
    expect(inferSource("https://pubmed.ncbi.nlm.nih.gov/123")).toBe("pubmed");
    expect(inferSource("https://docs.google.com/document/d/x")).toBe("drive");
    expect(inferSource("https://arxiv.org/abs/2401.0001")).toBe("arxiv");
  });
  it("falls back to host then web", () => {
    expect(inferSource("https://example.com/a")).toBe("example.com");
    expect(inferSource("not a url")).toBe("web");
  });
});

describe("groupBySource", () => {
  it("groups and sorts by count desc", () => {
    const refs = [
      { source: "youtube" },
      { source: "youtube" },
      { source: "web" },
    ];
    const g = groupBySource(refs);
    expect(g[0].source).toBe("youtube");
    expect(g[0].items).toHaveLength(2);
    expect(groupBySource([{ source: null }]).find((x) => x.source === "web")!.items).toHaveLength(1); // null → web
  });
});
