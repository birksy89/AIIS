import { describe, expect, it } from "vitest";

import { getMetrics, getServiceContext, listDeploys, queryLogs } from "./query";
import { at } from "./time";

const noFilter = { service: null, pattern: null, level: null, since: null, until: null };

describe("time-gated tools", () => {
  it("returns nothing before the first Wave", () => {
    expect(queryLogs(noFilter, null).lines).toEqual([]);
    expect(listDeploys({ service: null, since: null }, null).deploys).toEqual([]);
  });

  it("never returns log lines after the replay clock", () => {
    const clock = at("10:02");
    const { lines } = queryLogs({ ...noFilter, service: "reporting-worker" }, clock);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => Date.parse(line.at) <= Date.parse(clock))).toBe(true);
    expect(lines.some((line) => line.message.includes("run=1005"))).toBe(false);
  });

  it("hides the rollback deploy until it has happened", () => {
    const before = listDeploys({ service: "checkout-api", since: null }, at("10:12"));
    const after = listDeploys({ service: "checkout-api", since: null }, at("10:25"));

    expect(before.deploys.map((d) => d.version)).toEqual(["v2.14.0"]);
    expect(after.deploys).toHaveLength(2);
  });

  it("cuts metric series at the replay clock", () => {
    const { series } = getMetrics({ service: "orders-db", metric: null }, at("10:05"));

    expect(series[0].points.at(-1)?.at).toBe(at("10:05"));
    expect(series[0].stats?.max).toBe(100);
  });

  it("filters logs by pattern case-insensitively", () => {
    const { lines } = queryLogs({ ...noFilter, pattern: "TOO MANY CLIENTS" }, at("10:25"));

    expect(lines.length).toBeGreaterThan(5);
  });

  it("returns dependents so blast radius can be traced", () => {
    const context = getServiceContext("orders-db");

    expect(context.found && context.dependents.map((d) => d.service)).toEqual([
      "checkout-api",
      "inventory-service",
      "orders-db-replica",
    ]);
  });
});
