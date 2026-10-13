import type { KnowledgeDoc } from "./types";

export const knowledge: KnowledgeDoc[] = [
  {
    id: "kb-runbook-db-connection-exhaustion",
    kind: "runbook",
    title: "Runbook: orders-db connection exhaustion",
    date: "2026-04-02",
    body: `Symptoms: "sorry, too many clients already" (SQLSTATE 53300) or pool acquire timeouts in more than one service at once. Checkout and inventory usually fail together because both share orders-db-primary.

1. Confirm saturation: compare active connections to max_connections=100 on orders-db-primary.
2. Find who holds connections: group pg_stat_activity (or pgwatch "connections by application_name") by application_name. Compare against the connection budget (checkout-api 60, inventory-service 20, admin 5). Anything outside the budget is the first suspect.
3. If a batch or analytics workload is on the primary, pause it first (scale to zero, or pause its schedule). Batch workloads must use orders-db-replica.
4. Do not raise max_connections as a first response; it trades errors for memory pressure.
5. Do not roll back application deploys unless their connection count grew; rollbacks recycle pools and briefly make saturation worse.
6. After recovery: terminate idle-in-transaction sessions older than 5m if any remain.`,
  },
  {
    id: "kb-runbook-checkout-5xx",
    kind: "runbook",
    title: "Runbook: checkout-api elevated 5xx",
    date: "2026-07-15",
    body: `Triage order for checkout 5xx:
1. Recent change? List deploys in the last 2h for checkout-api AND its dependencies (inventory-service, orders-db, payments-gateway). Check timing: symptoms that start long after a deploy finishes, or that also appear in services that did not deploy, point away from that deploy.
2. Dependency health: payments-gateway p95 (normal ~300ms) and the PSP status page; orders-db connections and latency; inventory-service errors.
3. Error shape: 502 from payments-gateway means PSP trouble; 53300 or pool timeouts mean database capacity; 500 with stack traces in new code means a regression.
4. Customer impact: ask Support for ticket volume and check payment capture vs order insert failures (double-charge risk only exists if capture succeeded).
5. Rollback criteria: roll back checkout-api if errors started within 10 minutes of a checkout deploy and are thrown from new code paths.`,
  },
  {
    id: "kb-runbook-checkout-rollback",
    kind: "runbook",
    title: "Runbook: rolling back checkout-api",
    date: "2026-05-20",
    body: `1. Announce in #inc-checkout. 2. argo-cd: sync checkout-api to the previous tagged release. 3. Watch pods become ready (about 90s); each new pod opens a fresh pg pool (max 20), so connection counts spike briefly. 4. Verify p95 and 5xx within 5 minutes. If metrics do not improve, the deploy was not the cause: stop and re-investigate rather than rolling back further.`,
  },
  {
    id: "kb-incident-2041",
    kind: "incident",
    title: "INC-2041: checkout 500s after checkout-api v2.9 deploy",
    date: "2026-06-02",
    body: `Summary: checkout-api v2.9.0 introduced an ORM upgrade that issued N+1 queries on basket load. p95 rose from 180ms to 3s and 5xx reached 6% within 4 minutes of the deploy.
Signals: errors were stack traces from the new ORM code path; only checkout-api was affected; orders-db CPU rose but connections stayed under budget.
Resolution: rollback to v2.8.4 at +15m restored service immediately.
Lesson: canary should catch query-count regressions; added a query-count check to the canary.`,
  },
  {
    id: "kb-incident-1987",
    kind: "incident",
    title: "INC-1987: orders-db connection exhaustion during migration",
    date: "2026-03-18",
    body: `Summary: a long-running backfill migration run against orders-db-primary held 30+ connections for 40 minutes. checkout-api and inventory-service both failed with "too many clients already". A checkout rollback was tried first and did not help.
Signals: failures in multiple services sharing orders-db; pg_stat_activity showed a non-application consumer holding connections.
Resolution: paused the backfill; recovered within 2 minutes.
Action items: per-service connection budget; batch and analytics workloads must use orders-db-replica; pgbouncer evaluation (still open).`,
  },
  {
    id: "kb-incident-2077",
    kind: "incident",
    title: "INC-2077: payment provider degradation",
    date: "2026-08-21",
    body: `Summary: the external PSP had a partial outage. checkout-api returned 502s on payment capture; payments-gateway p95 went from 300ms to 9s.
Signals: errors were 502 from payments-gateway with PSP error codes; orders were inserted but capture failed, which caused double-charge risk on retry.
Resolution: enabled the payment retry queue and posted a status page notice; PSP recovered after 35 minutes.`,
  },
];
