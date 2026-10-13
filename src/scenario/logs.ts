import { at } from "./time";
import type { LogLine } from "./types";

type Raw = [time: string, level: LogLine["level"], message: string];

function series(service: string, prefix: string, rows: Raw[]): LogLine[] {
  return rows.map(([time, level, message], index) => ({
    id: `log-${prefix}-${String(index + 1).padStart(2, "0")}`,
    service,
    at: at(time),
    level,
    message,
  }));
}

const checkoutApi = series("checkout-api", "checkout", [
  ["09:35:02", "INFO", "pod=checkout-7f9c-a POST /checkout 200 174ms"],
  ["09:38:47", "INFO", "pod=checkout-7f9c-b POST /checkout 200 191ms"],
  [
    "09:40:12",
    "INFO",
    "pod=checkout-8a21-a starting checkout-api v2.14.0 (node-postgres 8.12.0) pg.pool.max=20",
  ],
  [
    "09:40:31",
    "INFO",
    "pod=checkout-8a21-b starting checkout-api v2.14.0 (node-postgres 8.12.0) pg.pool.max=20",
  ],
  [
    "09:40:49",
    "INFO",
    "pod=checkout-8a21-c starting checkout-api v2.14.0 (node-postgres 8.12.0) pg.pool.max=20",
  ],
  ["09:44:10", "INFO", "pod=checkout-8a21-a POST /checkout 200 186ms"],
  ["09:48:55", "INFO", "pod=checkout-8a21-c POST /checkout 200 179ms"],
  ["09:52:03", "WARN", "pod=checkout-8a21-b promo validation: unknown code 'SPOOKY10' (rejected)"],
  ["09:56:40", "INFO", "pod=checkout-8a21-a POST /checkout 200 183ms"],
  [
    "10:00:41",
    "ERROR",
    "pod=checkout-8a21-b POST /checkout 500 5004ms order insert failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  [
    "10:01:12",
    "ERROR",
    "pod=checkout-8a21-a POST /checkout 500 5001ms TimeoutError: timeout acquiring connection from pool after 5000ms (pool total=14 idle=0 waiting=31)",
  ],
  ["10:02:30", "INFO", "pod=checkout-8a21-c POST /checkout 200 2210ms"],
  ["10:03:58", "INFO", "pod=checkout-8a21-a POST /checkout 200 640ms"],
  [
    "10:05:19",
    "ERROR",
    "pod=checkout-8a21-c POST /checkout 500 5002ms order insert failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  [
    "10:06:02",
    "ERROR",
    "pod=checkout-8a21-b POST /checkout 500 5003ms TimeoutError: timeout acquiring connection from pool after 5000ms (pool total=11 idle=0 waiting=44)",
  ],
  ["10:08:44", "WARN", "pod=checkout-8a21-a promo validation: unknown code 'FREESHIP' (rejected)"],
  [
    "10:10:27",
    "ERROR",
    "pod=checkout-8a21-a POST /checkout 500 5001ms order insert failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  [
    "10:15:33",
    "ERROR",
    "pod=checkout-8a21-c POST /checkout 500 5004ms TimeoutError: timeout acquiring connection from pool after 5000ms (pool total=12 idle=0 waiting=38)",
  ],
  [
    "10:20:05",
    "INFO",
    "pod=checkout-6d14-a starting checkout-api v2.13.2 (node-postgres 8.11.3) pg.pool.max=20 [rollback]",
  ],
  [
    "10:20:22",
    "INFO",
    "pod=checkout-6d14-b starting checkout-api v2.13.2 (node-postgres 8.11.3) pg.pool.max=20 [rollback]",
  ],
  [
    "10:20:41",
    "ERROR",
    "pod=checkout-6d14-a POST /checkout 500 5002ms order insert failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  [
    "10:22:09",
    "ERROR",
    "pod=checkout-6d14-b POST /checkout 500 5001ms TimeoutError: timeout acquiring connection from pool after 5000ms (pool total=9 idle=0 waiting=40)",
  ],
  ["10:23:50", "INFO", "pod=checkout-6d14-a POST /checkout 200 1980ms"],
]);

