# Investigation: Checkout failing intermittently

_As of 10:25 UTC 2026-10-13, after Wave 5._

## Summary

Checkout and inventory-service are failing in 5-minute waves (5xx about 5-6%, p95 about 2.4-2.8s) because orders-db-primary is pinned at 99-100/100 connections by reporting-worker v3.8. Data Platform shipped v3.8 at 09:55 via Airflow with a 5-minute schedule at parallelism 16 against the primary, and overlapping runs (now up to 6m48s) keep recurring, with run 1020 starting at 10:20. Dan's checkout-api rollback to 2.13.2 at 10:20 did not help, which refutes the deploy theory. The reporting schedule is still not paused, and the incident was escalated to P1. (`log-reporting-11`, `log-reporting-12`, `chat-dan-rollback-result`, `chat-cs-impact-update`, `metric-ordersdb-connections`, `metric-checkout-5xx-ratio`, `alert-checkout-latency-still`)

**Impact:** About 5% of checkouts fail in waves and the rest are slow. Support has about 180 tickets, and customers are retrying or giving up. Payments confirms there were no double charges, because failed orders never reached payment capture. Inventory reservations fail at about 6%, and orphaned stock reservations are unverified.

## Stakeholder update

> Checkout is still failing for about 1 in 20 customers in repeating 5-minute waves, and the other checkouts are slow. About 180 support tickets have come in. Good news: the payments team confirmed customers were not charged for failed orders, so there are no double charges. The cause is a reporting job that Data Platform started at 09:55. It is overloading the shared orders database every 5 minutes and also affecting inventory. Rolling back the checkout release did not help, which confirms the release was not the cause. We are asking Data Platform to pause the reporting job now. We expect checkout to recover within minutes of that pause. Next update by 10:40.

## Hypotheses

### reporting-worker (rescheduled to every 5 min, 16 parallel connections) is exhausting orders-db-primary connections, starving checkout-api and inventory-service
- **Status:** supported · **Confidence:** high · **Kind:** cause · `h-reporting-worker-primary`
- **Trajectory:** W1 open/medium → W2 supported/high → W3 supported/high → W4 supported/high → W5 supported/high
- **Rationale:** The rollback test removed the main alternative. A fifth wave started with run 1020 at 10:20, and the spikes at 10:00, 10:05, 10:10, 10:15 and 10:20 match the run starts exactly. The primary is at 99-100/100 and run durations are growing (6m48s), so overlap persists. Telemetry, logs, the owner's announcement and the catalogue agree. The schedule is still not paused. The jump of about 38 versus 16 logged connections is still unexplained.
- **Supporting:** `log-reporting-01`, `log-reporting-02`, `log-reporting-03`, `metric-reporting-worker-running-jobs`, `metric-ordersdb-connections`, `log-ordersdb-03`, `log-inventory-03`, `kb-incident-1987`, `kb-runbook-db-connection-exhaustion`, `log-ordersdb-04`, `log-reporting-04`, `log-reporting-05`, `log-reporting-06`, `log-checkout-14`, `log-checkout-15`, `svc-checkout-api`, `log-reporting-07`, `log-reporting-08`, `log-ordersdb-05`, `log-ordersdb-06`, `alert-ordersdb-connections`, `alert-inventory-errors`, `metric-checkout-5xx-ratio`, `chat-data-platform-announcement`, `log-reporting-09`, `log-reporting-10`, `log-ordersdb-07`, `svc-reporting-worker`, `log-reporting-11`, `log-reporting-12`, `alert-checkout-latency-still`, `chat-dan-rollback-result`, `log-checkout-21`
- **Contradicting:** `log-ordersdb-02`
- **What would change this:** Connections falling to about 57-67 and 5xx to about 0.2% after the pause would confirm it. If saturation persisted with the worker stopped, look for another consumer.

