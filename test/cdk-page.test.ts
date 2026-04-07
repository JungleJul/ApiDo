import { describe, expect, test } from "vitest";

import { analyzeCdkPageText } from "../src/core/cdk-page";

describe("analyzeCdkPageText", () => {
  test("recognizes an out-of-stock page from noisy saved html", () => {
    const result = analyzeCdkPageText(`
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <title>wbz小站100个邀请码 - LINUX DO CDK</title>
          <style>.hidden { display: none; }</style>
          <script>window.__SINGLE_FILE__ = true;</script>
        </head>
        <body>
          <div>2026/04/07 18:01:00 - 2026/04/08 18:59:59</div>
          <div class="text-right space-y-2">
            <div class="text-sm text-muted-foreground"><span>剩余</span><span>名额</span></div>
            <div class="text-4xl font-bold">0</div>
            <div class="text-sm text-muted-foreground"><span>共</span><span>100</span><span>个</span></div>
          </div>
          <button><span>库存</span><span>已空</span></button>
          <iframe title="hCaptcha">请再试一次</iframe>
        </body>
      </html>
    `);

    expect(result).toMatchObject({
      remainingQuota: 0,
      totalQuota: 100,
      status: "OUT_OF_STOCK"
    });
  });

  test("recognizes a claimable page from noisy saved html", () => {
    const result = analyzeCdkPageText(`
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <title>项目分发测试 - LINUX DO CDK</title>
          <style>.hidden { display: none; }</style>
          <script>window.__SINGLE_FILE__ = true;</script>
        </head>
        <body>
          <div>2026/04/07 19:25:00 - 2026/04/08 19:25:00</div>
          <div class="text-right space-y-2">
            <div class="text-sm text-muted-foreground"><span>剩余</span><span>名额</span></div>
            <div class="text-4xl font-bold">6</div>
            <div class="text-sm text-muted-foreground"><span>共</span><span>6</span><span>个</span></div>
          </div>
          <button><span>立即</span><span>领取</span></button>
          <iframe title="hCaptcha">检查</iframe>
        </body>
      </html>
    `);

    expect(result).toMatchObject({
      remainingQuota: 6,
      totalQuota: 6,
      status: "CLAIMABLE"
    });
  });

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
