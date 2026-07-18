# SolveBeat Backend — How Scanning Works

This document explains the cybersecurity scan pipeline in simple, step-by-step language.

---

## 1. Big picture

When a user starts a scan, the API **does not wait** for all scanners to finish.

1. API creates a `scanId` and returns it immediately.
2. Background workers (BullMQ + Redis) run **11 scanner modules**.
3. Client polls progress, then fetches the final report.

```
Client
  │
  ├─ POST /api/scan/start  ──►  scanId (fast response)
  │
  ├─ GET  /api/scan/progress/:scanId  ──►  { status, progress }
  │
  └─ GET  /api/scan/result/:scanId    ──►  full report (when done)
```

---

## 2. Prerequisites

| Dependency | Role |
|------------|------|
| **Node.js API** | Accepts HTTP requests, hosts BullMQ workers |
| **MongoDB** | Users / auth (not used to store scan results today) |
| **Redis** | BullMQ job queues |
| **JWT auth** | All scan routes require `Authorization: Bearer <token>` |

Scan results live in an **in-memory ScanContext** (Map) with a TTL (default 10 minutes). They are **not** persisted to MongoDB.

---

## 3. API endpoints

Base path: `/api/scan`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/start` | Required | Start scan, return `scanId` |
| `GET` | `/progress/:scanId` | Required | Progress % and status |
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

---

## 4. End-to-end flow (step by step)

### Step 1 — Authenticate

Client sends JWT in header:

```http
Authorization: Bearer <access_token>
```

### Step 2 — Start scan (`POST /api/scan/start`)

1. Validate `sUrl` (http/https, domain or IPv4).
2. Create **ScanContext** in memory:
   - `scanId` (UUID)
   - `sUrl`
   - module slots for all 11 scanners (`pending`)
   - `eStatus = queued`, `nProgress = 0`
3. **Return `scanId` immediately** (does not wait for Redis enqueue or scanners).
4. In the background, enqueue a BullMQ **flow**:
   - 11 **child** jobs (one per scanner module)
   - 1 **parent** job (runs only after all children finish)

### Step 3 — Module workers run scanners (parallel)

- Queue: `scan-module`
- Concurrency: `SCAN_WORKER_CONCURRENCY` (default `5`)
- Each job payload: `{ scanId, sUrl, sModule }`

For each module:

1. Mark module `running` in ScanContext.
2. Call the registered scanner (`base.scanner` adds timeout).
3. Store `oResult`, `nScore`, `eStatus` (`completed` / `failed` / `timeout`).
4. Update overall `nProgress` (up to 99% until parent merge).

One module failing **does not** stop the others.

### Step 4 — Parent worker merges results

- Queue: `scan-parent`
- Runs after all children settle.

Parent:

1. Collects all module results into `oResults`.
2. Calculates overall score (`oScores.nOverall`).
3. Sets final status:
   - `completed` — all modules succeeded
   - `partial` — some failed/timed out
   - `failed` — all failed/timed out
4. Sets `nProgress = 100`.

### Step 5 — Client polls

- **Progress** → `{ scanId, status, progress }`
- **Result** → full public report when status is `completed` / `partial` / `failed`  
  If still running → HTTP **202** with progress.

---

## 5. High-level architecture diagram

```text
POST /scan/start
       │
       ▼
Create ScanContext (in memory) ──► return scanId immediately
       │
       ▼ (background)
Enqueue BullMQ flow in Redis
       │
       ├──────────────────────────────┐
       ▼                              ▼
11 module workers (parallel)     Parent job (waits for children)
header, ssl, dns, js, ...              │
       │                              ▼
       │                       Merge results + overall score
       │                              │
       └──────────────┬───────────────┘
                      ▼
              GET /scan/result/:scanId