### Customer impact: POST /checkout failing about 4-5% with p95 around 2.6s, so orders are being lost or delayed
- **Status:** supported · **Confidence:** medium · **Kind:** impact · `h-checkout-impact`
- **Trajectory:** W1 supported/medium → W2 supported/medium → W3 supported/medium → W4 supported/medium → W5 supported/medium
- **Rationale:** Impact continues through the fifth wave: 5xx 4.9-5.5% at 10:20-10:25 and p95 about 2.4-2.65s at peak. Support tickets have grown from about 40 to about 180, with customers retrying and some giving up. The page was escalated to P1. Payments confirms failed orders never reached capture, so the loss is unplaced orders, not charges.
- **Supporting:** `alert-checkout-5xx`, `alert-checkout-latency`, `metric-checkout-5xx-ratio`, `metric-checkout-p95-latency`, `log-checkout-10`, `chat-cs-escalation`, `log-checkout-14`, `log-checkout-15`, `alert-inventory-errors`, `alert-ordersdb-connections`, `log-reporting-09`, `chat-cs-impact-update`, `alert-checkout-latency-still`
- **Contradicting:** none
- **What would change this:** An actual lost-order count from the orders table would firm up the business impact.

### checkout-api v2.14.0 (node-postgres 8.12.0 bump) changed pool behaviour and leaked connections
- **Status:** refuted · **Confidence:** high · **Kind:** cause · `h-checkout-deploy-pool`
- **Trajectory:** W1 open/low → W2 refuted/medium → W3 refuted/medium → W4 refuted/high → W5 refuted/high
- **Rationale:** Dan's rollback to v2.13.2 at 10:20 did not help. The rolled-back pods still fail with 53300 and pool timeouts, the 5-minute wave pattern continued, and inventory-service, which did not deploy, fails the same way. That is a failed rollback plus a symptom in a service the change cannot touch.
- **Supporting:** `deploy-checkout-api-2-14-0`, `log-checkout-11`, `chat-dan-deploy-guess`
- **Contradicting:** `metric-checkout-p95-latency`, `log-inventory-03`, `log-ordersdb-02`, `log-ordersdb-04`, `log-reporting-03`, `alert-inventory-errors`, `chat-dan-inventory`, `log-reporting-07`, `chat-data-platform-announcement`, `log-ordersdb-07`, `svc-reporting-worker`, `chat-dan-rollback-result`, `deploy-checkout-api-2-13-2-rollback`, `log-checkout-21`, `log-checkout-22`, `alert-checkout-latency-still`
- **What would change this:** Nothing realistic. Only evidence of a checkout-specific leak that persists after the reporting pause would reopen this.

### Some failed checkouts may have captured payment without creating an order, or caused duplicate charges on retry
- **Status:** refuted · **Confidence:** medium · **Kind:** impact · `h-double-charge-risk`
- **Trajectory:** W2 open/low → W3 open/low → W5 refuted/medium
- **Rationale:** The payments team reports (via Support) that the failed orders never reached payment capture, and the gateway p95 stayed flat at about 300ms. Checkout fails at the DB write before capture, so there are no double charges. It is a relayed statement, so confidence is medium. Orphaned stock reservations are still possible and are tracked separately.
- **Supporting:** `chat-cs-escalation`, `log-checkout-14`, `kb-runbook-checkout-5xx`, `alert-inventory-errors`
- **Contradicting:** `metric-payments-gateway-p95`, `chat-cs-impact-update`
- **What would change this:** A payment-provider ledger showing captures without orders would reopen this.

## Next actions

