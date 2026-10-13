# GOTCHAS — Known traps in this repo

> **Read this file before you do work in `D:\wix`.** It is intentionally short.
>
> **Append a new entry on top when you fix something non-obvious** — anything that took more than one wrong turn, anything where the failure mode was misleading, anything a different agent would also have tripped on.
>
> Format: `## YYYY-MM-DD — <short title>` then 2–4 sentences (what, why it's misleading, the fix). Mention the file or commit if relevant. Sign with who hit it: `*(Hit by: <agent or human>.)*`
>
> If you didn't add to GOTCHAS, the next agent will trip on the same thing. That's the cost of skipping the rule.

---

## 2026-10-13 — `pnpm install` silently skips devDependencies on the founder's PC

`NODE_ENV=production` is set system-wide on the founder's Windows PC, so `pnpm install` prints "devDependencies: skipped" and `tsc`, `drizzle-kit` and `eslint` are missing — type-check then fails with a confusing npx "tsc@2.0.4" prompt. **Fix:** `set NODE_ENV=development&& set CI=true&& pnpm install --prod=false` (CI=true avoids pnpm's interactive "reinstall node_modules?" prompt). Also: `pnpm-lock.yaml` had drifted from `package.json` (tailwind entries), so `--frozen-lockfile` failed; the refreshed lockfile was committed. *(Hit by: Claude, 2026-10-13.)*

---

## 2026-10-13 — Product reads must go through `lib/wix/catalog.ts` (Catalog V1 and V3)

A Wix store runs Catalog V1 **or** V3, and the APIs are not compatible; new stores and dev test sites are V3. `lib/wix/catalog.ts` checks the version (`/stores/v3/provision/version`) and reads `stores-reader/v1/products/{id}` or `stores/v3/products/{id}`. If the version check fails it tries V3, then V1, so a missing permission degrades to "Your recent purchase" instead of an error — which also means **a missing permission fails quietly**. The app needs these permissions in the Wix app dashboard: Read Products (V1), Read products in v3 catalog, Read v3 catalog. Don't call a Stores products URL directly anywhere else. Hidden products need the extra "Product v3 read admin" scope on V3; we don't ask for it, so hidden products show the generic label. *(Hit by: Claude, 2026-10-13.)*

---

## 2026-10-13 — Monthly request limit: where it lives and what can break it

The limit is checked in one place: `handleOrderFulfilled` in `app/api/wix/webhook/route.ts`, using `lib/usage.ts` (count of this UTC month's `review_requests` that are not `SKIPPED`) and `lib/plans.ts` (limits per plan). Over the limit the order is stored with `status=SKIPPED, skip_reason=monthly_limit` so the dashboard can say how many customers weren't asked. **Any new way of creating requests (manual send, reminders, import of old orders) must call `requestUsage()` first**, or that path is uncapped. The plan comes live from Wix `billing.packageName`, matched by the words GROWTH / PRO / STARTER — so the plan names in the Wix app dashboard must contain those words, or a paid merchant falls back to Starter limits. Two webhooks at the same instant can pass the limit by one or two; accepted. The older 2026-05-21 entry below (plan via an `app-instance#updated` webhook) describes a design that was never built. *(Hit by: Claude, 2026-10-13.)*

---

## 2026-10-13 — Migration 0003 adds a unique index that fails on duplicate orders

`0003_plan_limits.sql` creates `rr_account_order_uq` on `review_requests(account_id, wix_order_id)`. Before this, duplicate webhooks could create two rows for one order. If the migration fails on the index, find duplicates with `select account_id, wix_order_id, count(*) from reviews.review_requests group by 1,2 having count(*) > 1;` and remove the extra rows (keep the oldest) before re-running. Run 0002 and 0003 together; both only add things. *(Hit by: Claude, 2026-10-13.)*

---

## 2026-05-22 — Playwright locator `.count()` returns `0` before render

When automating pages, calling `locator.count()` immediately after navigation returns `0` if the page hasn't fully rendered. Instead of checking counts, use Playwright's auto-waiting locators directly (e.g. `locator.click(timeout=10000)`) or wait for visibility explicitly using `locator.wait_for(state="visible")`. *(Hit by: Antigravity, 2026-05-22.)*

---

## 2026-05-22 — Next.js 15 App Router: never import `next/document` or `<Html>`

`apps/reviews/` is the **App Router**, not the Pages Router. The `<Html>` component and `next/document` module only exist in the Pages Router and will throw at build time if imported here. If a build error mentions `<Html>` or `next/document`, the cause is either a copy-pasted Pages-Router import or a stale `.next/` build cache from a wrong-shaped earlier attempt. **Fix:** delete `apps/reviews/.next/` and re-run `pnpm dev`; grep `apps/reviews/app` and `apps/reviews/lib` for `next/document` imports. Do **not** search inside `.next/server/**` — that's compiled output, not source. *(Hit by: Antigravity, 2026-05-22.)*

---

## 2026-05-22 — Webhook signature verification is a DEV BYPASS

`apps/reviews/lib/wix/webhooks.ts` currently returns `true` for any webhook signature when `NODE_ENV=development`. This **must** be replaced with real JWT verification using `jose` (already in `package.json`) before the app is deployed to any non-dev environment. Production with the bypass means anyone on the internet can post fake webhooks to your API. Treat this as a launch-blocking item; see `docs/02_wix_developer_center_setup.md` §10 for the pre-submission checklist. *(Hit by: scaffolding, 2026-05-21.)*

---

## 2026-05-21 — Cowork sandbox mount blocks `mv`

When working through the Cowork agent's filesystem layer, `mv` on files inside the mounted workspace fails with `Permission denied`, even though `cp` and `rm` work fine. If you need to move a file from an agent, use `cp <src> <dst>` then delete the original via the explicit delete-permission tool. This only affects an agent's sandboxed bash; on a normal Windows shell (PowerShell, Git Bash) `mv` works as expected. *(Hit by: Claude, 2026-05-21.)*

---

## 2026-05-21 — `git init` inside the Cowork mount is unreliable

`git init` invoked from an agent's sandboxed bash, inside the mounted workspace, can leave `.git/` in a half-written state — `cat .git/config` returns "No such file or directory" right after `ls .git/config` reports 54 bytes. **Run `git init` and the initial commit from a real Windows shell** (PowerShell or Git Bash on the host), not from an agent. After the repo is initialized on the host, agents can do normal git operations (status, add, commit, log) through it without issue. *(Hit by: Claude, 2026-05-21.)*

---

## 2026-05-21 — Free-tier cap is enforced in code, not externally

The free-tier limit of **50 review requests / month** for `apps/reviews/` is enforced inside the request scheduler by checking `accounts.plan === "FREE"`. There is no external rate limiter. Wix App Market plan changes flow into the `accounts.plan` column via the `wix.app-market.v1.app-instance#updated` webhook handler in `apps/reviews/app/api/wix/webhook/route.ts`. If you add a new scheduling path and forget the plan check, free-tier merchants become uncapped overnight. *(Decision logged: tracker, 2026-05-21.)*

---

## 2026-05-21 — Word file locks block file moves and deletes on Windows

If `docs/Wix_App_Opportunities_2026.docx` (or any `.docx`) is open in Microsoft Word, even read-only, attempts to `mv`, `rm`, or `cp -f` it from the agent will fail with `Permission denied`. Close Word first, then retry the file operation. Same applies to Excel + `.xlsx` and PowerPoint + `.pptx`. *(Hit by: Claude, 2026-05-21.)*
