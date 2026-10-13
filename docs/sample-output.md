# Investigation: Checkout failing intermittently

_As of 10:25 UTC 2026-10-13, after Wave 5._

## Summary

orders-db-primary is pinned at 99-100 of 100 connections because reporting-worker v3.8 (Airflow, 09:55) runs on the primary every 5 minutes with parallelism 16 and overlapping runs. Checkout and inventory fail with 'too many clients' and pool timeouts. Rolling checkout back to v2.13.2 at 10:20 changed nothing, which refutes the deploy theory. The reporting-worker is still not paused (run 1020 started 10:20), and the incident is P1. (`chat-dan-rollback-result`, `log-reporting-11`, `metric-ordersdb-connections`, `alert-checkout-latency-still`, `chat-cs-impact-update`)

**Impact:** About 5% of checkouts fail and the rest are slow (p95 about 2.4s). Inventory reservations are failing. Support has about 180 tickets, and customers are retrying and giving up. Payments confirmed no double charges because failed orders never reached capture.

## Stakeholder update

> Some customers are failing to check out or seeing slow checkouts, and the issue is now P1. The cause is a reporting job that Data Platform changed at 09:55. It now runs every 5 minutes and uses up the database connections that checkout and inventory need. The recent checkout release is not the cause, and rolling it back did not help. Payments confirms no one was double charged, because failed orders never reached payment. We are stopping the reporting job now, and checkout should recover shortly afterwards. Next update at 10:40.

## Hypotheses

### reporting-worker (rescheduled to every 5 min, parallelism 16) is running on orders-db-primary and exhausting its connections

- **Status:** supported · **Confidence:** high · **Kind:** cause · `h-reporting-on-primary`
- **Trajectory:** W1 open/medium → W2 supported/high → W3 supported/high → W4 supported/high → W5 supported/high
- **Rationale:** Independent sources agree: logs, pgwatch, Data Platform's announcement and a 5-minute spike pattern that matches the schedule. The failed checkout rollback eliminates the main alternative. Run 1020 started at 10:20 and the primary stays at 99-100. The worker always has at least one run active, since runs take 6.5 minutes or more on a 5-minute schedule. Recovery after a pause is still unproven because nothing has been paused.
- **Supporting:** `log-reporting-01`, `log-reporting-02`, `log-reporting-03`, `metric-ordersdb-connections`, `metric-reporting-worker-running-jobs`, `log-ordersdb-02`, `log-ordersdb-03`, `log-inventory-03`, `kb-runbook-db-connection-exhaustion`, `kb-incident-1987`, `log-ordersdb-04`, `log-reporting-04`, `log-reporting-05`, `log-reporting-06`, `log-reporting-07`, `log-reporting-08`, `log-ordersdb-05`, `log-ordersdb-06`, `alert-ordersdb-connections`, `alert-inventory-errors`, `log-inventory-06`, `chat-dan-inventory`, `chat-data-platform-announcement`, `log-reporting-09`, `log-reporting-10`, `log-ordersdb-07`, `log-reporting-11`, `log-reporting-12`, `alert-checkout-latency-still`, `chat-dan-rollback-result`, `log-checkout-21`
- **Contradicting:** none
- **What would change this:** If connections do not fall to about 57 once the reporting-worker is paused and its backends are terminated, look for another holder via the pgwatch application_name breakdown.

### Checkout failures are causing failed or stuck orders; double-charge risk is unverified

- **Status:** supported · **Confidence:** medium · **Kind:** impact · `h-customer-payment-impact`
- **Trajectory:** W2 open/low → W5 supported/medium
- **Rationale:** Customer impact is real and growing: about 180 tickets, with customers retrying and abandoning. Payments confirmed that failed orders never reached payment capture, so there are no double charges. The impact is lost or abandoned orders, not payment errors. Confidence is medium because the payments confirmation is a human report and has not been checked against capture records.
- **Supporting:** `chat-cs-escalation`, `alert-checkout-5xx`, `log-checkout-11`, `chat-cs-impact-update`
- **Contradicting:** `metric-payments-gateway-p95`
- **What would change this:** Capture records that show a charge without an order would reopen the double-charge concern. Ticket volume falling after the pause would confirm the impact is tied to the DB saturation.