- **[now]** Escalate now as P1: pause the finance_orders_rollup schedule in Airflow (or scale reporting-worker to 0) and cancel in-flight runs (1020 and any 1025) before the next 5-minute tick. Page @maya directly and use the Data Platform on-call if there is no answer. Do not raise max_connections. — _Data Platform (@maya)_. The schedule has been running unpaused through five waves (10:00-10:20) and is the confirmed cause. The checkout rollback did not help, so this is the only mitigation left. It is also the runbook step. (`log-reporting-11`, `log-reporting-12`, `log-ordersdb-07`, `kb-runbook-db-connection-exhaustion`, `kb-incident-1987`, `chat-dan-rollback-result`)
- **[now]** After the pause, watch orders-db connections (expect about 57-67), the checkout 5xx ratio (expect about 0.2%) and p95 (expect about 185ms) for two full 5-minute cycles. Confirm with pgwatch that checkout-api stays within 60 and that no run is left in flight. — _sre-primary (@priya)_. Recovery after the pause is the final test of the cause. The rollback result means any lingering errors should be checked for the 2.13.2 pods too. (`metric-ordersdb-connections`, `metric-checkout-5xx-ratio`, `metric-checkout-p95-latency`, `log-ordersdb-07`)
- **[now]** Make no more checkout-api version changes while the DB is saturated. The v2.13.2 rollback is already done and did not help. Once the reporting pause is verified, roll checkout-api forward to v2.14.0 as a normal change, since there is no evidence against it. — _Checkout (@dan)_. The rollback was tried and refuted the deploy theory. Further deploys only add pod restarts and connection churn during saturation. (`chat-dan-rollback-result`, `deploy-checkout-api-2-13-2-rollback`, `log-checkout-21`)
- **[next]** After the pause, repoint reporting-worker to the orders-db replica (a dedicated replica URL, not the deprecated alias), set max_concurrent_runs=1 and lower parallelism. Restore a safe schedule, add a guardrail that blocks batch consumers from the primary, and review how the 09:55 change shipped without an owner check. — _Data Platform (@maya)_. The catalogue says reporting-worker must read from the replica. The tidy-up to ORDERS_DB_URL silently moved it onto the primary. (`chat-data-platform-announcement`, `log-reporting-01`, `svc-reporting-worker`, `kb-incident-1987`)
- **[next]** Reconcile failed checkouts since 10:00 for lost orders and abandoned carts. Double charges are ruled out, so give Support an updated line: no one was charged for failed orders, and customers can retry once the fix is confirmed. Pull a count of failed order inserts for the impact report. — _Checkout (@dan)_. Payments confirmed no double charges, so the focus moves to lost orders and customer messaging for about 180 tickets. (`chat-cs-impact-update`, `log-checkout-14`, `chat-cs-escalation`)
- **[next]** After mitigation, reconcile inventory reservations created by reserveStock for checkouts that failed at order insert since 10:00, and release the orphans. — _Fulfilment (@sam)_. Checkout reserves stock before the order insert, and both fail on the saturated primary, so stock may be stuck reserved. (`alert-inventory-errors`, `svc-checkout-api`, `log-checkout-14`)
- **[later]** Leave the logging-host-02 disk alert to observability for follow-up outside this incident. — _observability_. It was flapping before the incident and has no link to the checkout failure path. (`alert-logging-disk`, `metric-logging-host-disk`)
- **[later]** Take no action in this incident on the edge-gateway /legacy/cart 404 alert. Storefront can treat it as a bot-filtering follow-up. — _Storefront (@ines)_. It is SemrushBot hitting retired routes and returning fast 404s. It has no link to checkout or the DB. (`alert-edge-404`, `log-edge-01`)

## Open questions

