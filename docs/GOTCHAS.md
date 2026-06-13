# GOTCHAS — Known traps in this repo

> **Read this file before you do work in `D:\wix`.** It is intentionally short.
>
> **Append a new entry on top when you fix something non-obvious** — anything that took more than one wrong turn, anything where the failure mode was misleading, anything a different agent would also have tripped on.
>
> Format: `## YYYY-MM-DD — <short title>` then 2–4 sentences (what, why it's misleading, the fix). Mention the file or commit if relevant. Sign with who hit it: `*(Hit by: <agent or human>.)*`
>
> If you didn't add to GOTCHAS, the next agent will trip on the same thing. That's the cost of skipping the rule.

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
