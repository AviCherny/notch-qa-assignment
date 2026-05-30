# QA Philosophy

---

## Core Principles

**Quality is a team responsibility, not a QA gatekeeping function.**
QA should join early — at requirements and design — not only at the end before release.

**Risk-first, not test-first.**
Start from: what can break, what can cost money, what can hurt customer trust — not from "what tool should I use."

**The most important thing is the real business outcome, not the visible UI state.**
For an AI product like Notch, the question is not "did it answer?" but "did it make the right decision and why?"

---

## How I Think About Testing

### Layers I always consider:
1. UI behavior (Playwright for critical flows, not everything)
2. API contracts and responses (Postman for exploration, then automated)
3. Backend state / actual data (compare outcome across layers — no single source of trust)
4. Business logic / decision traceability (especially critical for AI: *why* did the system decide this?)

### Subtle bugs to watch for:
- **No single source of truth** — UI says one thing, API another, state says a third
- **Black-box decisions** — system decides but cannot explain why (critical for AI agents)
- **Silent failures** — success message shown, but nothing actually happened

### When to automate vs. manual:
- Automate: stable, repeatable, known expected output — regression, sanity, API contracts, permissions
- Manual: new/changing feature, AI-generated output (can't hardcode), judgment calls, one-off checks
- Never automate: something checked once, or where automation cost > value

---

## Suite Hierarchy

| Suite | When to run | Purpose |
|---|---|---|
| Sanity | Every PR | Fast confidence, catches regressions immediately |
| Regression | Before release or scheduled | Broad coverage, slower |
| E2E / Critical flow | Pre-release | Business-critical paths only — keep it focused |
| Negative / edge case | As part of regression | Empty states, conflicts, invalid input, silent failure |

"If everything is critical, nothing is critical." — Keep E2E focused.

---

## Toolstack

- **Playwright** — UI automation + API request layer + traces/screenshots for debugging
- **Postman** — API exploration before automation (understand before automating)
- **Browser DevTools** — Network, Console, Application tabs; debugging by layer
- **Jira + Xray** — Test management, traceability, release visibility (kept practical, not overhead)
- **Git** — Real structure for automation suites (folders, naming, tags)
- **CI/CD** — Sanity on PRs, regression on release/schedule
- **Allure / Playwright reports** — Fast failure analysis

---

## How I Handle Pressure & Dilemmas

### Tight deadline pressure:
- Don't treat testing as all-or-nothing
- Reduce scope, not thinking: focus on main flows, risky areas, recent changes
- Make the accepted risk explicit: "here's what we tested, here's what we didn't, here's what can still break"

### Critical bug before release:
- Validate quickly that it's real (not a flaky failure)
- Assess business impact: customer, money, data, permissions, trust
- Escalate immediately with evidence, not after full investigation
- Recommendation: delay if critical flow affected; present risk consciously if isolated

### Rare / intermittent bug (1/50, non-critical):
- Does not block release automatically
- Document clearly: reproduction pattern, frequency, evidence, what was checked
- Block only if root cause can affect a critical flow elsewhere

### "Working as designed" is not always enough:
- Push back when the requirement passes the ticket but fails the product
- Especially relevant for AI: if the agent makes an autonomous decision with real business impact, "it does what the spec says" is not sufficient validation

---

## Communication in QA Work

- Clear signal: what is covered, what is risky, what failed, is it ready to release
- Bug reports: no noise, clear reproduction, evidence, business impact
- Involvement: early in SDLC, not as last gatekeeper
- Escalation: comes with evidence + recommendation, not just "blocked"
