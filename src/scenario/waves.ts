import { at } from "./time";
import type { ScenarioWave } from "./types";

export const INCIDENT_TITLE = "Checkout failing intermittently";

export const waves: ScenarioWave[] = [
  {
    number: 1,
    at: at("10:02"),
    label: "Pages fire",
    evidence: [
      {
        id: "alert-checkout-latency",
        source: "alert",
        title: "[FIRING] checkout-api p95 latency > 1500ms",
        body: "PagerDuty P2 · checkout-api p95 latency 2,640ms for 2m (threshold 1,500ms). Routed to: sre-primary (@priya).",
        service: "checkout-api",
        observedAt: at("10:01:20"),
      },
      {
        id: "alert-checkout-5xx",
        source: "alert",
        title: "[FIRING] checkout-api 5xx ratio > 2%",
        body: "PagerDuty P2 · checkout-api HTTP 5xx ratio 4.1% over 5m (threshold 2%). Endpoint breakdown: POST /checkout 93%, GET /cart 7%.",
        service: "checkout-api",
        observedAt: at("10:01:50"),
      },
      {
        id: "alert-logging-disk",
        source: "alert",
        title: "[FIRING] logging-host-02 disk usage > 90%",
        body: "Grafana alert · logging-host-02 /var/log 91% (threshold 90%). History: fired 09:31, resolved 09:44, fired 09:52, resolved 09:58, fired 10:00. Owner: observability.",
        service: "logging-host",
        observedAt: at("10:00:10"),
      },
    ],
  },
  {
    number: 2,
    at: at("10:07"),
    label: "Humans join",
    evidence: [
      {
        id: "chat-cs-escalation",
        source: "chat",
        title: "#support-escalations: payment failures",
        body: "@leah (Customer Support, 10:05): we're getting a wave of tickets — 'payment failed' or stuck spinning on 'Placing order…'. ~40 tickets in 10 min, mostly UK/EU. A couple of people asking if they were charged twice?? not sure yet.",
        service: null,
        observedAt: at("10:05:30"),
      },
      {
        id: "chat-dan-deploy-guess",
        source: "chat",
        title: "#inc-checkout: deploy suspected",
        body: "@dan (Checkout team, 10:06): checkout-api 2.14 went out at 9:40 — it had the node-postgres driver bump in it. probably that tbh. want me to roll back?",
        service: "checkout-api",
        observedAt: at("10:06:12"),
      },
      {
        id: "chat-priya-ack",
        source: "chat",
        title: "#inc-checkout: on-call ack",
        body: "@priya (SRE on-call, 10:07): acking both pages. dan — prep the rollback but hold for a few mins while we look. anyone touched orders-db today?",
        service: null,
        observedAt: at("10:06:58"),
      },
    ],
  },
  {
    number: 3,
    at: at("10:12"),
    label: "Blast radius grows",
    evidence: [
      {
        id: "alert-ordersdb-connections",
        source: "alert",
        title: "[FIRING] orders-db connections > 90% of max",
        body: "Grafana alert · orders-db-primary active connections 97/100 (>90% for 5m). Owner: platform-db.",
        service: "orders-db",
        observedAt: at("10:10:40"),
      },
      {
        id: "alert-inventory-errors",
        source: "alert",
        title: "[FIRING] inventory-service error rate > 5%",
        body: "PagerDuty P3 · inventory-service error ratio 6.2% over 5m. Top error: reserveStock upstream failure.",
        service: "inventory-service",
        observedAt: at("10:11:15"),
      },
      {
        id: "alert-edge-404",
        source: "alert",
        title: "[FIRING] edge-gateway 404 spike on /legacy/cart/*",
        body: "Grafana alert · edge-gateway 404 responses 1,240/min on /legacy/cart/* (baseline 30/min). Top user agent: SemrushBot/7~bl. Owner: storefront.",
        service: "edge-gateway",
        observedAt: at("10:09:05"),
      },
      {
        id: "chat-dan-inventory",
        source: "chat",
        title: "#inc-checkout: inventory also erroring",
        body: "@dan (10:12): wait, inventory-service is paging too and they haven't deployed since saturday?? weird. rollback still ready when you want it.",
        service: "inventory-service",
        observedAt: at("10:12:00"),
      },
    ],
  },
  {
    number: 4,
    at: at("10:18"),
    label: "A message from elsewhere",
    evidence: [
      {
        id: "chat-data-platform-announcement",
        source: "chat",
        title: "#data-platform-announcements: finance dashboard refresh",
        body: "@maya (Data Platform, 09:57): 📊 Finance dashboard now refreshes every 5 minutes instead of nightly! reporting-worker v3.8 rolled out at 09:55. Also tidied config — moved everything to ORDERS_DB_URL since the replica alias is being deprecated. Shout in #data-platform with questions 🙌 (reshared into #inc-checkout by @priya at 10:17)",
        service: "reporting-worker",
        observedAt: at("09:57:40"),
      },
      {
        id: "chat-general-vpn",
        source: "chat",
        title: "#general: VPN slow",
        body: "@tom (IT, 10:15): anyone else's VPN really slow this morning? zoom keeps dropping.",
        service: null,
        observedAt: at("10:15:22"),
      },
    ],
  },
  {
    number: 5,
    at: at("10:25"),
    label: "Rollback lands",
    evidence: [
      {
        id: "chat-dan-rollback-result",
        source: "chat",
        title: "#inc-checkout: rollback did not help",
        body: "@dan (10:24): went ahead and rolled back to checkout-api 2.13.2 at 10:20 since it was low risk. latency still spiky and 5xx still ~5%. so... not the deploy?",
        service: "checkout-api",
        observedAt: at("10:24:10"),
      },
      {
        id: "chat-cs-impact-update",
        source: "chat",
        title: "#support-escalations: impact update",
        body: "@leah (10:23): ~180 tickets now. payments team confirmed no double charges — the failed orders never reached payment capture. customers are retrying and some are giving up.",
        service: null,
        observedAt: at("10:23:30"),
      },
      {
        id: "alert-checkout-latency-still",
        source: "alert",
        title: "[STILL FIRING] checkout-api p95 latency",
        body: "PagerDuty P2 escalated to P1 after 20m unresolved · checkout-api p95 2,410ms. Pattern annotation from Grafana: latency spikes recur roughly every 5 minutes (10:00, 10:05, 10:10, 10:15, 10:20).",
        service: "checkout-api",
        observedAt: at("10:25:00"),
      },
    ],
  },
];
