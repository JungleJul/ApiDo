import { describe, expect, test } from "vitest";

import { buildArtifactFileName, sanitizeArtifactLabel } from "../src/core/debug-artifacts";

describe("sanitizeArtifactLabel", () => {
  test("keeps ascii-safe path segments", () => {
    expect(sanitizeArtifactLabel("topic 1515/latest?foo=1")).toBe("topic-1515-latest-foo-1");
  });
});

describe("buildArtifactFileName", () => {
  test("builds deterministic html artifact names", () => {
    expect(
      buildArtifactFileName({
        label: "latest list",
        timestamp: "2026-04-07T13:15:16.000Z",
        extension: "html"
      })
    ).toBe("2026-04-07T13-15-16.000Z-latest-list.html");
  });
});
