import { describe, expect, test } from "vitest";

import { collectLinks, extractTopicId, normalizeTopicUrl } from "../src/core/urls";

describe("normalizeTopicUrl", () => {
  test("removes trailing reply number and query string from topic urls", () => {
    expect(normalizeTopicUrl("https://linux.do/t/topic/1795218/669?u=test")).toBe("https://linux.do/t/topic/1795218");
  });

  test("keeps canonical topic url intact", () => {
    expect(normalizeTopicUrl("https://linux.do/t/topic/1795218")).toBe("https://linux.do/t/topic/1795218");
  });
});

describe("extractTopicId", () => {
  test("extracts topic id from canonical url", () => {
    expect(extractTopicId("https://linux.do/t/topic/1795218")).toBe(1795218);
  });
});

describe("collectLinks", () => {
  test("splits cdk links from external links and deduplicates them", () => {
    expect(
      collectLinks([
        "https://linux.do/t/topic/1795218",
        "https://cdk.linux.do/activity/123",
        "https://example.com/offer",
        "https://example.com/offer",
        "https://foo.bar/page"
      ])
    ).toEqual({
      cdkLinks: ["https://cdk.linux.do/activity/123"],
      externalLinks: ["https://example.com/offer", "https://foo.bar/page"]
    });
  });
});
