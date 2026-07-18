# Scan Engine — Known Improvement Areas

This tracks issues found while validating real scan output against the live database, not yet fixed. See [SCANNING.md](./SCANNING.md) for how the engine currently works.

**Validation source**: two independent scans of `https://bucketx.in` (`a5bedcee-a7d6-411b-bd1c-ad3d85ff2ac1` and `4cf71178-11c5-4415-9a81-4da272142149`, ~5 hours apart), cross-checked against exported `scans` and `scan_module_results` collections plus the worker logs. Both scans completed structurally correctly — 11/11 modules `completed`, `sError: null`, `nAttempts: 1`, matching the logs 1:1. The issues below are about correctness/quality of the *output*, not crashes or missing data.

---

## 1. Bug — `compliance` never actually gets `threat`'s data (confirmed, reproducible)

**Status**: Confirmed in both scans. Not a rare race — it happened identically both times.

**Evidence**: `compliance`'s own `oResult.oMeta` in both scan_module_results docs:
```json
"sourceStatuses": { "header": "completed", "ssl": "completed", ..., "threat": "running" },
"sourcesMissing": ["threat"],
"partialData": true
```
`threat` finished 8ms before `compliance` in scan 1 (`10:56:24.253Z` vs `10:56:24.261Z`) — compliance's sibling-data read fires almost immediately on job pickup, before threat has written its result.

**Root cause**: `models-routes-services/scan/scanners/compliance/constants.js` lists `threat` in `SOURCE_MODULES` (compliance is designed to consume threat's already-correlated findings — matches the pre-two-phase docs: "compliance waits for all scanners including threat"). But the current two-phase redesign (`PHASE2_MODULES = ['infrastructure', 'threat', 'compliance']` in `models-routes-services/scan/constants.js`) enqueues all three as **parallel siblings** under the same `scan-finalize` job with no ordering between them. `infrastructure` only depends on phase-1 modules so it's fine (confirmed `sourceStatuses` all `"completed"` for it in both scans) — only `compliance`'s dependency on `threat` is broken by this.

**Suggested fix**: Split phase 2 into two tiers: `infrastructure` + `threat` run in parallel (as now), then `compliance` runs in its own tier strictly after `threat` settles — same "gate job enqueues next tier" pattern already used for phase1→phase2 (`queue/phase1Gate.worker.js`), just one more level.

---

## 2. DNS MX timeout reported as a false negative

**Evidence**: `dns.oResult.oMeta.partialErrors`:
```json
{ "type": "MX", "code": "TIMEOUT", "error": "DNS MX timed out" }
```
but the finding text says *"No MX records were found. Email delivery may not be configured."* — a definitive negative claim, when the actual truth is "the lookup timed out, we don't know."

**Impact**: A user could be told their domain has no mail setup when it actually does — the query just didn't resolve in time. This finding then propagates into `threat` and `compliance` as a confirmed "Weak DNS Configuration" issue, compounding the false signal.

**Suggested fix**: When a sub-lookup times out, the DNS scanner should emit a distinct "inconclusive" status/finding rather than reusing the "confirmed absent" finding — and downstream modules (`threat`, `compliance`) should not treat inconclusive data as a pass/fail control.

---

## 3. `threat` score clamps to 0 too easily, losing all differentiation above a certain severity

**Evidence**: `threat.oResult.summary`: `threatScore: 100, safetyScore: 0` — severity penalties (Critical 40 / High 25 / Medium 15 / Low 10) summed to 435 against this site's 7 High + 12 Medium + 8 Low findings, then clamped to the 0–100 range.

**Impact**: Any moderately-insecure site and a catastrophically-insecure site both land on identical `score: 0, grade: F`. If a customer fixes half their findings next scan, `threat` would likely still show 0 — no positive feedback for real improvement, which undermines the product's "track your progress over time" value.

**Suggested fix**: Rescale the penalty formula (e.g. diminishing weight per additional finding of the same severity, or normalize against total possible findings) so the score has room to move within the range real sites actually occupy, instead of everything but near-perfect sites bottoming out at 0.

---

## 4. Same root cause penalized redundantly across 4 modules, skewing `nOverall`

**Evidence**: Missing HSTS/CSP/SPF/DMARC is independently scored down in `header`, `infrastructure`, `threat`, *and* `compliance` — all four cite the identical underlying facts (see the repeated "Enable Strict-Transport-Security..." / "Missing SPF" / "Missing DMARC" findings across all four module results in `scan_module_results.json`).

**Impact**: `nOverall` is presented as a flat average across ~10-11 equally-weighted categories, but because one root cause (missing hardening headers) drags down 4 of those categories at once, it implicitly dominates the overall score far more than performance/SEO/JS-hygiene do. This scan: SSL 93, secret 100, javascript 90, seo 90 (all genuinely strong) but `nOverall` still lands at 57.1 — worth an explicit decision on whether `threat`/`compliance` should be weighted down since they largely re-derive `header`/`infrastructure`'s same findings rather than adding independent signal.

**Suggested fix**: Either (a) explicitly weight the overall-score average so highly-correlated modules count less than once combined, or (b) accept the current behavior as intentional ("security hardening matters most") and say so clearly in the UI copy so it doesn't read as a bug to users comparing category scores against the overall grade.

---

## 5. Technology detector flagged two mutually-exclusive CMSs on the same site

**Evidence**: `technology.oResult.cms`: both `WordPress` (95% confidence) and `Ghost` (75% confidence) detected simultaneously — these are mutually exclusive CMS platforms; a site cannot run both.

**Impact**: Low severity (informational-only module, doesn't affect scoring), but it's a visible correctness/precision issue in `models-routes-services/scan/scanners/technology/patterns.js` — likely a generic path fragment shared by both platforms' detection signatures producing a false positive for one of them.

**Suggested fix**: Tighten the Ghost (or WordPress) detection signature so it doesn't match on a shared, low-specificity path fragment.

---

## Not yet decided — needs your call before implementing anything here

- Priority order (the compliance-ordering bug in §1 is unambiguous and safe to fix independently; §2-5 involve product/scoring-model judgment calls, not pure bugs).
- Whether `technology: null` in `oScores.modules` (already excluded from the `nOverall` average by design) needs any special handling in the frontend once real API integration replaces the mock data — the current `DashboardOverview` category-card UI assumes a numeric score per category.
