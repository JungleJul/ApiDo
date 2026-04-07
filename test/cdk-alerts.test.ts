import { describe, expect, test } from "vitest";

import { getManualClaimAlertPlan } from "../src/core/cdk-alerts";

describe("getManualClaimAlertPlan", () => {
  test("schedules a three-minute early reminder for waiting CDKs", () => {
    expect(
      getManualClaimAlertPlan(
        {
          startAt: "2026-04-07T11:25:00.000Z",
          endAt: "2026-04-07T12:25:00.000Z"
        },
        new Date("2026-04-07T11:00:00.000Z")
      )
    ).toEqual({
      status: "WAITING",
      notifyAt: "2026-04-07T11:22:00.000Z",
      shouldNotifyImmediately: false,
      message: "活动将在 3 分钟后开始，请准备手动完成二次校验。"
    });
  });

  test("notifies immediately when already within the three-minute window but not started", () => {
    expect(
      getManualClaimAlertPlan(
        {
          startAt: "2026-04-07T11:25:00.000Z",
          endAt: "2026-04-07T12:25:00.000Z"
        },
        new Date("2026-04-07T11:23:30.000Z")
      )
    ).toEqual({
      status: "WAITING",
      notifyAt: "2026-04-07T11:25:00.000Z",
      shouldNotifyImmediately: true,
      message: "活动即将开始，请准备手动完成二次校验。"
    });
  });

  test("notifies immediately when the CDK is already claimable and should stay manual", () => {
    expect(
      getManualClaimAlertPlan(
        {
          startAt: "2026-04-07T11:25:00.000Z",
          endAt: "2026-04-07T12:25:00.000Z"
        },
        new Date("2026-04-07T11:25:01.000Z")
      )
    ).toEqual({
      status: "CLAIMABLE",
      notifyAt: null,
      shouldNotifyImmediately: true,
      message: "CDK 现在可以手动领取，领取时会弹出二次校验。"
    });
  });
});
