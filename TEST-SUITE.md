# Automation Audit — Test Suite

**Feature:** Automation Audit (Guardrails Configuration)
**URL under test:** `https://guardio.app.getnotch.dev/config/guardrails`
**Scope:** Email Patterns to Unassign, Subjects, Words in User Message, Words in Assistant's Reply
**Verification mechanism:** Tests → Playground (`/tests/playground`)

---

## Test Strategy

The Automation Audit feature operates on three planes:

1. **Configuration layer** — can the user correctly add, save, and remove rules via the UI?
2. **Behavioral layer** — do the saved rules actually influence the AI pipeline correctly? (verified via Playground)
3. **Integrity layer** — does the system degrade gracefully under edge input, high volume, failure, and adversarial input?

All three planes must be covered. A rule that saves but doesn't trigger is a silent failure — the most dangerous kind in a system making autonomous decisions on financial support interactions. A rule that over-triggers is equally dangerous: it silently degrades automation coverage and undermines trust.

**Risk priority order:**
1. Rule triggers when it should — missed trigger = AI responds when it must not
2. Rule does NOT trigger when it shouldn't — false positive = AI is blocked from handling legitimate conversations
3. Rule persists accurately across reload — config that silently vanishes or corrupts is a trust issue
4. UI feedback is accurate — save/discard mechanics work as expected and don't mislead the operator
5. System handles adversarial input safely — invalid, injected, or extreme input doesn't break storage or evaluation

**Test types:** `Happy` / `Negative` / `Edge` / `Security` / `Boundary` / `UX`
**Priority:** `P1` = blocks release | `P2` = important, should be in regression | `P3` = good to have

---

## Test ID Naming

| Prefix | Section |
|---|---|
| `AA-EP` | Email Patterns to Unassign |
| `AA-SUB` | Subjects |
| `AA-WIM` | Words in User Message |
| `AA-WAR` | Words in Assistant's Reply |
| `AA-CC` | Cross-cutting / system-level |
| `AA-SEC` | Security |
| `AA-BND` | Input boundaries and volume |

---

## Open Questions & Assumptions

Before writing detailed test cases, these questions must be answered — they fundamentally change what "correct behavior" is. These are flagged as **unknowns to verify**, not assumptions to bake in silently.

| # | Question | Why It Matters |
|---|---|---|
| OQ-1 | Is pattern matching **substring** or **exact**? | `no-reply` matching `noreply@company.com` depends on this. Currently tests assume substring. |
| OQ-2 | Is matching **case-insensitive** by design or incidental? | If not documented, a code change could flip this and silently break the feature. |
| OQ-3 | Does Email Patterns support **regex or wildcards**? The section is called "patterns" not "keywords". | `no.*reply` behaves differently from `no-reply`. If regex is supported, an entire class of tests is needed. |
| OQ-4 | Is there a **max number of rules** per section or globally? | At 50+ rules, does the UI degrade? Does evaluation slow down? Does the backend reject the request? |
| OQ-5 | What is the **max character length** per keyword? | A 10,000-char keyword should not crash storage or matching. |
| OQ-6 | Are rules within a section evaluated as **OR** (any match → block) or **AND** (all must match → block)? | Almost certainly OR, but must be confirmed. |
| OQ-7 | Are rules across sections evaluated **independently**? Is the first match sufficient, or are all sections always evaluated? | Relevant when multiple rules match the same message. Affects observability — which rule triggered? |
| OQ-8 | Does the Playground display **which specific rule matched**, or just blocked/not blocked? | In a financial system, operators need traceability. If only a binary result is shown, that's a gap to flag. |
| OQ-9 | What is the **save mechanism** — optimistic or confirmed? Does the UI wait for a 200 from the backend before showing success? | If the save is optimistic and the backend fails silently, config changes appear saved but aren't. |
| OQ-10 | Do rules apply to **all conversations** or only new ones after the save? | Relevant for ops: if a rule is added mid-day, do in-flight conversations get re-evaluated? |

---

## Section 1 — Email Patterns to Unassign

