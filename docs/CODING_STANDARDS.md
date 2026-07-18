# SolveBeat Backend — Coding Standards

These are the rules to follow for **any** code added or changed in this repo. They're distilled from existing patterns in the codebase (auth, scan modules) — the goal is consistency, not novelty. If you're about to write something that doesn't fit these rules, prefer changing your approach over adding a one-off exception.

See [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) for where things live.

---

## 1. Style / lint

- ESLint config: `neostandard` (flat config, `eslint.config.js`) — the actively-maintained flat-config successor to `eslint-config-standard`, run under ESLint 9. Scripts: `npm run lint` (check) / `npm run lint:fix` (auto-fix).
- 2-space indentation, **no semicolons**, single quotes — this is what `standard`/`neostandard` enforces; don't fight it.
- `max-lines` / `max-lines-per-function` are capped at 3000 in `eslint.config.js` as a hard ceiling, not a target — in practice keep functions and files far shorter. If a `service.js` or scanner file is growing past a few hundred lines, split it (see §5 module shape).

### 1.1 Mandatory: lint after every code change

**Every time you write or edit code, run `npm run lint` (or `npx eslint <changed files>`) immediately after, before treating the change as done.**

- If lint reports errors in a file you just touched, fix them before moving on — don't leave newly introduced lint errors in the codebase.
- If lint reports errors in files you did **not** touch, leave them alone (don't scope-creep an unrelated fix into your change) but call them out explicitly so they're not silently ignored.
- Never disable a rule (`eslint-disable`) or edit `eslint.config.js` to make an error go away — fix the underlying code instead. If a rule is genuinely wrong for a legitimate pattern, raise it with the user rather than silencing it inline.
- Known baseline: as of 2026-07-18 (post ESLint 9 / `neostandard` migration), `npm run lint` reports 27 pre-existing errors (mostly `quotes`, `no-unused-vars`, `prefer-const`, `no-useless-escape`, `promise/param-names`, and indentation in `models-routes-services/user/services.js`). These predate this rule and are not blocking for unrelated work, but any file from that list that you end up touching should be cleaned up as part of your change. `helper/redis.js` and `models-routes-services/scan/scanners/seo/http.client.js` previously showed as **parse errors** under the old ESLint 8 config (`ecmaVersion: 2020`) — that was a false alarm caused by the outdated parser rejecting newer syntax (e.g. numeric separators / logical assignment operators); both parse cleanly now and only have ordinary style errors. Two of the 27 (`isUserAuthenticated`/`denyGuest` unused in `models-routes-services/scan/routes.js`) come from a local, uncommitted removal of auth middleware on the scan routes — not part of the shipped baseline; restore the middleware and they disappear.

## 2. Naming convention — Hungarian-style prefixes

Every field, variable, and DB column uses a type-indicating prefix. Keep this consistent everywhere (request bodies, Mongoose schemas, in-memory context objects, function locals holding those values):

| Prefix | Type | Example |
|--------|------|---------|
| `s` | String | `sEmail`, `sName`, `sUrl`, `sTokenHash` |
| `n` | Number | `nScore`, `nAttempts`, `nProgress` |
| `e` | Enum (fixed set of string values, defined in `data.js` or a module's own `constants.js`) | `eStatus`, `eRole`, `eAuthProvider` |
| `o` | Object / nested structure | `oResults`, `oScores`, `oModules` |
| `d` | Date | `dExpiresAt`, `dCreatedAt`, `dLastLogin` |
| `i` | ObjectId / foreign key reference | `iUserId` |
| `a` | Array | `aCompetitionId`, `aContentIds` |

Enums themselves follow the `{ value: [...], map: { KEY: 'VALUE' } }` shape (see `data.js`) — `value` for schema `enum:` validation, `map` for referencing the constant in code (`eRole.map.GUEST`, never the raw string `'GUEST'`).

## 3. Feature module shape

Every route-bearing feature lives under `models-routes-services/<feature>/` with this split — don't collapse it into a single file, and don't put logic in `routes.js`:

```
routes.js       → router.method(path, ...validators.x, validate, service.x)
validators.js   → express-validator chains only
services.js     → business logic, one exported function per action
model.js        → Mongoose schema (only if the feature is DB-backed)
```

Route handlers are named `<featureServices>.<actionName>` (e.g. `authServices.sendOtp`), matching the route path's intent, not the HTTP verb.

## 4. Request handler pattern

Every service function follows this exact shape — copy it, don't improvise a new error-handling style:

```js
featureServices.actionName = async (req, res) => {
  try {
    // ...logic...
    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      message: msg(req).some_key,
      data: { ... } // omit if there's nothing to return
    })
  } catch (error) {
    return catchError('feature.actionName', error, req, res)
  }
}
```

Rules that go with this:

- **Always** wrap the handler body in try/catch and delegate unexpected errors to `catchError(name, error, req, res)` from `helper/utilities.services.js`. Never let an error reach Express's default handler or leak a raw error/stack to the client.
- **Always** respond via `res.status(<code>).jsonp({ status, message, data })` using the numeric/status pairs from `helper/api.responses.js` (`status.OK` / `jsonStatus.OK`, etc.) — never hardcode a status code or write plain `res.json(...)`.
- **Always** source user-facing text from `messages[req.userLanguage] || messages.English` (the `msg(req)` helper pattern in `auth/services.js`) — never inline a message string in a service file. Add new keys to `helper/api.responses.js`, not ad hoc.
- Use the `'##'` placeholder + `.replace('##', 'X')` convention for generic templated messages (`not_found`, `invalid`, `required`), matching existing usage in `middlewares/routes.js` / `auth.middleware.js`.

## 5. Validation

- All request-body/query/param validation goes in the feature's `validators.js` using `express-validator`'s `body()`/`query()`/`param()` chains, exported as one array per action.
- Routes must run `validators.x, validate` (the shared `validate` middleware in `middlewares/auth.middleware.js`) before the handler — never validate manually inside a service function.

## 6. Auth & access control

- Any route that requires a logged-in user (guest or registered) uses `isUserAuthenticated` from `middlewares/auth.middleware.js`. This populates `req.user` from the JWT — read the user from there, don't re-decode tokens in service code.
- Any route that must exclude guest accounts uses `denyGuest` as well, or an equivalent explicit `eRole.map.GUEST` check plus the `guest_access_denied` message — don't invent a new phrase for "guests can't do this."
- Compare role/status against `eRole.map.*` / `eStatus.map.*`, never against raw string literals.

## 7. Config & environment variables

- Add every new environment variable to `.env.example` with a short comment, in the relevant section, at the same time you introduce it in code. An env var with no `.env.example` entry is treated as a bug.
- Prefer reading env-derived values through `config/config.js` (or a module-local `constants.js` that reads `process.env` once at load time, as scanners do) rather than scattering `process.env.X` calls through service/handler logic.
- Any per-scanner timeout/limit/concurrency value must be configurable via an env var with a sane default (`Number(config.X) || <default>`), matching the existing `SCAN_*` variables.

## 8. Scan engine specifics

Read [SCANNING.md](./SCANNING.md) fully before touching `models-routes-services/scan/`. In addition to the general rules above:

- New/changed scanners must stay **passive only** — no port scanning, exploitation, credential brute-forcing, or write/modify requests against the target. `ENABLE_ACTIVE_SCANNER` stays `false` unless the user explicitly asks for active-scanning work.
- Each scanner module keeps the standard internal shape: `constants.js`, `service.js`, `scoring.js`/`scoring.service.js`, `types.js`, `analyzers/`. Don't inline analyzer logic directly in `service.js`.
- Respect the per-module timeout wrapper (`scanners/base.scanner.js`) — a scanner must never be able to hang the whole flow.
- `infrastructure`, `threat`, and `compliance` reuse sibling `ScanContext` data instead of re-fetching — don't add a new network call to these modules if the data already exists from another module's result.

## 9. Logging

- Use the existing bracketed-prefix log style for anything that runs in the background/queue, e.g. `[scan] [scanId] ...`, `[scan.module] [scanId] [moduleName] ...` (see SCANNING.md §10). Keep new log lines consistent with this so they're greppable.
- Route-handler errors are logged once, centrally, via `catchError` → `handleCatchError` (which also reports to Sentry in production) — don't add a second `console.error` for the same failure.

## 10. Before opening a PR / calling work done

- [ ] `npm run lint` was run after the change and reports no new errors in touched files (see §1.1).
- [ ] New env vars are documented in `.env.example`.
- [ ] New/changed routes follow the `routes.js` → `validators.js` → `validate` → `services.js` chain.
- [ ] Error paths use `catchError`; success/error responses use `status`/`jsonStatus`/`messages`.
- [ ] Field names follow the Hungarian-prefix convention (§2).
- [ ] If touching `scan/`, `docs/SCANNING.md` is still accurate — update it if behavior changed.