### checkout-api v2.14.0 (node-postgres 8.12.0 bump) caused the connection and latency regression

- **Status:** refuted · **Confidence:** high · **Kind:** cause · `h-checkout-deploy`
- **Trajectory:** W1 open/low → W2 open/low → W3 open/low → W4 open/low → W5 refuted/high
- **Rationale:** Rolling back to v2.13.2 (node-postgres 8.11.3) at 10:20 changed nothing: the rolled-back pods still get 53300 and pool timeouts, and 5xx is still ~5%. inventory-service did not deploy and fails identically. The checkout code was therefore not the cause.
- **Supporting:** `deploy-checkout-api-2-14-0`, `chat-dan-deploy-guess`
- **Contradicting:** `log-inventory-03`, `log-ordersdb-02`, `metric-checkout-p95-latency`, `kb-incident-2041`, `log-ordersdb-04`, `log-reporting-05`, `chat-dan-inventory`, `alert-inventory-errors`, `log-reporting-07`, `chat-data-platform-announcement`, `log-ordersdb-07`, `chat-dan-rollback-result`, `deploy-checkout-api-2-13-2-rollback`, `log-checkout-21`, `log-checkout-22`, `alert-checkout-latency-still`, `log-reporting-11`
- **What would change this:** Nothing on the current evidence. It would only be reconsidered if connections stay saturated after the reporting-worker is stopped and checkout still holds more than its baseline.

## Next actions

- **[now]** Escalate now: pause the reporting-worker Airflow DAG (or roll reporting-worker back to v3.7), and cancel in-flight run 1020 and any other active run. The 10:20 run was missed and 10:25 is next. Then confirm orders-db connections fall to about 57 and that 5xx, p95 and inventory errors recover. — _Data Platform (@maya)_. The reporting-worker is the confirmed holder and is still running every 5 minutes. The P1 will not clear until it stops. Reverting checkout did not help. (`log-reporting-11`, `log-reporting-12`, `metric-ordersdb-connections`, `alert-checkout-latency-still`)
- **[now]** Don't wait for the DAG pause. Terminate the reporting-worker backends now with pg_terminate_backend (filter on application_name='reporting-worker'). Then re-run the pgwatch breakdown and terminate any reporting-worker or idle-in-transaction sessions older than 5 minutes. Do not raise max_connections. — _Platform DB (@kofi)_. This is a reversible way to free about 32 slots immediately. Run 1020 is still holding connections and the primary is at 99-100. (`log-ordersdb-07`, `log-reporting-11`, `kb-runbook-db-connection-exhaustion`)
- **[next]** Leave checkout-api on v2.13.2 for now and make no further checkout changes. After the DB recovers, decide separately whether to redeploy v2.14.0, since it was not the cause. — _Checkout (@dan)_. The rollback has been done and had no effect. Further checkout changes would confound the recovery signal. (`chat-dan-rollback-result`, `deploy-checkout-api-2-13-2-rollback`)
- **[next]** Before re-enabling, repoint reporting-worker to the orders-db replica (or confirm the replica alias status), set max_concurrent_runs=1 with a run timeout under the interval, lower parallelism from 16, and decide whether a 5-minute refresh is needed at all. Add a DB-impact review step for Airflow changes. — _Data Platform (@maya)_. v3.8 moved the worker off the replica, against the catalogue rule, and overlapping runs stack connections. (`chat-data-platform-announcement`, `svc-reporting-worker`, `log-reporting-04`, `log-reporting-10`)
- **[next]** Tell Support that payments confirmed there were no double charges and that failed orders were not charged. Customers can retry once the fix lands. Do a spot reconciliation of captures against failed orders since 10:00 as a backstop. — _Checkout (@dan)_. There are about 180 tickets and customers are abandoning. The no-double-charge message reduces support load. (`chat-cs-impact-update`)
- **[next]** Tell the inventory-service on-call that the page is the same orders-db saturation and needs no inventory change. After the reporting-worker is stopped, confirm reserveStock errors and acquire timeouts clear. — _Inventory on-call (see catalogue)_. Inventory did not deploy and fails with the same 53300 error. (`alert-inventory-errors`, `log-inventory-03`)