- ~~What is the per-application_name connection breakdown on orders-db-primary right now? Is reporting-worker holding about 16, or more, and is anything else out of budget?~~ Resolved in Wave 2: At 10:06 the primary showed checkout-api=49, inventory-service=17, reporting-worker=32, admin=2, total 100/100. At 09:56 it was checkout-api=41, inventory-service=14, admin=2 (57/100). Reporting-worker is the out-of-budget consumer, and checkout-api is within its 60. (`log-ordersdb-02`, `metric-ordersdb-connections`, `log-ordersdb-04`)
- ~~Who changed the reporting-worker schedule from daily to every 5 min and pointed it at the primary (ORDERS_DB_URL)? It went out via Airflow, not argo-cd, and was it intended?~~ Resolved in Wave 2: Partly answered: reporting-worker v3.8.0 started at 09:55:30 with schedule '*/5 * * * *' (was '0 2 * * *') against orders-db-primary. The author and intent are still unknown, but nobody touched orders-db itself. Data Platform (@maya) should confirm. (`log-reporting-01`)
- Did any failed checkouts leave stock reserved or payments captured without an order, and what is the actual order loss?
- ~~Were any customers charged without an order, or charged twice on retry? Does checkout-api capture payment before or after the order insert on the failing path?~~ Resolved in Wave 5: The payments team confirmed there were no double charges. The failed orders never reached payment capture, because the failure is at the DB write before capture. The payments-gateway p95 is also flat. (`chat-cs-escalation`, `log-checkout-14`, `kb-runbook-checkout-5xx`, `chat-cs-impact-update`, `metric-payments-gateway-p95`)
- ~~Why were overlapping reporting runs allowed (max_concurrent_runs unset) and parallelism=16 against the primary, and did anyone review the 09:55 Airflow change?~~ Resolved in Wave 4: Partly answered. Maya shipped v3.8 at 09:55 through the Airflow pipeline. It made the dashboard refresh every 5 min and moved the DB URL to ORDERS_DB_URL (primary) because the replica alias is being deprecated. She did not know the primary is reserved for transactional traffic. Still open: why max_concurrent_runs and parallelism were left unset or high, and why the change had no review. (`log-reporting-04`, `log-reporting-01`, `chat-data-platform-announcement`, `svc-reporting-worker`)
- ~~Has the reporting-worker schedule been paused and run 1010 cancelled? The logs show 1010 started at 10:10 and nothing since confirms a pause, and the next run is due at 10:15.~~ Resolved in Wave 4: No. Run 1015 started at 10:15:00 and 1010 only completed at 10:16:31, with connections still 100/100 at 10:16-10:18. The schedule is still active and the next run is due at 10:20. (`log-reporting-07`, `alert-ordersdb-connections`, `log-reporting-09`, `log-reporting-10`, `log-ordersdb-07`, `metric-ordersdb-connections`)
- Why did connections jump about 38 at 10:00 when only 16 reporting connections are logged? Check for retries or pool churn, or other pgwatch consumers.
- How many stock reservations from reserveStock were left orphaned by checkouts that failed at order insert since 10:00, and how many customers abandoned after retrying?

## Timeline of Signals

