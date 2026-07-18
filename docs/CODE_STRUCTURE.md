# SolveBeat Backend — Code Structure

This document maps out where things live in `cyber-backend` and how the pieces connect. For how the scan engine specifically works, see [SCANNING.md](./SCANNING.md).

---

## 1. Top-level layout

```
cyber-backend/
├── index.js                 # App entry point — boots Express, Socket.IO, BullMQ
├── data.js                   # Shared enums (eStatus, eRole, eAuthProvider, ...)
├── socket.js                  # Socket.IO event wiring
├── config/
│   ├── config.js              # Resolved runtime config (reads env + defaults)
│   ├── common.js               # Shared/static config values
│   ├── dbConfig.js              # MongoDB connection options
│   └── defaultConfig.js          # Fallback defaults
├── database/
│   └── mongoose.js              # Mongoose connection (DBConnect)
├── helper/
│   ├── api.responses.js          # HTTP status codes + i18n message catalog
│   ├── utilities.services.js      # ObjectId(), getIp(), catchError()
│   ├── jwt.services.js            # Sign/verify access, refresh, guest tokens
│   ├── email.services.js           # Nodemailer + EJS templated emails
│   ├── redis.js                     # ioredis client(s)
│   ├── bullmq.js                     # BullMQ connection factories
│   └── bullmqListener.js              # Registers all queue workers at boot
├── middlewares/
│   ├── index.js                # Global middleware (helmet, cors, body-parser, language, etc.)
│   ├── routes.js                 # Mounts feature routers under /api/*
│   ├── auth.middleware.js         # validate, isUserAuthenticated, denyGuest
│   └── common.js                    # Shared middleware helpers
├── models-routes-services/
│   ├── auth/                   # OTP, Google, guest, refresh, logout
│   ├── user/                    # User model + profile routes
│   ├── otp/                      # OTP model (used internally by auth)
│   ├── refreshToken/               # Refresh token model
│   └── scan/                        # Scan engine (see below + SCANNING.md)
├── scripts/                    # One-off / maintenance scripts (not part of the running app)
├── templates/                  # EJS templates (emails, etc.)
├── docs/                       # This file, SCANNING.md, CODING_STANDARDS.md
└── .env.example                # Documented environment variables
```

---

## 2. Feature module shape

Every feature under `models-routes-services/<feature>/` follows the same shape:

| File | Responsibility |
|------|-----------------|
| `routes.js` | Express `Router()` — wires path → validators → middleware → service function. No logic here. |
| `validators.js` | `express-validator` chains, one array export per route. |
| `services.js` | Actual request handlers (`featureServices.actionName = async (req, res) => {...}`). Talks to models, helpers, external APIs. |
| `model.js` | Mongoose schema + model (only for features backed by MongoDB). |

Example — `auth`:

```
models-routes-services/auth/
├── routes.js       # POST /send-otp, /verify-otp, /google, /guest, /refresh, /logout
├── validators.js   # per-route body() validation chains
└── services.js     # sendOtp, verifyOtp, googleLogin, guestLogin, refresh, logout
```

Routes are mounted centrally in [`middlewares/routes.js`](../middlewares/routes.js) under a base path (e.g. `/api/auth`, `/api/scan`).

---

## 3. Request lifecycle

```
index.js
  → middlewares/index.js     (helmet, cors, body-parser, compression, language detection)
  → middlewares/routes.js    (mounts /api/auth, /api/scan, health-check, 404 handler)
       → <feature>/routes.js
            → validators.js (express-validator chains)
            → auth.middleware.js  (validate / isUserAuthenticated / denyGuest, as needed)
            → services.js   (handler — business logic, DB/queue calls, response)
```

Every response goes out as `res.status(<code>).jsonp({ status, message, data? })` using the codes/messages from [`helper/api.responses.js`](../helper/api.responses.js) — see [CODING_STANDARDS.md](./CODING_STANDARDS.md) for the exact pattern.

---

## 4. The scan engine (high-level pointer)

`models-routes-services/scan/` is the largest and most complex module — 11 independent scanner packages plus orchestration (queue, context, merge/score engine). It has its own dedicated doc: **[SCANNING.md](./SCANNING.md)**. Don't duplicate that detail here; read it before touching anything under `scan/`.

Folder shape for each scanner (`scanners/<name>/`):

```
<name>/
├── constants.js       # timeouts, limits, env-driven config for this scanner
├── service.js          # entry point called by scanners/index.js registry
├── scoring.js / scoring.service.js   # turns findings into a 0-100 nScore
├── types.js             # JSDoc typedefs for the scanner's result shape
├── analyzers/             # one file per sub-check, pure functions over fetched data
└── http.client.js          # scanner-specific fetch wrapper (timeout, UA, size caps)
```

---

## 5. Cross-cutting concerns

| Concern | Where |
|---------|-------|
| Auth (JWT decode, guest/user check) | `middlewares/auth.middleware.js` |
| Central error handling | `helper/utilities.services.js` → `catchError()` |
| i18n messages | `helper/api.responses.js` → `messages[req.userLanguage]` |
| Enums (roles, statuses, providers) | `data.js` |
| Queues / background jobs | `helper/bullmq.js`, `helper/bullmqListener.js`, `models-routes-services/scan/queue/` |
| Config / env access | `config/config.js` merges `dbConfig`, `thirdPartyConfig`, `defaultConfig` + `NODE_ENV` (see [CODING_STANDARDS.md](./CODING_STANDARDS.md) for the rule on using it instead of raw `process.env`) |

---

## 6. Related docs

- [SCANNING.md](./SCANNING.md) — full scan pipeline walkthrough
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — naming conventions and rules to follow when writing code here
- [postman/SolveBeat-Backend.postman_collection.json](./postman/SolveBeat-Backend.postman_collection.json) — importable Postman collection covering every mounted route (`/api/health-check`, `/api/auth/*`, `/api/scan/*`), with required/optional field notes on each request

## 7. Known dead code (not wired up)

`models-routes-services/user/` (`routes.js`, `services.js`, `validators.js`) defines a `PUT /user/logout/v1` route, but it is **not** mounted in `middlewares/routes.js` (only `auth` and `scan` are). It also doesn't follow the conventions in [CODING_STANDARDS.md](./CODING_STANDARDS.md) (4-space indent, `res.json` instead of the `status`/`jsonStatus`/`messages` pattern, no `catchError`) — it predates the current auth system and was superseded by `models-routes-services/auth/routes.js`'s `/logout`. Left in place for now since removing it wasn't asked for; flagging here so it isn't mistaken for a real, reachable endpoint.