Inbound rule. Matches against the **sender's email address**. If the address contains the configured pattern, the conversation is unassigned and the AI does not respond.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-EP-01 | Add a valid email pattern | Happy | P1 | Guardrails page open, section visible | 1. Type `no-reply` into the input. 2. Press Enter. 3. Click Save. | Chip `no-reply` appears. Save succeeds. No error. |
| AA-EP-02 | Rule triggers in Playground — matching sender | Happy | P1 | `no-reply` pattern saved | 1. Go to Playground. 2. Set sender to `no-reply@example.com`. 3. Run. | Result: **Red** (AI does not respond). Conversation unassigned. |
| AA-EP-03 | Rule does not trigger — non-matching sender | Negative | P1 | `no-reply` pattern saved | 1. Set sender to `customer@example.com`. 2. Run. | Result: **Green**. No pattern matched. |
| AA-EP-04 | Delete a saved pattern | Happy | P1 | At least one pattern saved | 1. Click `×` on chip. 2. Save. | Chip removed. On reload, pattern absent. |
| AA-EP-05 | Deleted pattern no longer triggers | Happy | P1 | AA-EP-04 completed | 1. In Playground, use the previously matching sender. 2. Run. | Result: **Green**. Rule is gone. |
| AA-EP-06 | Pattern matching is case-insensitive | Edge | P2 | Add `No-Reply` | 1. In Playground, use `no-reply@example.com`. 2. Run. | Result: **Red**. Case should not matter. (See OQ-2) |
| AA-EP-07 | Pattern matches substring of email address | Edge | P2 | Add `refunds` | 1. Use sender `refunds@company.com`. 2. Run. | Result: **Red**. Pattern is a substring match, not full address. (See OQ-1) |
| AA-EP-08 | Pattern does NOT match unrelated substring | Negative | P2 | Add `reply` | 1. Use sender `noreply@company.com`. 2. Also use `customer@support.com`. Verify only first triggers. | `noreply@` → **Red**. `customer@` → **Green**. Confirms substring scope. |
| AA-EP-09 | Duplicate pattern entry is rejected | Edge | P2 | `no-reply` already saved | 1. Type `no-reply` again. 2. Press Enter. | No duplicate chip created. System silently deduplicates or shows inline notice. |
| AA-EP-10 | Empty input cannot be submitted | Edge | P2 | Input empty | 1. Click input. 2. Press Enter without typing. | No chip created. No save triggered. |
| AA-EP-11 | Whitespace-only input is rejected | Edge | P2 | Input empty | 1. Type `   `. 2. Press Enter. | No chip. Input is trimmed. Whitespace-only is invalid. |
| AA-EP-12 | Multiple patterns — each triggers independently | Edge | P2 | No patterns | 1. Add `no-reply` and `unsubscribe`. 2. Save. 3. In Playground, use `unsubscribe@test.com`. | Result: **Red**. Pattern evaluation is OR logic. |
| AA-EP-13 | Discard changes — pattern not saved | UX | P2 | No patterns | 1. Type `test-pattern`. 2. Press Enter. 3. Click Discard. 4. Reload page. | Chip absent after reload. Discard was respected. |
| AA-EP-14 | Config persists after page reload | UX | P1 | One or more patterns saved | 1. Save. 2. Reload. | Same chips visible. Backend persisted the state. |
| AA-EP-15 | Special characters in pattern | Edge | P3 | Input empty | 1. Add `no+reply`. 2. Save. 3. Use `no+reply@example.com` in Playground. | Result: **Red**. Special chars don't break storage or matching. |

---

## Section 2 — Subjects

Inbound rule. Matches against the **email subject line**. If the subject contains the configured keyword, the conversation is unassigned.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-SUB-01 | Add a valid subject keyword | Happy | P1 | Guardrails page open | 1. Type `complain`. 2. Enter. 3. Save. | Chip appears. Save succeeds. |
| AA-SUB-02 | Rule triggers — keyword in subject | Happy | P1 | `complain` saved | 1. Set subject to `I want to complain about my order`. 2. Run. | Result: **Red**. |
| AA-SUB-03 | Rule does not trigger — keyword absent | Negative | P1 | `complain` saved | 1. Set subject to `Order status update`. 2. Run. | Result: **Green**. |
| AA-SUB-04 | Delete keyword | Happy | P1 | `complain` saved | 1. Delete chip. 2. Save. 3. Replay same Playground input. | Result: **Green**. Rule gone. |
| AA-SUB-05 | Case-insensitive match | Edge | P2 | Add `Unsubscribe` | 1. Subject: `unsubscribe me`. 2. Run. | Result: **Red**. |
| AA-SUB-06 | Keyword appears mid-subject | Edge | P2 | Add `refund` | 1. Subject: `Need help with my refund request`. 2. Run. | Result: **Red**. Substring match, position irrelevant. |
| AA-SUB-07 | Keyword embedded inside a word | Edge | P2 | Add `fund` | 1. Subject: `Refund request`. | Expected: **Red** (substring). Document whether this is desired — `fund` matching `Refund` is likely a false positive. Flag as a potential UX issue. |
| AA-SUB-08 | Empty subject in Playground | Edge | P3 | One keyword saved | 1. Leave subject blank. 2. Run. | Result: **Green**. Nothing to match. No crash. |
| AA-SUB-09 | Duplicate keyword rejected | Edge | P2 | `complain` saved | 1. Type `complain` again. | No duplicate chip. |
| AA-SUB-10 | Config persists after reload | UX | P1 | Keywords saved | 1. Reload. | Keywords present. |
| AA-SUB-11 | Subject field isolation — keyword in body does not trigger Subjects rule | Negative | P2 | `complain` saved in Subjects only | 1. Set subject to `Help needed`. Set body to `I want to complain`. 2. Run. | Result: **Green**. Body content must NOT trigger a Subjects rule. Rules are field-scoped. |