## Open questions

- ~~What does the current pg_stat_activity or pgwatch breakdown by application_name on orders-db-primary show, and is reporting-worker holding the extra ~38 connections?~~ Resolved in Wave 2: Yes. pgwatch at 10:06 shows checkout-api=49, inventory-service=17, reporting-worker=32, admin=2, total 100/100. The 09:56 baseline was 57 with no reporting-worker. reporting-worker is the new holder, and checkout and inventory rose by retries. (`metric-ordersdb-connections`, `log-reporting-03`, `log-ordersdb-04`, `log-ordersdb-02`)
- ~~Who changed the reporting-worker schedule from daily 02:00 to every 5 minutes, and why does it use ORDERS_DB_URL instead of the replica? It shipped through Airflow, which is not in the argo-cd history.~~ Resolved in Wave 4: @maya (Data Platform) shipped reporting-worker v3.8 at 09:55 via Airflow. It refreshes the finance dashboard every 5 minutes instead of nightly, and it moved the worker to ORDERS_DB_URL (the primary) in a config tidy-up because the replica alias is 'being deprecated'. The change was announced but not reviewed for DB impact. (`log-reporting-01`, `chat-data-platform-announcement`)
- ~~Were any customers charged for orders that failed or were retried? Check payments-gateway capture records against failed order inserts since 10:00, and whether retries use idempotency keys.~~ Resolved in Wave 5: The payments team confirmed there were no double charges: failed orders never reached payment capture. This matches the order flow (reserve, insert, then capture). A spot reconciliation of capture records is still worth doing. (`chat-cs-escalation`, `svc-checkout-api`, `chat-cs-impact-update`)
- ~~Is checkout's rise from 41 to 49 connections just retry pressure, or does the v2.14.0 pool idle-timeout change add to it? Check again once reporting-worker is paused.~~ Resolved in Wave 5: The v2.14.0 pool change is not the cause. Rolled-back v2.13.2 pods fail the same way (53300, pool total=9 idle=0 waiting=40), so the rise to 49 is retry pressure on a saturated DB. (`log-ordersdb-04`, `log-ordersdb-02`, `deploy-checkout-api-2-14-0`, `log-checkout-21`, `log-checkout-22`, `chat-dan-rollback-result`)
- Is the orders-db replica alias actually being deprecated? The announcement says so, but the catalogue says reporting-worker MUST read from the replica. Is there a working replica endpoint to repoint to, and did anyone review the v3.8 change for primary connection impact?
- Do orders-db connections, checkout 5xx and inventory errors recover once the reporting-worker is paused and its backends terminated? The checkout rollback is a confounder, so compare against the 09:56 baseline of 57/100.

## Timeline of Signals

