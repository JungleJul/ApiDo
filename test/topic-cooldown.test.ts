import { describe, expect, test } from "vitest";

import { shouldDeepReadTopic } from "../src/core/topic-cooldown";

describe("shouldDeepReadTopic", () => {
  test("allows topic deep read when there is no previous read", () => {
    expect(shouldDeepReadTopic(null, 30, new Date("2026-04-07T12:00:00.000Z"))).toBe(true);
  });

  test("blocks topic deep read within cooldown window", () => {
    expect(
      shouldDeepReadTopic("2026-04-07T11:45:01.000Z", 30, new Date("2026-04-07T12:00:00.000Z"))
    ).toBe(false);
  });

  test("allows topic deep read when cooldown window passed", () => {
    expect(
      shouldDeepReadTopic("2026-04-07T11:29:59.000Z", 30, new Date("2026-04-07T12:00:00.000Z"))
    ).toBe(true);
  });
});
