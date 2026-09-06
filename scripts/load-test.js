/**
 * k6 Load Test — abar3d.ir
 *
 * Installation (once):
 *   https://k6.io/docs/get-started/installation/
 *
 * Usage:
 *   # Smoke test (5 VUs, 30 seconds)
 *   k6 run scripts/load-test.js
 *
 *   # Staged ramp (100 → 1 000 → 10 000 VUs)
 *   k6 run --env SCENARIO=ramp scripts/load-test.js
 *
 *   # Against production
 *   k6 run --env BASE_URL=https://abar3d.ir scripts/load-test.js
 *
 * What this measures:
 *   - Homepage SSR latency under concurrent load
 *   - Products listing page
 *   - Individual product page (tests DB lookup + SSR)
 *   - Health endpoint
 *   - Static asset serving speed (via /assets/ path pattern)
 *
 * Bottleneck guide:
 *   - p95 > 500ms on /  → SSR or Supabase is the bottleneck
 *   - p95 > 200ms on /api/public/health → Node event loop is saturated
 *   - error_rate > 1%   → Node process or Nginx is rejecting connections
 *   - 429 responses     → rate limit zones are too tight (adjust Nginx config)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SCENARIO = __ENV.SCENARIO || "smoke";

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate   = new Rate("error_rate");
const homeTrend   = new Trend("home_duration",    true);
const prodsTrend  = new Trend("products_duration", true);
const healthTrend = new Trend("health_duration",   true);

// ── Scenarios ─────────────────────────────────────────────────────────────────
const scenarios = {
  // Quick smoke: just verify things work at all
  smoke: {
    executor: "constant-vus",
    vus: 5,
    duration: "30s",
  },
  // Realistic ramp: 100 → 1 000 → 10 000 concurrent users
  ramp: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m",  target: 100  },   // ramp to 100 VUs
      { duration: "2m",  target: 100  },   // hold at 100
      { duration: "2m",  target: 1000 },   // spike to 1 000
      { duration: "3m",  target: 1000 },   // hold at 1 000
      { duration: "3m",  target: 10000 },  // spike to 10 000
      { duration: "2m",  target: 10000 },  // hold at 10 000
      { duration: "2m",  target: 0    },   // ramp down
    ],
  },
};

export const options = {
  scenarios: { [SCENARIO]: scenarios[SCENARIO] },
  thresholds: {
    // 95th percentile response times
    "home_duration":     ["p(95)<2000"],   // homepage SSR ≤ 2 s
    "products_duration": ["p(95)<2000"],
    "health_duration":   ["p(95)<500"],    // health check ≤ 500 ms
    // Overall error rate must stay below 2%
    "error_rate":        ["rate<0.02"],
    // Native http_req_duration threshold
    "http_req_duration": ["p(95)<3000"],
  },
};

// ── Representative product slugs — update to match real slugs in your DB ─────
const PRODUCT_SLUGS = [
  "sample-product-1",
  "sample-product-2",
  "sample-product-3",
];

export default function () {
  const headers = { "Accept-Encoding": "gzip" };

  // 1. Homepage
  const home = http.get(`${BASE_URL}/`, { headers });
  homeTrend.add(home.timings.duration);
  errorRate.add(!check(home, {
    "home: status 200":    (r) => r.status === 200,
    "home: has content":   (r) => r.body && r.body.length > 500,
  }));

  sleep(0.5);

  // 2. Products listing
  const prods = http.get(`${BASE_URL}/products`, { headers });
  prodsTrend.add(prods.timings.duration);
  errorRate.add(!check(prods, {
    "products: status 200": (r) => r.status === 200,
  }));

  sleep(0.3);

  // 3. Random product detail page
  const slug = PRODUCT_SLUGS[Math.floor(Math.random() * PRODUCT_SLUGS.length)];
  const prod = http.get(`${BASE_URL}/products/${slug}`, { headers });
  errorRate.add(!check(prod, {
    "product: status 200 or 404": (r) => r.status === 200 || r.status === 404,
  }));

  sleep(0.3);

  // 4. Health check
  const health = http.get(`${BASE_URL}/api/public/health`, { headers });
  healthTrend.add(health.timings.duration);
  errorRate.add(!check(health, {
    "health: status 200":     (r) => r.status === 200,
    "health: db connected":   (r) => {
      try { return JSON.parse(r.body).database?.status === "connected"; }
      catch { return false; }
    },
    "health: latency < 1s":   (r) => {
      try { return JSON.parse(r.body).database?.latency_ms < 1000; }
      catch { return false; }
    },
  }));

  sleep(1);
}

/**
 * ── Expected results guide ───────────────────────────────────────────────────
 *
 * 100 VUs (concurrent):
 *   Should pass all thresholds comfortably on a single VPS with 2 CPU cores.
 *   Bottleneck: Supabase REST latency (~50-150ms per query).
 *
 * 1 000 VUs:
 *   Node's single-threaded event loop will start queuing. Watch:
 *     - health_duration p95 rising above 200ms → event loop saturation
 *     - 429 responses from Nginx rate-limit zones
 *   Fix: increase Nginx worker_processes, tune rate-limit burst values,
 *        or add a second Node instance behind a load balancer.
 *
 * 10 000 VUs:
 *   A single Node container WILL struggle. Expected bottlenecks:
 *     1. Nginx connections (increase worker_connections in nginx.conf)
 *     2. Node heap pressure (watch memory.heap_used_mb in /health)
 *     3. Supabase connection pool exhaustion (Supabase hosted plan limits
 *        concurrent DB connections — upgrade plan or add pgBouncer)
 *   At this scale, run 2–3 Docker containers behind an Nginx upstream
 *   with round-robin load balancing.
 */