| Time  | Evidence                                                                                  | Why it matters                                                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 09:55 | `log-reporting-01` reporting-worker INFO                                                  | reporting-worker restarted at 09:55 with its schedule changed from daily 02:00 to every 5 minutes, and it is pointed at orders-db-primary.                                                                       |
| 09:56 | `log-ordersdb-02` orders-db LOG                                                           | Baseline at 09:56 was 57/100, with checkout 41, inventory 14 and admin 2, all within budget and with no reporting-worker.                                                                                        |
| 09:57 | `chat-data-platform-announcement` #data-platform-announcements: finance dashboard refresh | Data Platform's own announcement confirms the 09:55 v3.8 rollout, the 5-minute schedule and the move of the worker to the primary (ORDERS_DB_URL). This is a human report that agrees with the logs and metrics. |
| 10:00 | `log-reporting-02` reporting-worker INFO                                                  | Export started at 10:00 with parallelism=16, the same minute the symptoms began.                                                                                                                                 |
| 10:00 | `log-reporting-03` reporting-worker INFO                                                  | It opened 16 connections to the primary, which accounts for the ~38-connection jump together with the checkout and inventory retry pressure.                                                                     |
| 10:00 | `log-ordersdb-03` orders-db FATAL                                                         | orders-db is rejecting new clients with FATAL 'too many clients already'.                                                                                                                                        |
| 10:00 | `log-checkout-10` checkout-api ERROR                                                      | checkout-api gets SQLSTATE 53300 'too many clients' from orders-db.                                                                                                                                              |
| 10:01 | `log-inventory-03` inventory-service ERROR                                                | inventory-service, which did not deploy, shows the same 53300 error, so the fault is in the shared DB and not in checkout code.                                                                                  |
| 10:01 | `log-checkout-11` checkout-api ERROR                                                      | Pool acquire timeout with 0 idle and 31 waiting: the pool is starved because the DB has no free slots.                                                                                                           |
| 10:01 | `alert-checkout-latency` [FIRING] checkout-api p95 latency > 1500ms                       | p95 jumped from ~185ms to 2.6s at 10:00, matching pool-acquire timeouts.                                                                                                                                         |
| 10:01 | `alert-checkout-5xx` [FIRING] checkout-api 5xx ratio > 2%                                 | 5xx at 4.1%, 93% on POST /checkout, which is the path that inserts into orders-db.                                                                                                                               |
| 10:05 | `log-reporting-04` reporting-worker WARN                                                  | Overlapping runs are allowed (max_concurrent_runs unset), so a 6-minute job on a 5-minute schedule stacks 2x16 connections.                                                                                      |
| 10:05 | `log-reporting-05` reporting-worker INFO                                                  | Run 1005 started with parallelism=16 while run 1000 was still running, which explains the second saturation at 10:05 (100/100).                                                                                  |
| 10:05 | `chat-cs-escalation` #support-escalations: payment failures                               | About 40 tickets in 10 minutes for payment failed or a stuck spinner confirm customer impact. The double-charge worry is unverified.                                                                             |
| 10:06 | `log-ordersdb-04` orders-db LOG                                                           | pgwatch at 10:06 shows reporting-worker=32 of 100 on the primary, which confirms who holds the extra connections (checkout 49, inventory 17).                                                                    |
| 10:06 | `log-reporting-06` reporting-worker INFO                                                  | Run 1000 finished at 10:06:12, but the schedule re-fires at 10:10, so the problem will recur until the worker is paused.                                                                                         |
| 10:06 | `chat-priya-ack` #inc-checkout: on-call ack                                               | The on-call asked whether anyone touched orders-db. The answer is that nobody changed the DB, but reporting-worker was rescheduled via Airflow.                                                                  |
| 10:07 | `log-ordersdb-05` orders-db LOG                                                           | A 48s reporting-worker SELECT on orders/order_items runs on the primary, which confirms heavy analytic load there.                                                                                               |
| 10:10 | `log-reporting-07` reporting-worker INFO                                                  | Run 1010 started at 10:10 with parallelism=16, so the worker was not paused and it re-saturated the DB as predicted.                                                                                             |
| 10:10 | `log-ordersdb-06` orders-db FATAL                                                         | The DB is still rejecting checkout-api with 'too many clients' at 10:10:31, so the incident is ongoing.                                                                                                          |
| 10:10 | `alert-ordersdb-connections` [FIRING] orders-db connections > 90% of max                  | The primary has sat at 97-100 of 100 for more than 5 minutes, which confirms continued saturation of the shared DB.                                                                                              |
| 10:11 | `log-inventory-06` inventory-service ERROR                                                | inventory-service hits a connection acquire timeout at 10:11, which shows the same pool starvation as checkout.                                                                                                  |
| 10:11 | `alert-inventory-errors` [FIRING] inventory-service error rate > 5%                       | inventory-service, which hasn't deployed, is now paging on reserveStock upstream failures, the same shared-DB failure as checkout.                                                                               |
| 10:11 | `log-reporting-08` reporting-worker INFO                                                  | Run 1005 completed at 10:11:20 after 6m19s, so runs last longer than the 5-minute interval and will keep overlapping.                                                                                            |
| 10:12 | `chat-dan-inventory` #inc-checkout: inventory also erroring                               | Dan confirms inventory-service hasn't deployed since Saturday, which undercuts the checkout-deploy theory.                                                                                                       |
| 10:15 | `log-reporting-09` reporting-worker INFO                                                  | Run 1015 started at 10:15 with parallelism=16, so the schedule is still live and the worker has not been paused.                                                                                                 |
| 10:16 | `log-ordersdb-07` orders-db LOG                                                           | pgwatch at 10:16 shows reporting-worker=32 of 100 and the total at 100/100. The overlap of 1010 and 1015 is still saturating the primary.                                                                        |
| 10:16 | `log-reporting-10` reporting-worker INFO                                                  | Run 1010 took 6m31s, longer than the 5-minute interval, so overlap will continue (1015 now, 1020 at 10:20).                                                                                                      |
| 10:20 | `log-reporting-11` reporting-worker INFO                                                  | Run 1020 started at 10:20 with parallelism=16, so the worker is still unpaused and re-saturating the primary.                                                                                                    |
| 10:20 | `deploy-checkout-api-2-13-2-rollback` checkout-api v2.13.2 (rollback)                     | The rollback to v2.13.2 at 10:20 is a failed test of the deploy hypothesis. It also confounds before/after comparisons for checkout.                                                                             |
| 10:20 | `log-checkout-21` checkout-api ERROR                                                      | The rolled-back v2.13.2 pod still gets SQLSTATE 53300 at 10:20:41, so the old code fails the same way.                                                                                                           |
| 10:21 | `log-reporting-12` reporting-worker INFO                                                  | Run 1015 took 6m48s, so runs keep getting longer than the interval and will overlap indefinitely.                                                                                                                |
| 10:22 | `log-checkout-22` checkout-api ERROR                                                      | The rolled-back pod shows pool starvation (idle=0, waiting=40), which points to the DB having no free slots.                                                                                                     |
| 10:23 | `chat-cs-impact-update` #support-escalations: impact update                               | Ticket volume has grown to about 180 and customers are giving up. Payments confirms failed orders never reached capture, so there are no double charges.                                                         |
| 10:24 | `chat-dan-rollback-result` #inc-checkout: rollback did not help                           | The checkout rollback to v2.13.2 at 10:20 did not change latency or 5xx, which directly contradicts the checkout-deploy cause.                                                                                   |
| 10:25 | `alert-checkout-latency-still` [STILL FIRING] checkout-api p95 latency                    | The latency spikes recur every 5 minutes (10:00, 10:05, 10:10, 10:15, 10:20), which matches the reporting-worker schedule and not a one-off deploy.                                                              |

