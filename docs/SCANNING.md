# SolveBeat Backend — How Scanning Works

This document explains the cybersecurity scan pipeline in simple, step-by-step language.

---

## 1. Big picture

When a user starts a scan, the API **does not wait** for all scanners to finish.

1. API creates a `scanId` and returns it immediately.
2. Background workers (BullMQ + Redis) run **11 scanner modules in two phases**.
3. Client polls progress, then fetches the final report — the response tells it exactly when to stop polling.

```
Client
  │
  ├─ POST /api/scan/start  ──►  scanId (fast response)
  │
  ├─ GET  /api/scan/progress/:scanId  ──►  { status, progress, isFinished }
  │
  └─ GET  /api/scan/result/:scanId    ──►  full report (when isFinished)
```

---

## 2. Prerequisites

| Dependency | Role |
|------------|------|
| **Node.js API** | Accepts HTTP requests, hosts BullMQ workers |
| **MongoDB** | Users / auth **and** scan/module/site data — everything is persisted, nothing lives only in memory |
| **Redis** | BullMQ job queues |
| **JWT auth** | All scan routes require `Authorization: Bearer <token>` |

Scan and per-module results are stored in MongoDB (`scans`, `scan_module_results`, `sites` collections) — they survive process restarts and are queryable for analytics. There is no TTL; a scan's data stays until you decide to prune it.

---

## 3. API endpoints