---

## Section 3 — Words in User Message

Inbound rule. Matches against the **body of the customer's message**. If the body contains a configured word, the conversation is unassigned.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-WIM-01 | Add a valid keyword | Happy | P1 | Guardrails page open | 1. Type `cancel`. 2. Enter. 3. Save. | Chip appears. Save succeeds. |
| AA-WIM-02 | Rule triggers — keyword in message body | Happy | P1 | `cancel` saved | 1. Body: `I want to cancel my subscription`. 2. Run. | Result: **Red**. |
| AA-WIM-03 | Rule does not trigger — keyword absent | Negative | P1 | `cancel` saved | 1. Body: `How do I reset my password?`. 2. Run. | Result: **Green**. |
| AA-WIM-04 | Delete keyword | Happy | P1 | `cancel` saved | 1. Delete chip. 2. Save. 3. Replay same body. | Result: **Green**. |
| AA-WIM-05 | Case-insensitive match | Edge | P2 | Add `lawsuit` | 1. Body: `I am considering a LAWSUIT`. 2. Run. | Result: **Red**. |
| AA-WIM-06 | Keyword embedded in longer word — false positive risk | Edge | P2 | Add `cancel` | 1. Body: `I cannot proceed with this order`. 2. Run. | Document the result. If `cannot` triggers `cancel` — this is a real false positive risk in a production system. Should be flagged and discussed with product. |
| AA-WIM-07 | Similar false positive: `no` matching `note`, `know`, `not` | Edge | P2 | Add `no` | 1. Body: `I know this is not a problem`. 2. Run. | If triggered: **Red**. Flag as false positive risk — overly short keywords should perhaps be discouraged. |
| AA-WIM-08 | Keyword at various positions in body | Edge | P3 | Add `refund` | 1. Test with keyword at start, middle, end of body. | All three produce **Red**. Position is irrelevant. |
| AA-WIM-09 | Empty message body | Edge | P2 | One keyword saved | 1. Leave body blank. 2. Run. | Result: **Green**. No match. No crash. |
| AA-WIM-10 | Multiple keywords — any match is sufficient | Edge | P2 | Add `cancel` and `lawsuit` | 1. Body: `I want to cancel`. 2. Run. | Result: **Red**. OR logic. |
| AA-WIM-11 | Long body with buried keyword | Edge | P3 | Add `refund` | 1. 500+ character body with `refund` once. 2. Run. | Result: **Red**. Body length does not affect matching. |
| AA-WIM-12 | Config persists after reload | UX | P1 | Keywords saved | 1. Reload. | Keywords present. |
| AA-WIM-13 | Body isolation — keyword in subject does not trigger WIM rule | Negative | P2 | `cancel` saved in WIM only | 1. Subject: `cancel my account`. Body: `Hello`. 2. Run. | Result: **Green**. Subject content must NOT trigger a body rule. |

---

## Section 4 — Words in Assistant's Reply

Outbound rule. Unlike the three inbound sections above, this rule evaluates the **AI's generated draft reply** — not the incoming message. If the draft contains a configured word, the reply is suppressed and the conversation is handed to a human.

