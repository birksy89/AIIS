import { at } from "./time";
import type { Deploy } from "./types";

export const deploys: Deploy[] = [
  {
    id: "deploy-inventory-service-1-9-3",
    service: "inventory-service",
    version: "v1.9.3",
    at: at("14:10", "2026-10-11"),
    author: "@sam (Fulfilment)",
    pipeline: "argo-cd",
    notes: "Bump SKU cache TTL from 30s to 60s.",
  },
  {
    id: "deploy-web-storefront-5-2-0",
    service: "web-storefront",
    version: "v5.2.0",
    at: at("08:30"),
    author: "@ines (Storefront)",
    pipeline: "argo-cd",
    notes: "Autumn banner, copy changes on basket page. No API changes.",
  },
  {
    id: "deploy-checkout-api-2-14-0",
    service: "checkout-api",
    version: "v2.14.0",
    at: at("09:40"),
    author: "@dan (Checkout)",
    pipeline: "argo-cd",
    notes:
      "Add promo code validation endpoint. Bump node-postgres 8.11.3 -> 8.12.0 (patch notes: pool idle timeout fix). No pool size or query changes. Canary 10% for 10m passed (p95 181ms, 5xx 0.2%).",
  },
  {
    id: "deploy-checkout-api-2-13-2-rollback",
    service: "checkout-api",
    version: "v2.13.2 (rollback)",
    at: at("10:20"),
    author: "@dan (Checkout)",
    pipeline: "argo-cd",
    notes: "Rollback of v2.14.0 during incident.",
  },
];