Base path: `/api/scan`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/start` | Required | Start scan, return `scanId` |
| `GET` | `/list` | Required | Paginated scan history for the current user |
| `GET` | `/progress/:scanId` | Required | Progress %, status, `isFinished` |
| `GET` | `/result/:scanId` | Required (**guests denied**) | Full report |

### Start body

```json
{ "sUrl": "https://example.com" }
```

### Start response (example)

```json
{
  "status": 200,
  "message": "...",
  "data": {
    "scanId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "queued"
  }
}
```

### List — `GET /api/scan/list`

Returns the current user's own scans only (scoped by `iUserId` from the JWT — never cross-user). All query params are optional.

| Query param | Type | Default | Notes |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | |
| `limit` | integer 1-100 | `20` | |
| `eStatus` | one of `queued`/`running`/`completed`/`partial`/`failed` | — | Exact match |
| `search` | string (max 255) | — | Case-insensitive substring match against `sUrl` |
| `dateFrom` / `dateTo` | ISO8601 date | — | Filters on `dCreatedAt` |
| `sortBy` | one of `dCreatedAt`/`dFinishedAt`/`nOverall` | `dCreatedAt` | Whitelisted — never a raw user-supplied Mongo field path |
| `sortOrder` | `asc`/`desc` | `desc` | |

```json
{
  "status": 200,
  "message": "Scan list retrieved successfully",
  "data": {
    "scans": [
      { "scanId": "...", "sUrl": "https://example.com", "status": "completed", "progress": 100, "isFinished": true, "nOverall": 57.1, "dCreatedAt": "...", "dFinishedAt": "..." }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```

Deliberately lightweight — no `oResults`/`oModules`/full findings, just enough for a history list. Use `/result/:scanId` for the full report on a specific scan.

### `isFinished` — the stop-polling signal

Both `/progress` and `/result` return `data.isFinished` (`true` once `eStatus` is `completed`, `partial`, or `failed`). The frontend should poll `/progress` until it sees `isFinished: true`, then call `/result` once — no need to guess from `status`/`progress` values.

---

## 4. End-to-end flow (step by step)

### Step 1 — Authenticate

Client sends JWT in header:

```http
Authorization: Bearer <access_token>
```

### Step 2 — Start scan (`POST /api/scan/start`)

1. Validate `sUrl` (http/https, domain or IPv4).
2. Upsert the user's **Site** rollup (`sites` collection) for this domain, incrementing `nTotalScans`.
3. Create a **Scan** document (MongoDB) — `scanId` (UUID), `sUrl`, `iUserId`, `iSiteId`, `eStatus: queued`, `nProgress: 0` — plus one **pending** `ScanModuleResult` document per module (11 total).
4. **Return `scanId` immediately** (does not wait for Redis enqueue or scanners).
5. In the background, enqueue **phase 1** of a BullMQ flow: a `phase1-gate` parent job with 8 independent module children.

### Step 3 — Phase 1: independent modules run in parallel

- Queue: `scan-module`. Concurrency: `SCAN_WORKER_CONCURRENCY` (default `5`).
- Each job payload: `{ scanId, sUrl, sModule }`.
- Modules: header, ssl, dns, javascript, seo, technology, performance, secret — none of these depend on any other module's output.

For each module job, per attempt:

1. Mark the module `running` in its `ScanModuleResult` doc (MongoDB), bump its attempt counter.
2. Call the registered scanner (`base.scanner` adds a per-attempt timeout).
3. **On success**: persist `oResult`/`nScore`, mark `completed`.
4. **On failure**: the job **throws**, so BullMQ retries — up to `SCAN_MODULE_MAX_ATTEMPTS` (default 3) attempts, with exponential backoff (`SCAN_MODULE_RETRY_BACKOFF_MS`, default 2000ms). Only once all attempts are exhausted does the module get one permanent `failed`/`timeout` record — it is never retried again after that.

One module's permanent failure **never blocks or delays any other module** — every module retries and finishes entirely on its own.

### Step 4 — Phase 1 gate → enqueue phase 2

Once all 8 phase-1 children have settled (succeeded or permanently failed), the `phase1-gate` job's own processor runs. Its only job: enqueue **phase 2** — a `scan-finalize` parent job with 3 children (infrastructure, threat, compliance).

### Step 5 — Phase 2: DB-dependent modules run

Same per-module job/retry mechanics as phase 1 (queue `scan-module`, same retry policy). The difference: infrastructure, threat, and compliance each read their sibling modules' results **directly from MongoDB** (a single query, via `engine/siblingResults.service.js`) — they don't scan anything themselves for that data, and there's no waiting/polling involved since phase ordering already guarantees phase 1 is fully done.

### Step 6 — `scan-finalize` merges results

- Queue: `scan-parent`. Runs once all 3 phase-2 children settle.
- Reads all 11 `ScanModuleResult` documents, computes the overall score, and sets the scan's final status:
  - `completed` — all 11 modules succeeded
  - `partial` — some permanently failed/timed out
  - `failed` — all permanently failed/timed out
- Sets `nProgress = 100`, `isFinished` becomes `true`.
- Updates the linked `Site` document (`nLastOverallScore`, `iLastScanId`, `dLastScannedAt`).

### Step 7 — Client polls

- **Progress** → `{ scanId, status, progress, isFinished }`
- **Result** → full public report once `isFinished: true` (registered users only). If still running → HTTP **202** with progress.

---

## 5. High-level architecture diagram

```text
POST /scan/start
       │
       ▼
Create Scan + 11 pending ScanModuleResult docs (MongoDB) ──► return scanId immediately
       │
       ▼ (background)
Enqueue phase1-gate (BullMQ flow) in Redis
       │
       ▼
8 independent module jobs (parallel, retry x3 each)
header, ssl, dns, javascript, seo, technology, performance, secret
       │
       ▼ (all 8 settled)
phase1-gate processor ──► enqueues scan-finalize flow
       │
       ▼
3 DB-dependent module jobs (parallel, retry x3 each)
infrastructure, threat, compliance — read siblings straight from MongoDB
       │
       ▼ (all 3 settled)
scan-finalize processor ──► merge + score + isFinished = true + update Site
       │
       ▼
GET /scan/progress/:scanId (poll until isFinished) → GET /scan/result/:scanId
```

---

## 6. The 11 scanner modules

All modules are registered in `models-routes-services/scan/scanners/index.js`.

| Module | What it does | Phase |
|--------|----------------|-------|
| **header** | Security headers (HSTS, CSP, XFO, CORS, disclosure…) | 1 — independent |
| **ssl** | Certificate + TLS version / strength | 1 — independent |
| **dns** | A/AAAA/MX/NS/TXT, SPF/DMARC/DKIM, CAA | 1 — independent |
| **technology** | Detect frontend/backend/CMS/CDN/hosting | 1 — independent |
| **javascript** | Scripts, libraries, client-side risks | 1 — independent |
| **secret** | Exposed keys/tokens in public assets | 1 — independent |
| **seo** | On-page SEO (title, meta, headings, links…) | 1 — independent |
| **performance** | TTFB, compression, cache, asset sizes | 1 — independent |
| **infrastructure** | Hosting/CDN/cloud/network from **sibling MongoDB data** | 2 — reads phase-1 results |
| **threat** | Correlate findings into threat assessment | 2 — reads phase-1 + infrastructure |
| **compliance** | Map findings → OWASP/CIS/NIST/PCI/GDPR/SOC2/ISO | 2 — reads all of phase 1 + threat |

### Dependency behavior (phase 2)

`infrastructure`, `threat`, and `compliance` don't scan the target for data other modules already gathered — they query the `scan_module_results` collection once (`engine/siblingResults.service.js`) and read what's there. Because they only start after phase 1 fully settles (Step 4 above), that data is always already complete — no wait/poll loop, no timeout envs for this anymore.

---

## 7. Per-module detail (what each produces)

### header
- Analyzes response headers.
- Returns score, grade, findings, recommendations.

### ssl
- Certificate subject/issuer/expiry, TLS flags.
- Findings for weak protocols / expiry.

### dns
- Records + email security (SPF/DMARC/DKIM).
- Score from DNS/email posture.

### technology
- Categories: frontend, backend, cms, server, cdn, hosting, analytics, libraries.
- Informational (`nScore` may be `null`).

### javascript
- Script inventory, library detection, secret-like patterns in JS.

### secret
- Pattern-based secret detection on public resources.
- Low score if secrets found.

### seo
- Title/meta/headings/images/links/structured data/social/robots/content.
- Homepage-only on-page analysis.

### performance
- Timings (DNS/TCP/TLS/TTFB/download), compression, cache, images/fonts, optimization flags.

### infrastructure
- Hosting, CDN, cloud, network (IPv4/IPv6/HTTPS/HSTS), email reuse from DNS, findings.

### threat
- Rule engine over sibling outputs + pluggable providers (`LocalProvider` = no external APIs yet).
- Attack-surface summary + threat findings.

### compliance
- Normalizes findings → maps to frameworks → per-framework pass/fail controls + overall compliance score.

---

## 8. Scan statuses

### Overall scan (`eStatus`)

| Status | Meaning |
|--------|---------|
| `queued` | Created; jobs being enqueued / not started |
| `running` | At least one module running |
| `completed` | All 11 modules finished successfully |
| `partial` | Finished, but some modules permanently failed/timed out |
| `failed` | All modules permanently failed/timed out, or enqueue/finalize failed |

### Per module (`oModules[module].eStatus`)

`pending` → `running` → `completed` | `failed` | `timeout`

A module can cycle `running` → (throw, retry) → `running` up to `SCAN_MODULE_MAX_ATTEMPTS` times before landing on a terminal state — the DB doc's `nAttempts` field shows how many tries it took.

---

## 9. Timeouts, retries & concurrency

| Setting | Default | Meaning |
|---------|---------|---------|
| `SCAN_MODULE_TIMEOUT_MS` | 30000 | Max time per module **attempt** (base.scanner) |
| `SCAN_MODULE_MAX_ATTEMPTS` | 3 | Retries per module before it's marked permanently failed |
| `SCAN_MODULE_RETRY_BACKOFF_MS` | 2000 | Exponential backoff base delay between attempts |
| `SCAN_WORKER_CONCURRENCY` | 5 | Parallel module jobs |
| `SCAN_PARENT_CONCURRENCY` | 2 | Parallel `phase1-gate`/`scan-finalize` jobs |

Each scanner may also have its own HTTP/DNS timeout env vars (see `.env.example`).

---

## 10. Logging (background)

Useful log prefixes while a scan runs:

```
[scan] [scanId] Start accepted — returning scanId
[scan] [scanId] Queueing background flow
[scan] [scanId] Flow enqueued

[scan.module] [scanId] [header] Job picked up
[scanner] [scanId] [header] Start
[scanner] [scanId] [header] Completed { elapsedMs, nScore, findings }
[scan.module] [scanId] [header] Finished

[scan.phase1-gate] [scanId] Phase 1 settled — enqueueing phase 2
[scan.finalize] [scanId] Merge started
[scan.finalize] [scanId] Merge finished
```

### Debug logging

Set `DEBUG_LOG=true` to also see `[DEBUG]`-prefixed lines: per-attempt detail on every module (including failed attempts, not just the final one), the phase-1 pass/fail summary before phase 2 is enqueued, and the full per-module pass/fail table right before `scan-finalize` sets `isFinished: true`. This is off by default — normal operation logs are unaffected either way.

---

## 11. Folder map (where code lives)

```
models-routes-services/scan/
  routes.js                 # Express routes
  services.js               # start / progress / result
  validators.js
  constants.js               # module list (phase 1 / phase 2 / combined), statuses, queue+job names
  models/                     # MongoDB schemas
    scan.model.js               # one doc per scan run
    scanModuleResult.model.js    # one doc per module per scan
    site.model.js                 # per-user, per-domain rollup for analytics
  engine/
    validation.service.js   # URL validation
    runtime.service.js      # Scan/ScanModuleResult read/write helpers
    merge.service.js        # scan-finalize merge + public report assembly
    score.service.js        # overall score
    siblingResults.service.js  # phase-2 modules' single MongoDB read of siblings
  queue/
    queue.service.js        # FlowProducer enqueue (phase 1) + worker registration
    module.worker.js         # runs one scanner attempt; throws to trigger BullMQ retry
    phase1Gate.worker.js      # enqueues phase 2 once phase 1 settles
    parent.worker.js           # scan-finalize processor (merge/score/Site update)
  scanners/
    index.js                # registry
    base.scanner.js         # per-attempt timeout wrapper
    header.scanner.js → header/
    ssl.scanner.js → ssl/
    ... (one folder per module)
```

Workers are registered at API boot via `helper/bullmqListener.js`.

---

## 12. Example curl flow

```bash
# 1) Start
curl -X POST "http://localhost:5000/api/scan/start" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"sUrl\": \"https://example.com\"}"

# 2) Progress (repeat until data.isFinished == true)
curl -X GET "http://localhost:5000/api/scan/progress/SCAN_ID" \
  -H "Authorization: Bearer YOUR_JWT"

# 3) Result (registered users only, once isFinished)
curl -X GET "http://localhost:5000/api/scan/result/SCAN_ID" \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 13. Design rules (important)

- Scanning is **passive** for production modules (no port scan, no exploit, no brute force).
- `/start` must stay **fast** — enqueue is fire-and-forget.
- Redis connections for BullMQ use **options objects** (separate connections for workers vs producers) so enqueue is not blocked by worker BRPOP.
- Every module job retries independently (`SCAN_MODULE_MAX_ATTEMPTS`) — one module's permanent failure never blocks, delays, or restarts any other module.
- All scan/module/site data is persisted in MongoDB — nothing lives only in memory, and there is no TTL to race against.
- Threat / Compliance / Infrastructure read sibling data from MongoDB by construction (phase ordering guarantees it's already there) — they must never re-scan data another module already produced.
- Guest users can start/progress; **result download is denied for guests**.

---

## 14. Related files

- Environment template: [`.env.example`](../.env.example)
- Scan routes: `models-routes-services/scan/routes.js`
- Queue wiring: `models-routes-services/scan/queue/queue.service.js`
- Overall repo layout: [CODE_STRUCTURE.md](./CODE_STRUCTURE.md)
- Coding rules (naming, response pattern, scan-specific rules): [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- Known bugs/scoring-model issues found via real-scan validation, not yet fixed: [ENGINE_IMPROVEMENTS.md](./ENGINE_IMPROVEMENTS.md)
