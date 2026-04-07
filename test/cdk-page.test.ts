import { describe, expect, test } from "vitest";

import { analyzeCdkPageText } from "../src/core/cdk-page";

describe("analyzeCdkPageText", () => {
  test("recognizes an out-of-stock page with zero remaining quota", () => {
    const result = analyzeCdkPageText(`
      2026/04/07 18:01:00 - 2026/04/08 18:59:59
      剩余名额
      0
      共 100 个
      库存已空
    `);

    expect(result).toMatchObject({
      remainingQuota: 0,
      totalQuota: 100,
      status: "OUT_OF_STOCK"
    });
  });

  test("recognizes a claimable page with remaining quota and claim button", () => {
    const result = analyzeCdkPageText(`
      2026/04/07 19:25:00 - 2026/04/08 19:25:00
      剩余名额
      6
      共 6 个
      立即领取
    `);

    expect(result).toMatchObject({
      remainingQuota: 6,
      totalQuota: 6,
      status: "CLAIMABLE"
    });
  });

  test("recognizes ended pages from explicit status text", () => {
    const result = analyzeCdkPageText(`
      2026/04/07 19:25:00 - 2026/04/08 19:25:00
      项目已结束
    `);

    expect(result.status).toBe("ENDED");
  });

  test("recognizes claimed pages from success text", () => {
    const result = analyzeCdkPageText(`
      2026/04/07 19:25:00 - 2026/04/08 19:25:00
      已领取
    `);

    expect(result.status).toBe("CLAIMED");
  });
});