| Time | Evidence | Why it matters |
| --- | --- | --- |
| 09:55 | `log-reporting-01` reporting-worker INFO | Reporting-worker restarted at 09:55 with schedule changed from daily to every 5 min, targeting orders-db-primary. |
| 09:56 | `log-ordersdb-02` orders-db LOG | Baseline 57/100 with the budget respected at 09:56 and no reporting-worker connections. |
| 09:57 | `chat-data-platform-announcement` #data-platform-announcements: finance dashboard refresh | Owner-confirmed human report: v3.8 shipped at 09:55 with a 5-min refresh, and the config tidy-up moved the worker to ORDERS_DB_URL (primary) because the replica alias is being deprecated. This explains why it reads the primary. |
| 10:00 | `log-reporting-03` reporting-worker INFO | Opened 16 connections to the primary at 10:00:02, the same moment saturation began. |
| 10:00 | `log-ordersdb-03` orders-db FATAL | DB FATAL 'too many clients' at 10:00:38 confirms saturation. |
| 10:00 | `log-checkout-10` checkout-api ERROR | checkout-api insert fails with SQLSTATE 53300. |
| 10:01 | `log-inventory-03` inventory-service ERROR | Inventory-service, which did not deploy, fails with the same error, so the problem is shared and not specific to checkout. |
| 10:01 | `log-checkout-11` checkout-api ERROR | Pool exhausted (idle=0, waiting=31); this is a downstream effect of DB saturation. |
| 10:01 | `alert-checkout-latency` [FIRING] checkout-api p95 latency > 1500ms | Customer-facing symptom; jumped from ~185ms to 2.6s at 10:00 with pool acquire timeouts. |
| 10:01 | `alert-checkout-5xx` [FIRING] checkout-api 5xx ratio > 2% | 5xx concentrated on POST /checkout (DB write path), matching 'too many clients' errors. |
| 10:05 | `log-reporting-04` reporting-worker WARN | Overlapping runs are allowed (max_concurrent_runs unset), so run 1005 started while run 1000 was still going. That doubles the connections to 32. |
| 10:05 | `log-reporting-05` reporting-worker INFO | Run 1005 started at 10:05:01 with parallelism=16, which explains the second saturation wave at 10:05-10:07 (100/100). |
| 10:05 | `log-checkout-14` checkout-api ERROR | A 500 at 10:05:19 with SQLSTATE 53300 on order insert, during the second saturation wave. |
| 10:05 | `chat-cs-escalation` #support-escalations: payment failures | Support is seeing ~40 'payment failed' or stuck 'Placing order…' tickets in 10 min, which matches customer impact. The double-charge worry is unverified and the payments gateway looks healthy. |
| 10:06 | `log-ordersdb-04` orders-db LOG | Per-app breakdown at 10:06: reporting-worker=32, checkout-api=49 (within the 60 budget), inventory-service=17, total 100/100. This identifies the out-of-budget consumer. |
| 10:06 | `log-checkout-15` checkout-api ERROR | Pool acquire timeout with waiting=44 is a downstream effect of DB saturation, not a pool leak. |
| 10:06 | `log-reporting-06` reporting-worker INFO | Run 1000 took 6m12s against a 5-min schedule, so runs will keep overlapping and recurring saturation is likely at 10:10 and later. |
| 10:07 | `log-ordersdb-05` orders-db LOG | A 48s reporting-worker full-range join on the primary shows heavy long-running load that holds connections. |
| 10:10 | `log-reporting-07` reporting-worker INFO | Run 1010 started at 10:10:00 with parallelism=16, so a third wave began and the worker was not paused before it. |
| 10:10 | `log-ordersdb-06` orders-db FATAL | A checkout-api connection is refused with 'too many clients' at 10:10:31, during the third wave. |
| 10:10 | `alert-ordersdb-connections` [FIRING] orders-db connections > 90% of max | Independently confirms sustained saturation of the primary (97-100/100) at 10:10 with the third run. |
| 10:11 | `alert-inventory-errors` [FIRING] inventory-service error rate > 5% | A second service that has not deployed is failing on reserveStock against the same DB, so the fault is shared. |
| 10:11 | `log-reporting-08` reporting-worker INFO | Run 1005 took 6m19s, so runs keep overlapping. 1005 and 1010 overlapped until 10:11:20. |
| 10:12 | `chat-dan-inventory` #inc-checkout: inventory also erroring | Dan notes inventory-service has not deployed since Saturday yet is paging, which undercuts the deploy theory. The rollback offer should still be declined. |
| 10:15 | `log-reporting-09` reporting-worker INFO | Run 1015 started at 10:15:00 with parallelism=16, so the schedule was not paused and a fourth wave began. |
| 10:16 | `log-ordersdb-07` orders-db LOG | At 10:16 reporting-worker=32 with total 100/100, while checkout-api=48 is within its 60 budget and inventory-service=18. |
| 10:16 | `log-reporting-10` reporting-worker INFO | Run 1010 took 6m31s, so runs keep overlapping and it overlapped with 1015 until 10:16:31. |
| 10:20 | `log-reporting-11` reporting-worker INFO | Run 1020 started at 10:20:00 with parallelism=16, so the schedule is still unpaused and a fifth wave began. |
| 10:20 | `deploy-checkout-api-2-13-2-rollback` checkout-api v2.13.2 (rollback) | The 10:20 rollback is a test of the deploy theory and it failed. It also restarted pods, but the wave pattern is unchanged. |
| 10:20 | `log-checkout-21` checkout-api ERROR | The rolled-back v2.13.2 still fails with 53300 at 10:20:41, so the old code has the same DB-saturation failure. |
| 10:21 | `log-reporting-12` reporting-worker INFO | Run 1015 took 6m48s, so runs keep getting longer and overlapping. |
| 10:22 | `log-checkout-22` checkout-api ERROR | The rolled-back version still hits pool acquire timeouts (waiting=40), a downstream effect of DB saturation. |
| 10:23 | `chat-cs-impact-update` #support-escalations: impact update | Payments team confirms failed orders never reached payment capture, so there are no double charges. Ticket volume has grown to about 180 with customers retrying or abandoning, so impact is rising. |
| 10:24 | `chat-dan-rollback-result` #inc-checkout: rollback did not help | Rolling back checkout-api to 2.13.2 at 10:20 changed nothing (5xx still about 5%, latency still spiky), which directly refutes the deploy theory. |
| 10:25 | `alert-checkout-latency-still` [STILL FIRING] checkout-api p95 latency | The P1 escalation shows the 5-minute spike cadence (10:00, 10:05, 10:10, 10:15, 10:20), matching the reporting-worker run starts. |