> **Testing challenge:** Outbound rules require engineering a prompt that reliably causes the AI to include a specific word in its response. AI output is non-deterministic. Approach: use a word that is highly likely to appear given a crafted prompt (e.g., configure `sorry` and send a strongly-worded complaint). Flag this as an inherent constraint in any automation of these tests — they carry a flakiness risk that inbound tests do not.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-WAR-01 | Add a keyword to block from AI reply | Happy | P1 | Guardrails page open | 1. Type `sorry`. 2. Enter. 3. Save. | Chip appears. Save succeeds. |
| AA-WAR-02 | Rule triggers — AI reply contains blocked word | Happy | P1 | `sorry` saved. Prompt known to elicit an apology. | 1. Playground. 2. Send a strongly-worded complaint. 3. Run. | Result: **Red**. AI draft contained `sorry`; reply suppressed. |
| AA-WAR-03 | Rule does not trigger — AI reply does not contain word | Negative | P1 | `sorry` saved | 1. Send a neutral factual question (e.g., `What are your business hours?`). 2. Run. | Result: **Green**. AI reply doesn't contain `sorry`. |
| AA-WAR-04 | Delete outbound keyword | Happy | P1 | `sorry` saved | 1. Delete chip. 2. Save. 3. Replay same prompt. | Result: **Green**. Rule removed. |
| AA-WAR-05 | Case-insensitive match on AI reply | Edge | P2 | Add `Sorry` | 1. Trigger AI response with lowercase `sorry`. | Result: **Red**. Match is case-insensitive. |
| AA-WAR-06 | Inbound passes, outbound blocked | Edge | P2 | No inbound rules. `refund` in outbound. | 1. Clean inbound message. AI draft contains `refund`. 2. Run. | Result: **Red**. Outbound fires even when inbound was clean. |
| AA-WAR-07 | Both inbound and outbound match simultaneously | Edge | P2 | `cancel` in WIM. `sorry` in WAR. | 1. Body contains `cancel`. AI would say `sorry`. 2. Run. | Result: **Red**. Document which layer is reported as the reason — important for observability. |
| AA-WAR-08 | Outbound keyword does NOT match inbound body | Negative | P2 | Only `refund` in WAR | 1. Body: `I want a refund`. 2. Run. | Expected: **Green** (if the AI's reply doesn't contain `refund`). The rule must NOT match the customer's inbound message — only the AI's outbound draft. This is the most critical isolation test for this section. |
| AA-WAR-09 | Config persists after reload | UX | P1 | Keywords saved | 1. Reload. | Keywords present. |
| AA-WAR-10 | Discard outbound changes | UX | P2 | No outbound keywords | 1. Type `refund`. Enter. 2. Click Discard. 3. Reload. | Chip absent. |

---

## Cross-Cutting Test Cases

Tests that verify system-level behavior spanning all sections.

### Rule Evaluation & Isolation

| ID | Name | Type | Priority | Steps | Expected Result |
|---|---|---|---|---|---|
| AA-CC-01 | Rules from all 4 sections evaluated independently | Edge | P2 | Add 1 rule per section. In Playground, craft a message that matches only the Subjects rule. | Result: **Red** (Subjects matched). Other rules did not fire. Document whether Playground shows which rule triggered. |
| AA-CC-02 | No rules configured — AI responds freely | Negative | P1 | Remove all rules. In Playground, send any message. | Result: **Green**. No rules = AI always responds. |
| AA-CC-03 | Rules do not bleed across sections | Negative | P2 | `cancel` in WIM only. Send message with `cancel` in subject, clean body. | Result: **Green**. Subject with `cancel` must NOT trigger WIM rule. Each section is scoped to its field. |
| AA-CC-04 | Playground reflects live config without reload | UX | P1 | Add a rule, save, run Playground immediately (no reload). | Newly saved rule is active. No stale cache. |
| AA-CC-05 | Partial discard: add 3 keywords, save 2, discard last | UX | P2 | 1. Add keyword A. Save. 2. Add keyword B. Save. 3. Add keyword C. Click Discard. Reload. | A and B visible. C absent. Previous saves are not rolled back by a later Discard. |
| AA-CC-06 | Save confirms all 4 sections simultaneously | UX | P1 | Add one keyword per section. Click Save once. Reload. | All 4 chips present across all sections. Single save persists everything. |

### Observability

| ID | Name | Type | Priority | Steps | Expected Result |
|---|---|---|---|---|---|
| AA-CC-07 | Playground shows which rule matched | Edge | P2 | Configure rules in 2 different sections. Send a message that matches one. | Playground result indicates not just blocked/not, but *which rule* triggered. If not shown — this is a gap to flag. |
| AA-CC-08 | Playground shows reason for "not blocked" | Edge | P3 | No rules configured. Run Playground. | Result shows AI responds, ideally noting "no rules matched" or similar. Absence of a reason makes debugging harder for operators. |

### Save Integrity