## Noise

- `log-edge-01` edge-gateway INFO: A bot request to a legacy cart path gets a 404 in 3ms, so it isn't on the checkout DB path.
- `log-edge-03` edge-gateway INFO: Another SemrushBot 404 with no link to the DB saturation.
- `alert-edge-404` [FIRING] edge-gateway 404 spike on /legacy/cart/_: A SemrushBot crawl of legacy /legacy/cart/_ URLs returns fast 404s (2-3ms) at the edge. It doesn't touch orders-db and is owned by storefront.
- `log-checkout-19` checkout-api INFO: Rollback pod startup line with unchanged pool.max=20. It only records the rollback.
- `log-checkout-20` checkout-api INFO: Rollback pod startup line with unchanged pool.max=20. It only records the rollback.
- `log-checkout-23` checkout-api INFO: A single 200 at 1980ms is an intermittent success during a gap and is not diagnostic.
- `chat-general-vpn` #general: VPN slow: Office VPN slowness for IT is unrelated to the checkout and orders-db path.
- `kb-incident-2041` INC-2041: checkout 500s after checkout-api v2.9 deploy: A checkout-only 500 after a deploy. This incident also affects inventory-service, which did not deploy, and shows 53300 rather than a code error.
- `log-inventory-05` inventory-service INFO: A single successful reserveStock at 10:07:40 during a brief gap. It's intermittent and not diagnostic.
- `alert-logging-disk` [FIRING] logging-host-02 disk usage > 90%: logging-host-02 disk has hovered around 88-91% and flapped since 09:31, before the incident, and it is not in the checkout dependency path.
- `chat-dan-deploy-guess` #inc-checkout: deploy suspected: This is a guess based only on the deploy being recent. inventory-service did not deploy and fails the same way, and symptoms began 20 minutes after the deploy finished.
- `metric-logging-host-disk` logging-host-02 /var/log disk usage: Disk usage is flat at ~88-91% with no change at 10:00.
- `deploy-checkout-api-2-14-0` checkout-api v2.14.0: It finished at 09:40 and metrics stayed healthy for 20 minutes. The pool settings are unchanged, and a non-deployed service fails the same way. The cause is not ruled out entirely, because the pg patch bump touched pool idle handling.
- `deploy-web-storefront-5-2-0` web-storefront v5.2.0: A copy change at 08:30 with no API changes, and it predates the onset by 90 minutes.
- `metric-payments-gateway-p95` payments-gateway (external PSP) p95 latency as seen by checkout-api: PSP latency is flat at ~300ms, so the external payment provider is not the source of the failures.
- `deploy-inventory-service-1-9-3` inventory-service v1.9.3: It shipped two days ago and only changed a cache TTL, so it does not line up with the 10:00 onset.