## Noise

- `log-edge-01` edge-gateway INFO: A bot request to a retired legacy route returns a fast 404.
- `log-edge-02` edge-gateway INFO: A bot request to a retired legacy route returns a fast 404.
- `log-edge-03` edge-gateway INFO: A bot request to a retired legacy route returns a fast 404.
- `alert-edge-404` [FIRING] edge-gateway 404 spike on /legacy/cart/*: SemrushBot is hitting retired /legacy/cart/* routes, which return 404 in 2-3ms. The catalogue says those routes were retired in 2025, so this is not related to checkout or the DB.
- `chat-priya-ack` #inc-checkout: on-call ack: A process acknowledgement. Holding the rollback is sensible, and the question about who touched orders-db is answered by the reporting-worker schedule change at 09:55.
- `log-checkout-12` checkout-api INFO: A single successful but slow 200 response, which shows only degraded latency.
- `log-checkout-13` checkout-api INFO: A single successful 200 at 640ms, during the brief dip between waves.
- `log-checkout-19` checkout-api INFO: Rollback pod startup line (v2.13.2, pg.pool.max=20); only confirms the rollback happened.
- `log-checkout-20` checkout-api INFO: Rollback pod startup line; only confirms the rollback happened.
- `log-checkout-23` checkout-api INFO: A single slow successful 200 during the dip between waves.
- `chat-general-vpn` #general: VPN slow: An IT VPN complaint in #general with no link to checkout, orders-db or the reporting schedule.
- `kb-incident-2041` INC-2041: checkout 500s after checkout-api v2.9 deploy: A checkout-only ORM N+1 regression with connections under budget; this incident spans multiple services and shows connection exhaustion.
- `kb-incident-2077` INC-2077: payment provider degradation: PSP degradation with 502s and payments-gateway p95 around 9s. Here the errors are 53300 and the gateway is normal, so it does not match.
- `alert-logging-disk` [FIRING] logging-host-02 disk usage > 90%: Disk has hovered 88-91% and flapped since 09:31, before the incident, with no link to checkout or orders-db.
- `chat-dan-deploy-guess` #inc-checkout: deploy suspected: An unverified guess based on timing alone. The 09:40 deploy preceded onset by 20 min, and the DB breakdown shows checkout-api within budget while inventory-service fails too.
- `metric-logging-host-disk` logging-host-02 /var/log disk usage: Flat around 88-91% before and during the incident.
- `deploy-checkout-api-2-14-0` checkout-api v2.14.0: Deployed 09:40; p95 and 5xx stayed normal for 20 min afterwards and connections stayed at budget, so it is unlikely to be the cause.
- `deploy-web-storefront-5-2-0` web-storefront v5.2.0: Frontend copy change with no API changes, deployed 08:30, long before the onset.
- `metric-payments-gateway-p95` payments-gateway (external PSP) p95 latency as seen by checkout-api: Flat at ~300ms throughout, so the external PSP is healthy and this is not a PSP incident like INC-2077.
- `deploy-inventory-service-1-9-3` inventory-service v1.9.3: A cache TTL bump from two days ago, unrelated to the onset.

## How the Investigation evolved

- **Wave 1** (scripted:1, 10:02; 12 tool calls): Checkout failures trace to orders-db-primary connection exhaustion (98/100) starting 10:00, exactly when reporting-worker (rescheduled to every 5 min at 09:55) opened 16 connections to the primary. The checkout-api deploy (09:40) and the logging disk alert don't fit the timing or the symptoms. The first action is to pause the reporting-worker schedule.
- **Wave 2** (scripted:2, 10:07; 11 tool calls): The per-application_name breakdown at 10:06 (log-ordersdb-04) shows reporting-worker holding 32 of 100 connections, because run 1005 overlapped run 1000 (log-reporting-04). Checkout-api is at 49, under its 60 budget. That confirms the reporting-worker hypothesis and weakens the checkout-api deploy theory, so I advise holding the rollback. The next reporting run fires at 10:10, so pausing the schedule is urgent. The payments gateway is healthy, so the double-charge worry is unconfirmed and needs a payment-capture reconciliation.
- **Wave 3** (scripted:3, 10:12; 7 tool calls): Run 1010 started at 10:10 with parallelism=16, and orders-db is still at 99-100/100. Checkout 5xx hit 6.1% at 10:11, so the third wave was predicted and nothing has been mitigated yet. Inventory-service errors confirm the shared-dependency picture and do not point at the checkout deploy. The edge 404 alert is unrelated bot noise.
- **Wave 4** (scripted:4, 10:18; 7 tool calls): Maya's 09:57 announcement confirms the cause: reporting-worker v3.8 shipped at 09:55 and her config tidy-up moved it from the replica to ORDERS_DB_URL, which is the primary. Nothing has been paused. Run 1015 started at 10:15 and caused a fourth wave (5xx 5.4-5.8%, DB 100/100 with reporting-worker=32). The VPN chat is noise.
- **Wave 5** (scripted:5, 10:25; 7 tool calls): Dan's rollback to 2.13.2 at 10:20 did not help. Run 1020 started at 10:20 and the 5-minute wave pattern continued at 10:20-10:25 with the DB at 99-100/100 and 5xx at 4.9-5.5%. That directly refutes the checkout-deploy hypothesis, and the reporting-worker schedule is still not paused. The payments team says no double charges, which resolves that question. Orphaned stock reservations and lost orders (about 180 tickets) remain.

## Evidence cited

| Id | Source | Observed | Title |
| --- | --- | --- | --- |
| `svc-checkout-api` | service (retrieved) | reference | Service catalogue: checkout-api |
| `svc-reporting-worker` | service (retrieved) | reference | Service catalogue: reporting-worker |
| `kb-incident-1987` | incident (retrieved) | reference | INC-1987: orders-db connection exhaustion during migration |
| `kb-runbook-db-connection-exhaustion` | runbook (retrieved) | reference | Runbook: orders-db connection exhaustion |
| `kb-incident-2041` | incident (retrieved) | reference | INC-2041: checkout 500s after checkout-api v2.9 deploy |
| `kb-runbook-checkout-5xx` | runbook (retrieved) | reference | Runbook: checkout-api elevated 5xx |
| `kb-incident-2077` | incident (retrieved) | reference | INC-2077: payment provider degradation |
| `deploy-inventory-service-1-9-3` | deploy (retrieved) | 2026-10-11 14:10 | inventory-service v1.9.3 |
| `deploy-web-storefront-5-2-0` | deploy (retrieved) | 08:30 | web-storefront v5.2.0 |
| `metric-logging-host-disk` | metric (retrieved) | 09:30 | logging-host-02 /var/log disk usage |
| `metric-checkout-5xx-ratio` | metric (retrieved) | 09:30 | checkout-api share of responses that are HTTP 5xx |
| `metric-checkout-p95-latency` | metric (retrieved) | 09:30 | checkout-api POST /checkout p95 latency |
| `metric-ordersdb-connections` | metric (retrieved) | 09:30 | orders-db-primary active client connections |
| `metric-payments-gateway-p95` | metric (retrieved) | 09:30 | payments-gateway (external PSP) p95 latency as seen by checkout-api |
| `metric-reporting-worker-running-jobs` | metric (retrieved) | 09:30 | reporting-worker concurrently running export jobs |
| `deploy-checkout-api-2-14-0` | deploy (retrieved) | 09:40 | checkout-api v2.14.0 |
| `log-reporting-01` | log (retrieved) | 09:55 | reporting-worker INFO |
| `log-ordersdb-02` | log (retrieved) | 09:56 | orders-db LOG |
| `chat-data-platform-announcement` | chat (pushed) | 09:57 | #data-platform-announcements: finance dashboard refresh |
| `log-reporting-02` | log (retrieved) | 10:00 | reporting-worker INFO |
| `log-reporting-03` | log (retrieved) | 10:00 | reporting-worker INFO |
| `alert-logging-disk` | alert (pushed) | 10:00 | [FIRING] logging-host-02 disk usage > 90% |
| `log-ordersdb-03` | log (retrieved) | 10:00 | orders-db FATAL |
| `log-checkout-10` | log (retrieved) | 10:00 | checkout-api ERROR |
| `log-inventory-03` | log (retrieved) | 10:01 | inventory-service ERROR |
| `log-checkout-11` | log (retrieved) | 10:01 | checkout-api ERROR |
| `alert-checkout-latency` | alert (pushed) | 10:01 | [FIRING] checkout-api p95 latency > 1500ms |
| `alert-checkout-5xx` | alert (pushed) | 10:01 | [FIRING] checkout-api 5xx ratio > 2% |
| `log-checkout-12` | log (retrieved) | 10:02 | checkout-api INFO |
| `log-checkout-13` | log (retrieved) | 10:03 | checkout-api INFO |
| `log-reporting-04` | log (retrieved) | 10:05 | reporting-worker WARN |
| `log-reporting-05` | log (retrieved) | 10:05 | reporting-worker INFO |
| `log-checkout-14` | log (retrieved) | 10:05 | checkout-api ERROR |
| `chat-cs-escalation` | chat (pushed) | 10:05 | #support-escalations: payment failures |
| `log-ordersdb-04` | log (retrieved) | 10:06 | orders-db LOG |
| `log-checkout-15` | log (retrieved) | 10:06 | checkout-api ERROR |
| `log-reporting-06` | log (retrieved) | 10:06 | reporting-worker INFO |
| `chat-dan-deploy-guess` | chat (pushed) | 10:06 | #inc-checkout: deploy suspected |
| `chat-priya-ack` | chat (pushed) | 10:06 | #inc-checkout: on-call ack |
| `log-ordersdb-05` | log (retrieved) | 10:07 | orders-db LOG |
| `log-edge-01` | log (retrieved) | 10:08 | edge-gateway INFO |
| `log-edge-02` | log (retrieved) | 10:08 | edge-gateway INFO |
| `alert-edge-404` | alert (pushed) | 10:09 | [FIRING] edge-gateway 404 spike on /legacy/cart/* |
| `log-edge-03` | log (retrieved) | 10:09 | edge-gateway INFO |
| `log-reporting-07` | log (retrieved) | 10:10 | reporting-worker INFO |
| `log-ordersdb-06` | log (retrieved) | 10:10 | orders-db FATAL |
| `alert-ordersdb-connections` | alert (pushed) | 10:10 | [FIRING] orders-db connections > 90% of max |
| `alert-inventory-errors` | alert (pushed) | 10:11 | [FIRING] inventory-service error rate > 5% |
| `log-reporting-08` | log (retrieved) | 10:11 | reporting-worker INFO |
| `chat-dan-inventory` | chat (pushed) | 10:12 | #inc-checkout: inventory also erroring |
| `log-reporting-09` | log (retrieved) | 10:15 | reporting-worker INFO |
| `chat-general-vpn` | chat (pushed) | 10:15 | #general: VPN slow |
| `log-ordersdb-07` | log (retrieved) | 10:16 | orders-db LOG |
| `log-reporting-10` | log (retrieved) | 10:16 | reporting-worker INFO |
| `log-reporting-11` | log (retrieved) | 10:20 | reporting-worker INFO |
| `deploy-checkout-api-2-13-2-rollback` | deploy (retrieved) | 10:20 | checkout-api v2.13.2 (rollback) |
| `log-checkout-19` | log (retrieved) | 10:20 | checkout-api INFO |
| `log-checkout-20` | log (retrieved) | 10:20 | checkout-api INFO |
| `log-checkout-21` | log (retrieved) | 10:20 | checkout-api ERROR |
| `log-reporting-12` | log (retrieved) | 10:21 | reporting-worker INFO |
| `log-checkout-22` | log (retrieved) | 10:22 | checkout-api ERROR |
| `chat-cs-impact-update` | chat (pushed) | 10:23 | #support-escalations: impact update |
| `log-checkout-23` | log (retrieved) | 10:23 | checkout-api INFO |
| `chat-dan-rollback-result` | chat (pushed) | 10:24 | #inc-checkout: rollback did not help |
| `alert-checkout-latency-still` | alert (pushed) | 10:25 | [STILL FIRING] checkout-api p95 latency |