| ID | Name | Type | Priority | Steps | Expected Result |
|---|---|---|---|---|---|
| AA-CC-09 | Network failure during save — UI handles gracefully | Edge | P2 | Simulate network drop (DevTools offline or throttle) during Save. | UI shows an error or warning. Config is NOT silently marked as saved when it wasn't. No partial write. |
| AA-CC-10 | Save returns error from backend — UI does not show success | Edge | P2 | Intercept the save API call and return a 500. | UI does not display a success state. User is informed the save failed. |
| AA-CC-11 | UI "saved" state reflects actual backend state | Edge | P1 | Save successfully. Verify via network tab that the PATCH/PUT returned a 2xx. | Success message corresponds to a confirmed backend response — not optimistic UI. |

---

## Security Tests

Relevant because this feature accepts free-text input that is stored and later evaluated against live messages. Injected content could affect storage, display, or matching behavior.

| ID | Name | Type | Priority | Steps | Expected Result |
|---|---|---|---|---|---|
| AA-SEC-01 | XSS in keyword field — stored XSS | Security | P1 | 1. Add `<script>alert('xss')</script>` as a keyword. 2. Save. 3. Reload the page. | Chip renders the literal text. No script executes. Content is stored and displayed safely as a string. |
| AA-SEC-02 | HTML injection in keyword | Security | P1 | Add `<b>bold</b>` as a keyword. Save. Reload. | Chip displays `<b>bold</b>` literally. No HTML is rendered. |
| AA-SEC-03 | XSS via Playground — body or subject field | Security | P2 | Set message body to `<img src=x onerror=alert(1)>`. Run. | No script executes. Input is handled as plain text. |
| AA-SEC-04 | SQL injection characters in keyword | Security | P2 | Add `'; DROP TABLE rules; --`. Save. Reload. | Keyword saved and displayed correctly as a literal string. No backend error. Database unaffected. |
| AA-SEC-05 | Null byte in keyword | Security | P3 | Add keyword containing `\0` (null byte). Save. | Input is sanitized or rejected cleanly. No storage corruption. |
| AA-SEC-06 | Very long string — potential buffer overflow | Security | P2 | Add a 10,000-character string as a keyword. | System either accepts it safely or rejects it with a clear validation error. No server crash, no timeout, no data corruption. |

---

## Input Boundary Tests

| ID | Name | Type | Priority | Steps | Expected Result |
|---|---|---|---|---|---|
| AA-BND-01 | Single character keyword | Boundary | P2 | Add `a`. Save. In Playground, use body `yes`. | Result: **Red**. Single-char match works (also highlights false positive risk of short keywords). |
| AA-BND-02 | Maximum number of rules — find the limit | Boundary | P3 | Add keywords one at a time until behavior changes. | Document the limit. At the limit: system should reject gracefully with a clear message, not silently drop or crash. |
| AA-BND-03 | Large number of rules — UI performance | Boundary | P3 | Add 30+ keywords to a single section. | UI remains responsive. No render lag. All chips visible (scrollable). |
| AA-BND-04 | Large number of rules — matching performance | Boundary | P3 | 30+ rules saved. Run Playground. | Result time is not noticeably degraded. Matching does not time out. |
| AA-BND-05 | Maximum keyword length | Boundary | P2 | Type a 500-character string. Press Enter. Save. | Either accepted and stored correctly, or rejected with clear validation. No truncation without warning. |
| AA-BND-06 | Unicode / non-ASCII keywords | Boundary | P2 | Add `ביטול` (Hebrew for "cancel"). Save. In Playground, body: `אני רוצה ביטול`. Run. | Result: **Red**. Non-ASCII keywords should work. Critical for multilingual support systems. |
| AA-BND-07 | Emoji in keyword | Boundary | P3 | Add `🚫`. Save. In Playground, body: `please 🚫 this`. Run. | Accepted and matched, or rejected gracefully. No encoding error. |

---

## Out of Scope

| Area | Reason |
|---|---|
| Tags section | Explicitly out of scope per assignment brief |
| AI pipeline internals | Black box from this feature's perspective; Playground output is the observable surface |
| Google OAuth automation | Out of scope; handled manually in headed mode |
| Concurrent edits from multiple users | Infrastructure-level concern beyond this assignment's scope |
| Mobile / responsive layout | Not specified in scope |
| Performance under load (many simultaneous requests) | Infrastructure-level concern |
| Full API test automation (bypassing UI) | Noted as a logical next layer; not implemented in Part 2 but highlighted in OQ-9 |