## How the Investigation evolved

- **Wave 1** (scripted:1, 10:02; 13 tool calls): Checkout 5xx/latency began at 10:00, exactly when reporting-worker (schedule changed to every 5 min at 09:55) opened 16 connections to orders-db-primary, taking it from ~58 to 96-98 of 100. The checkout-api v2.14.0 deploy (09:40) is not supported: metrics were healthy for 20 minutes afterwards, and inventory-service, which did not deploy, fails the same way. The logging disk alert is unrelated noise.
- **Wave 2** (scripted:2, 10:07; 10 tool calls): pgwatch at 10:06 (log-ordersdb-04) now confirms reporting-worker holds 32 of 100 primary connections. Overlapping runs are allowed, and run 1005 started while run 1000 was still going. Support tickets match the checkout failures. Dan's deploy theory is still weak, so I'm keeping the rollback on hold. The next scheduled run at 10:10 will push the DB back to saturation unless the worker is paused first.
- **Wave 3** (scripted:3, 10:12; 5 tool calls): The 10:10 reporting-worker run (1010, parallelism 16) started and orders-db is still at 99-100 of 100. This confirms the recurrence we predicted, and the pause has not happened yet. The new inventory-service page (reserveStock acquire timeout) is the same shared-DB saturation, which further weakens the checkout-deploy theory. The edge-gateway 404 spike is SemrushBot crawling legacy URLs, so it is unrelated noise.
- **Wave 4** (scripted:4, 10:18; 4 tool calls): The announcement from @maya answers who changed the schedule: reporting-worker v3.8 shipped at 09:55 with a 5-minute finance refresh and a move to ORDERS_DB_URL (the primary). The DB is still at 99-100 of 100, and run 1015 started at 10:15 with 16 more connections. The pause has still not happened, and the 10:20 run will stack on top of 1015 in about 2 minutes. h-reporting-on-primary is stronger, but recovery after a pause is still unproven.
- **Wave 5** (scripted:5, 10:25; 8 tool calls): Dan's rollback to v2.13.2 at 10:20 did not help: the 10:20 run (1020) re-saturated the primary at 100/100 and 5xx stayed at ~5%. That directly refutes the checkout-deploy hypothesis. Payments confirmed no double charges, but support tickets have grown to about 180 and the page is now P1. The reporting-worker is still not paused, and that remains the only action that matters.