const inventoryService = series("inventory-service", "inventory", [
  ["09:42:18", "INFO", "reserveStock sku=TEE-0192 qty=1 ok 22ms"],
  ["09:58:02", "INFO", "reserveStock sku=MUG-0044 qty=2 ok 25ms"],
  [
    "10:01:05",
    "ERROR",
    "reserveStock sku=HOOD-0310 failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  [
    "10:06:21",
    "ERROR",
    "reserveStock sku=TEE-0192 failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  ["10:07:40", "INFO", "reserveStock sku=CAP-0007 qty=1 ok 31ms"],
  [
    "10:11:02",
    "ERROR",
    "reserveStock sku=MUG-0044 failed: connection acquire timeout after 3000ms",
  ],
  [
    "10:16:14",
    "ERROR",
    "reserveStock sku=SOCK-0501 failed: error: sorry, too many clients already (SQLSTATE 53300)",
  ],
  [
    "10:21:30",
    "ERROR",
    "reserveStock sku=TEE-0192 failed: connection acquire timeout after 3000ms",
  ],
]);

const reportingWorker = series("reporting-worker", "reporting", [
  [
    "09:55:30",
    "INFO",
    "starting reporting-worker v3.8.0 schedule='*/5 * * * *' (was '0 2 * * *') db=ORDERS_DB_URL host=orders-db-primary.internal:5432",
  ],
  ["10:00:00", "INFO", "run=1000 export finance_orders_rollup started parallelism=16"],
  ["10:00:02", "INFO", "run=1000 opened 16 connections to orders-db-primary.internal"],
  [
    "10:05:00",
    "WARN",
    "run=1005 previous run=1000 still in progress; overlapping runs allowed (max_concurrent_runs unset)",
  ],
  ["10:05:01", "INFO", "run=1005 export finance_orders_rollup started parallelism=16"],
  ["10:06:12", "INFO", "run=1000 export finance_orders_rollup completed in 6m12s rows=1,912,330"],
  ["10:10:00", "INFO", "run=1010 export finance_orders_rollup started parallelism=16"],
  ["10:11:20", "INFO", "run=1005 export finance_orders_rollup completed in 6m19s rows=1,913,004"],
  ["10:15:00", "INFO", "run=1015 export finance_orders_rollup started parallelism=16"],
  ["10:16:31", "INFO", "run=1010 export finance_orders_rollup completed in 6m31s rows=1,913,511"],
  ["10:20:00", "INFO", "run=1020 export finance_orders_rollup started parallelism=16"],
  ["10:21:48", "INFO", "run=1015 export finance_orders_rollup completed in 6m48s rows=1,914,020"],
]);

const ordersDb = series("orders-db", "ordersdb", [
  ["09:30:00", "LOG", "checkpoint complete: wrote 2210 buffers (1.7%)"],
  [
    "09:56:00",
    "LOG",
    "pgwatch connections by application_name: checkout-api=41 inventory-service=14 admin=2 total=57/100",
  ],
  [
    "10:00:38",
    "FATAL",
    "sorry, too many clients already (client application_name=checkout-api addr=10.4.2.17)",
  ],
  [
    "10:06:00",
    "LOG",
    "pgwatch connections by application_name: checkout-api=49 inventory-service=17 reporting-worker=32 admin=2 total=100/100",
  ],
  [
    "10:07:15",
    "LOG",
    "duration: 48213.552 ms statement: SELECT o.*, oi.* FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.created_at >= $1 (application_name=reporting-worker)",
  ],
  [
    "10:10:31",
    "FATAL",
    "sorry, too many clients already (client application_name=checkout-api addr=10.4.2.19)",
  ],
  [
    "10:16:00",
    "LOG",
    "pgwatch connections by application_name: checkout-api=48 inventory-service=18 reporting-worker=32 admin=2 total=100/100",
  ],
]);

const edgeGateway = series("edge-gateway", "edge", [
  ["10:08:12", "INFO", 'GET /legacy/cart/88213 404 3ms ua="SemrushBot/7~bl"'],
  ["10:08:13", "INFO", 'GET /legacy/cart/88214 404 2ms ua="SemrushBot/7~bl"'],
  ["10:09:40", "INFO", 'GET /legacy/cart/90001 404 2ms ua="SemrushBot/7~bl"'],
  ["10:12:55", "INFO", 'POST /checkout 502 5010ms upstream=checkout-api ua="Mozilla/5.0"'],
]);

export const logs: LogLine[] = [
  ...checkoutApi,
  ...inventoryService,
  ...reportingWorker,
  ...ordersDb,
  ...edgeGateway,
].toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
