import { at } from "./time";
import type { MetricSeries } from "./types";

const MINUTES = [
  "09:30",
  "09:35",
  "09:40",
  "09:45",
  "09:50",
  "09:55",
  "09:58",
  "10:00",
  "10:01",
  "10:02",
  "10:03",
  "10:04",
  "10:05",
  "10:06",
  "10:07",
  "10:08",
  "10:10",
  "10:11",
  "10:12",
  "10:13",
  "10:15",
  "10:16",
  "10:17",
  "10:18",
  "10:20",
  "10:21",
  "10:22",
  "10:23",
  "10:24",
  "10:25",
];

function points(values: number[]) {
  if (values.length !== MINUTES.length) {
    throw new Error(`metric needs ${MINUTES.length} points, got ${values.length}`);
  }
  return values.map((value, index) => ({ at: at(MINUTES[index]), value }));
}

export const metrics: MetricSeries[] = [
  {
    id: "metric-checkout-p95-latency",
    service: "checkout-api",
    metric: "p95_latency_ms",
    unit: "ms",
    description: "checkout-api POST /checkout p95 latency",
    points: points([
      178, 182, 190, 185, 181, 184, 186, 1420, 2640, 2580, 1120, 760, 2710, 2820, 1310, 880, 2690,
      2750, 1240, 900, 2600, 2700, 1350, 930, 2580, 2650, 1290, 980, 2400, 2410,
    ]),
  },
  {
    id: "metric-checkout-5xx-ratio",
    service: "checkout-api",
    metric: "http_5xx_ratio_pct",
    unit: "%",
    description: "checkout-api share of responses that are HTTP 5xx",
    points: points([
      0.2, 0.1, 0.3, 0.2, 0.2, 0.1, 0.2, 2.8, 4.1, 4.6, 2.2, 1.4, 5.3, 5.9, 2.7, 1.8, 5.6, 6.1, 2.5,
      1.9, 5.4, 5.8, 2.6, 2.0, 5.1, 5.5, 2.4, 2.1, 5.0, 4.9,
    ]),
  },
  {
    id: "metric-ordersdb-connections",
    service: "orders-db",
    metric: "active_connections",
    unit: "connections (max 100)",
    description: "orders-db-primary active client connections",
    points: points([
      52, 55, 58, 56, 57, 57, 58, 96, 98, 98, 85, 83, 100, 100, 100, 100, 100, 100, 99, 98, 100,
      100, 100, 99, 100, 100, 100, 99, 99, 100,
    ]),
  },
  {
    id: "metric-reporting-worker-running-jobs",
    service: "reporting-worker",
    metric: "running_export_jobs",
    unit: "jobs",
    description: "reporting-worker concurrently running export jobs",
    points: points([
      0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 1, 1,
    ]),
  },
  {
    id: "metric-payments-gateway-p95",
    service: "payments-gateway",
    metric: "p95_latency_ms",
    unit: "ms",
    description: "payments-gateway (external PSP) p95 latency as seen by checkout-api",
    points: points([
      310, 305, 298, 312, 307, 301, 299, 304, 309, 311, 300, 296, 302, 308, 305, 299, 303, 306, 301,
      298, 304, 300, 307, 302, 305, 301, 299, 303, 300, 302,
    ]),
  },
  {
    id: "metric-logging-host-disk",
    service: "logging-host",
    metric: "disk_used_pct",
    unit: "%",
    description: "logging-host-02 /var/log disk usage",
    points: points([
      90.6, 89.4, 88.1, 87.9, 89.2, 89.8, 89.5, 91.1, 90.8, 90.2, 89.6, 89.9, 90.4, 90.9, 89.7,
      89.1, 90.3, 91.0, 90.1, 89.5, 90.7, 90.2, 89.8, 89.3, 90.5, 90.9, 89.9, 89.6, 90.4, 90.1,
    ]),
  },
];