## Evidence cited

| Id                                     | Source               | Observed         | Title                                                               |
| -------------------------------------- | -------------------- | ---------------- | ------------------------------------------------------------------- |
| `svc-orders-db`                        | service (retrieved)  | reference        | Service catalogue: orders-db                                        |
| `svc-checkout-api`                     | service (retrieved)  | reference        | Service catalogue: checkout-api                                     |
| `svc-reporting-worker`                 | service (retrieved)  | reference        | Service catalogue: reporting-worker                                 |
| `kb-incident-1987`                     | incident (retrieved) | reference        | INC-1987: orders-db connection exhaustion during migration          |
| `kb-runbook-db-connection-exhaustion`  | runbook (retrieved)  | reference        | Runbook: orders-db connection exhaustion                            |
| `kb-incident-2041`                     | incident (retrieved) | reference        | INC-2041: checkout 500s after checkout-api v2.9 deploy              |
| `deploy-inventory-service-1-9-3`       | deploy (retrieved)   | 2026-10-11 14:10 | inventory-service v1.9.3                                            |
| `deploy-web-storefront-5-2-0`          | deploy (retrieved)   | 08:30            | web-storefront v5.2.0                                               |
| `metric-logging-host-disk`             | metric (retrieved)   | 09:30            | logging-host-02 /var/log disk usage                                 |
| `metric-checkout-5xx-ratio`            | metric (retrieved)   | 09:30            | checkout-api share of responses that are HTTP 5xx                   |
| `metric-checkout-p95-latency`          | metric (retrieved)   | 09:30            | checkout-api POST /checkout p95 latency                             |
| `metric-ordersdb-connections`          | metric (retrieved)   | 09:30            | orders-db-primary active client connections                         |
| `metric-payments-gateway-p95`          | metric (retrieved)   | 09:30            | payments-gateway (external PSP) p95 latency as seen by checkout-api |
| `metric-reporting-worker-running-jobs` | metric (retrieved)   | 09:30            | reporting-worker concurrently running export jobs                   |
| `deploy-checkout-api-2-14-0`           | deploy (retrieved)   | 09:40            | checkout-api v2.14.0                                                |
| `log-reporting-01`                     | log (retrieved)      | 09:55            | reporting-worker INFO                                               |
| `log-ordersdb-02`                      | log (retrieved)      | 09:56            | orders-db LOG                                                       |
| `chat-data-platform-announcement`      | chat (pushed)        | 09:57            | #data-platform-announcements: finance dashboard refresh             |
| `log-reporting-02`                     | log (retrieved)      | 10:00            | reporting-worker INFO                                               |
| `log-reporting-03`                     | log (retrieved)      | 10:00            | reporting-worker INFO                                               |
| `alert-logging-disk`                   | alert (pushed)       | 10:00            | [FIRING] logging-host-02 disk usage > 90%                           |
| `log-ordersdb-03`                      | log (retrieved)      | 10:00            | orders-db FATAL                                                     |
| `log-checkout-10`                      | log (retrieved)      | 10:00            | checkout-api ERROR                                                  |
| `log-inventory-03`                     | log (retrieved)      | 10:01            | inventory-service ERROR                                             |
| `log-checkout-11`                      | log (retrieved)      | 10:01            | checkout-api ERROR                                                  |
| `alert-checkout-latency`               | alert (pushed)       | 10:01            | [FIRING] checkout-api p95 latency > 1500ms                          |
| `alert-checkout-5xx`                   | alert (pushed)       | 10:01            | [FIRING] checkout-api 5xx ratio > 2%                                |
| `log-reporting-04`                     | log (retrieved)      | 10:05            | reporting-worker WARN                                               |
| `log-reporting-05`                     | log (retrieved)      | 10:05            | reporting-worker INFO                                               |
| `chat-cs-escalation`                   | chat (pushed)        | 10:05            | #support-escalations: payment failures                              |
| `log-ordersdb-04`                      | log (retrieved)      | 10:06            | orders-db LOG                                                       |
| `log-reporting-06`                     | log (retrieved)      | 10:06            | reporting-worker INFO                                               |
| `chat-dan-deploy-guess`                | chat (pushed)        | 10:06            | #inc-checkout: deploy suspected                                     |
| `chat-priya-ack`                       | chat (pushed)        | 10:06            | #inc-checkout: on-call ack                                          |
| `log-ordersdb-05`                      | log (retrieved)      | 10:07            | orders-db LOG                                                       |
| `log-inventory-05`                     | log (retrieved)      | 10:07            | inventory-service INFO                                              |
| `log-edge-01`                          | log (retrieved)      | 10:08            | edge-gateway INFO                                                   |
| `alert-edge-404`                       | alert (pushed)       | 10:09            | [FIRING] edge-gateway 404 spike on /legacy/cart/*                   |
| `log-edge-03`                          | log (retrieved)      | 10:09            | edge-gateway INFO                                                   |
| `log-reporting-07`                     | log (retrieved)      | 10:10            | reporting-worker INFO                                               |
| `log-ordersdb-06`                      | log (retrieved)      | 10:10            | orders-db FATAL                                                     |
| `alert-ordersdb-connections`           | alert (pushed)       | 10:10            | [FIRING] orders-db connections > 90% of max                         |
| `log-inventory-06`                     | log (retrieved)      | 10:11            | inventory-service ERROR                                             |
| `alert-inventory-errors`               | alert (pushed)       | 10:11            | [FIRING] inventory-service error rate > 5%                          |
| `log-reporting-08`                     | log (retrieved)      | 10:11            | reporting-worker INFO                                               |
| `chat-dan-inventory`                   | chat (pushed)        | 10:12            | #inc-checkout: inventory also erroring                              |
| `log-reporting-09`                     | log (retrieved)      | 10:15            | reporting-worker INFO                                               |
| `chat-general-vpn`                     | chat (pushed)        | 10:15            | #general: VPN slow                                                  |
| `log-ordersdb-07`                      | log (retrieved)      | 10:16            | orders-db LOG                                                       |
| `log-reporting-10`                     | log (retrieved)      | 10:16            | reporting-worker INFO                                               |
| `log-reporting-11`                     | log (retrieved)      | 10:20            | reporting-worker INFO                                               |
| `deploy-checkout-api-2-13-2-rollback`  | deploy (retrieved)   | 10:20            | checkout-api v2.13.2 (rollback)                                     |
| `log-checkout-19`                      | log (retrieved)      | 10:20            | checkout-api INFO                                                   |
| `log-checkout-20`                      | log (retrieved)      | 10:20            | checkout-api INFO                                                   |
| `log-checkout-21`                      | log (retrieved)      | 10:20            | checkout-api ERROR                                                  |
| `log-reporting-12`                     | log (retrieved)      | 10:21            | reporting-worker INFO                                               |
| `log-checkout-22`                      | log (retrieved)      | 10:22            | checkout-api ERROR                                                  |
| `chat-cs-impact-update`                | chat (pushed)        | 10:23            | #support-escalations: impact update                                 |
| `log-checkout-23`                      | log (retrieved)      | 10:23            | checkout-api INFO                                                   |
| `chat-dan-rollback-result`             | chat (pushed)        | 10:24            | #inc-checkout: rollback did not help                                |
| `alert-checkout-latency-still`         | alert (pushed)       | 10:25            | [STILL FIRING] checkout-api p95 latency                             |