```

---

## 6. The 11 scanner modules

All modules are registered in `models-routes-services/scan/scanners/index.js`.

| Module | What it does | Network? |
|--------|----------------|----------|
| **header** | Security headers (HSTS, CSP, XFO, CORS, disclosure…) | 1 homepage HTTP request |
| **ssl** | Certificate + TLS version / strength | 1 TLS connect |
| **dns** | A/AAAA/MX/NS/TXT, SPF/DMARC/DKIM, CAA | DNS lookups only |
| **technology** | Detect frontend/backend/CMS/CDN/hosting | 1 homepage fetch |
| **javascript** | Scripts, libraries, client-side risks | Homepage + linked JS (capped) |
| **secret** | Exposed keys/tokens in public assets | Homepage + linked resources (capped) |
| **seo** | On-page SEO (title, meta, headings, links…) | Homepage + limited HEAD checks |
| **performance** | TTFB, compression, cache, asset sizes | Homepage + resource probes (capped) |
| **infrastructure** | Hosting/CDN/cloud/network from **other results** | Prefer reuse; fallback GET/DNS only if needed |
| **threat** | Correlate findings into threat assessment | **No new scan** — waits on siblings |
| **compliance** | Map findings → OWASP/CIS/NIST/PCI/GDPR/SOC2/ISO | **No new scan** — waits on siblings |

### Important dependency behavior

Most scanners start in parallel. These two **wait** for sibling outputs (with timeouts):

| Module | Waits for | Wait env |
|--------|-----------|----------|
| **infrastructure** | header, ssl, dns, technology, performance | `SCAN_INFRA_WAIT_MS` |
| **threat** | above + javascript, secret, seo, infrastructure | `SCAN_THREAT_WAIT_MS` |
| **compliance** | all scanners including threat | `SCAN_COMPLIANCE_WAIT_MS` |

They do **not** re-run the other scanners; they read ScanContext.

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
| `completed` | All modules finished successfully |
| `partial` | Finished, but some modules failed/timed out |
| `failed` | All modules failed/timed out, or enqueue failed |

### Per module (`oModules[module].eStatus`)

`pending` → `running` → `completed` | `failed` | `timeout`

---

## 9. Timeouts & concurrency

| Setting | Default | Meaning |
|---------|---------|---------|
| `SCAN_MODULE_TIMEOUT_MS` | 30000 | Max time per module (base.scanner) |
| `SCAN_WORKER_CONCURRENCY` | 5 | Parallel module jobs |
| `SCAN_PARENT_CONCURRENCY` | 2 | Parallel parent merge jobs |
| `SCAN_CONTEXT_TTL_MS` | 600000 | In-memory context TTL (10 min) |

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

[scan.parent] [scanId] Merge started
[scan.parent] [scanId] Child module statuses
[scan.parent] [scanId] Merge finished
```

---

## 11. Folder map (where code lives)

```
models-routes-services/scan/
  routes.js                 # Express routes
  services.js               # start / progress / result
  validators.js
  constants.js              # module list, statuses, queue names
  context/runtimeStore.js   # in-memory Map + TTL
  engine/
    validation.service.js   # URL validation
    runtime.service.js      # ScanContext helpers
    merge.service.js        # parent merge + public report
    score.service.js        # overall score
  queue/
    queue.service.js        # FlowProducer enqueue + workers boot
    module.worker.js        # runs one scanner
    parent.worker.js        # merge after children
  scanners/
    index.js                # registry
    base.scanner.js         # timeout wrapper
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

# 2) Progress (repeat until progress == 100)
curl -X GET "http://localhost:5000/api/scan/progress/SCAN_ID" \
  -H "Authorization: Bearer YOUR_JWT"

# 3) Result (registered users only)
curl -X GET "http://localhost:5000/api/scan/result/SCAN_ID" \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 13. Design rules (important)

- Scanning is **passive** for production modules (no port scan, no exploit, no brute force).
- `/start` must stay **fast** — enqueue is fire-and-forget.
- Redis connections for BullMQ use **options objects** (separate connections for workers vs producers) so enqueue is not blocked by worker BRPOP.
- Threat / Compliance / Infrastructure prefer **reusing** sibling ScanContext data.
- Guest users can start/progress; **result download is denied for guests**.

---

## 14. Related files

- Environment template: [`.env.example`](../.env.example)
- Scan routes: `models-routes-services/scan/routes.js`
- Queue wiring: `models-routes-services/scan/queue/queue.service.js`
