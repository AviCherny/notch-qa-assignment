# Automation Audit — Test Suite

**Feature:** Automation Audit (Guardrails Configuration)
**URL under test:** `https://guardio.app.getnotch.dev/config/guardrails`
**Scope:** Email Patterns to Unassign, Subjects, Words in User Message, Words in Assistant's Reply
**Verification mechanism:** Tests → Playground (`/tests/playground`)

---

## Test Strategy

The Automation Audit feature operates on two planes:

1. **Configuration layer** — can the user correctly add, save, and remove rules via the UI?
2. **Behavioral layer** — do the saved rules actually influence the AI pipeline correctly?

Both planes must be covered. A rule that saves but doesn't trigger is a silent failure — the most dangerous kind in a system handling real financial support interactions. Tests are therefore split into:

- **Config tests**: verify UI state, persistence, and edge input handling
- **Playground tests**: verify the actual decision output (green/red) against configured rules

**Risk priority order:**
1. Rule triggers when it should (AI blocked when expected) — missed trigger = real harm
2. Rule does NOT trigger when it shouldn't (no false positives) — over-blocking = support failure
3. Rule persists across reload — config that vanishes silently is a trust issue
4. UI feedback is accurate — discard/save mechanics work as expected

---

## Test ID Naming

| Prefix | Section |
|---|---|
| `AA-EP` | Email Patterns to Unassign |
| `AA-SUB` | Subjects |
| `AA-WIM` | Words in User Message |
| `AA-WAR` | Words in Assistant's Reply |

**Test types:** `Happy` / `Negative` / `Edge` / `UX`
**Priority:** `P1` = must pass before any release | `P2` = important | `P3` = good to have

---

## Section 1 — Email Patterns to Unassign

Inbound rule. Matches against the **sender's email address**. If the address contains the configured pattern, the conversation is unassigned and the AI does not respond.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-EP-01 | Add a valid email pattern | Happy | P1 | Guardrails page open, section visible | 1. Type `no-reply` into the input. 2. Press Enter. 3. Click Save. | Chip `no-reply` appears in the section. Save succeeds with no error. |
| AA-EP-02 | Rule triggers in Playground — matching sender | Happy | P1 | `no-reply` pattern is saved | 1. Go to Playground. 2. Set sender to `no-reply@example.com`. 3. Run. | Result: **Red** (AI does not respond). Conversation unassigned. |
| AA-EP-03 | Rule does not trigger — non-matching sender | Negative | P1 | `no-reply` pattern is saved | 1. Go to Playground. 2. Set sender to `customer@example.com`. 3. Run. | Result: **Green** (AI responds). No rule matched. |
| AA-EP-04 | Delete a saved pattern | Happy | P1 | At least one pattern saved | 1. Click the `×` on an existing chip. 2. Save. | Chip removed. On page reload, pattern no longer present. |
| AA-EP-05 | Deleted pattern no longer triggers | Happy | P1 | Pattern from AA-EP-04 was deleted | 1. Go to Playground. 2. Use the previously matching sender. 3. Run. | Result: **Green**. Deleted rule no longer affects outcome. |
| AA-EP-06 | Pattern is case-insensitive | Edge | P2 | No patterns set | 1. Add `No-Reply`. 2. Save. 3. In Playground, use sender `no-reply@example.com`. | Result: **Red**. Matching should be case-insensitive. |
| AA-EP-07 | Pattern matches partial email address | Edge | P2 | Add pattern `refunds` | 1. In Playground, use `refunds@company.com`. 2. Run. | Result: **Red**. Pattern is a substring match, not exact. |
| AA-EP-08 | Duplicate pattern entry | Edge | P2 | `no-reply` already saved | 1. Type `no-reply` again. 2. Press Enter. | System prevents duplicate — either ignores silently or shows inline warning. No duplicate chip created. |
| AA-EP-09 | Empty input cannot be submitted | Edge | P2 | Section input is empty | 1. Click into input. 2. Press Enter without typing. | No chip created. No save triggered. Input remains empty. |
| AA-EP-10 | Whitespace-only input | Edge | P2 | Section input is empty | 1. Type `   ` (spaces only). 2. Press Enter. | No chip created. Whitespace is trimmed and rejected. |
| AA-EP-11 | Multiple patterns saved — all trigger independently | Edge | P2 | No patterns set | 1. Add `no-reply` and `unsubscribe`. 2. Save. 3. In Playground, use `unsubscribe@test.com`. | Result: **Red**. Each pattern is evaluated independently. |
| AA-EP-12 | Discard changes — pattern not saved | UX | P2 | No patterns set | 1. Type `test-pattern`. 2. Press Enter. 3. Click Discard (instead of Save). 4. Reload page. | Chip does not appear after reload. Change was discarded. |
| AA-EP-13 | Config persists after page reload | UX | P1 | One or more patterns saved | 1. Save patterns. 2. Reload the page. | Same chips visible after reload. Config was persisted to backend. |
| AA-EP-14 | Special characters in pattern | Edge | P3 | Section input is empty | 1. Add `no+reply`. 2. Save. 3. In Playground, use `no+reply@example.com`. | Result: **Red**. Special chars handled without breaking storage or matching. |

---

## Section 2 — Subjects

Inbound rule. Matches against the **email subject line**. If the subject contains the configured keyword, the conversation is unassigned.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-SUB-01 | Add a valid subject keyword | Happy | P1 | Guardrails page open | 1. Type `complain` into subjects input. 2. Press Enter. 3. Save. | Chip `complain` appears. Save succeeds. |
| AA-SUB-02 | Rule triggers — matching subject | Happy | P1 | `complain` keyword saved | 1. Go to Playground. 2. Set subject to `I want to complain about my order`. 3. Run. | Result: **Red**. Subject contains keyword. |
| AA-SUB-03 | Rule does not trigger — non-matching subject | Negative | P1 | `complain` keyword saved | 1. Go to Playground. 2. Set subject to `Order status update`. 3. Run. | Result: **Green**. No keyword match. |
| AA-SUB-04 | Delete subject keyword | Happy | P1 | `complain` is saved | 1. Click `×` on chip. 2. Save. | Chip removed. Rule no longer fires in Playground. |
| AA-SUB-05 | Case-insensitive match | Edge | P2 | Add `Unsubscribe` | 1. In Playground, set subject to `unsubscribe me`. 2. Run. | Result: **Red**. Match is case-insensitive. |
| AA-SUB-06 | Keyword appears mid-subject | Edge | P2 | Add `refund` | 1. Set subject to `Need help with my refund request`. 2. Run. | Result: **Red**. Substring match within subject. |
| AA-SUB-07 | Keyword not present in subject | Negative | P2 | Add `refund` | 1. Set subject to `General inquiry`. 2. Run. | Result: **Green**. No match. |
| AA-SUB-08 | Empty subject field in Playground | Edge | P3 | One subject keyword saved | 1. Leave subject blank. 2. Run. | Result: **Green** (nothing to match against). No crash or error. |
| AA-SUB-09 | Duplicate keyword rejected | Edge | P2 | `complain` already saved | 1. Type `complain` again and press Enter. | No duplicate chip created. |
| AA-SUB-10 | Config persists after reload | UX | P1 | One or more keywords saved | 1. Reload page. | Keywords visible. Config not lost. |

---

## Section 3 — Words in User Message

Inbound rule. Matches against the **body of the customer's message**. If the body contains a configured word, the conversation is unassigned.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-WIM-01 | Add a valid keyword | Happy | P1 | Guardrails page open | 1. Type `cancel` into input. 2. Press Enter. 3. Save. | Chip `cancel` appears. Save succeeds. |
| AA-WIM-02 | Rule triggers — keyword in message body | Happy | P1 | `cancel` is saved | 1. Go to Playground. 2. Set message body to `I want to cancel my subscription`. 3. Run. | Result: **Red**. Keyword found in body. |
| AA-WIM-03 | Rule does not trigger — keyword absent | Negative | P1 | `cancel` is saved | 1. Set message body to `How do I reset my password?`. 2. Run. | Result: **Green**. No match. |
| AA-WIM-04 | Delete keyword | Happy | P1 | `cancel` is saved | 1. Click `×`. 2. Save. 3. In Playground, re-run with same body. | Result: **Green**. Deleted rule no longer fires. |
| AA-WIM-05 | Case-insensitive match | Edge | P2 | Add `lawsuit` | 1. Set body to `I am considering a LAWSUIT`. 2. Run. | Result: **Red**. Match regardless of case. |
| AA-WIM-06 | Keyword embedded in longer word | Edge | P2 | Add `cancel` | 1. Set body to `I cannot proceed`. 2. Run. | Document observed behavior. If "cannot" triggers "cancel" — that is a false positive risk. Verify and record. |
| AA-WIM-07 | Multi-word body, keyword at end | Edge | P3 | Add `refund` | 1. Set body to `I paid twice and want a refund`. 2. Run. | Result: **Red**. Keyword position in body is irrelevant. |
| AA-WIM-08 | Empty message body | Edge | P2 | One keyword saved | 1. Leave body blank. 2. Run. | Result: **Green**. No match. No crash. |
| AA-WIM-09 | Multiple keywords — any one match is enough | Edge | P2 | Add `cancel` and `lawsuit` | 1. Set body to `I want to cancel`. 2. Run. | Result: **Red**. Single match sufficient to trigger. |
| AA-WIM-10 | Config persists after reload | UX | P1 | Keywords saved | 1. Reload. | Keywords still present. |
| AA-WIM-11 | Long message body with buried keyword | Edge | P3 | Add `refund` | 1. Set body to 500+ character message containing `refund` once. 2. Run. | Result: **Red**. Matching works regardless of body length. |

---

## Section 4 — Words in Assistant's Reply

Outbound rule. This section works **differently** from the three above. The rule does not filter the incoming message — it evaluates the AI's **generated draft reply**. If the draft contains a configured word, the reply is suppressed and the conversation is handed to a human.

> **Testing challenge:** This section requires engineering a prompt that reliably causes the AI to generate a specific word in its response. The AI output is non-deterministic. For automation, use a word that the AI is very likely to include given a crafted prompt (e.g., configure `sorry` and send a complaint that reliably causes the AI to apologize). This is a known constraint — flag it in the test plan.

| ID | Name | Type | Priority | Precondition | Steps | Expected Result |
|---|---|---|---|---|---|---|
| AA-WAR-01 | Add a keyword to block from AI reply | Happy | P1 | Guardrails page open | 1. Type `sorry` into input. 2. Press Enter. 3. Save. | Chip `sorry` appears. Save succeeds. |
| AA-WAR-02 | Rule triggers — AI reply contains blocked word | Happy | P1 | `sorry` saved. AI is known to respond with "sorry" to an apology prompt. | 1. Go to Playground. 2. Send a complaint message likely to trigger an apology. 3. Run. | Result: **Red**. AI draft contained the word; reply suppressed. |
| AA-WAR-03 | Rule does not trigger — AI reply does not contain word | Negative | P1 | `sorry` saved | 1. Send a neutral question (e.g., "What are your business hours?"). 2. Run. | Result: **Green**. AI reply doesn't contain `sorry`. |
| AA-WAR-04 | Delete the outbound keyword | Happy | P1 | `sorry` saved | 1. Click `×`. 2. Save. 3. Replay a prompt that previously triggered it. | Result: **Green**. Rule removed, reply no longer suppressed. |
| AA-WAR-05 | Case-insensitive match on AI reply | Edge | P2 | Add `Sorry` | 1. Trigger an AI response that includes `sorry` (lowercase). | Result: **Red**. Match is case-insensitive. |
| AA-WAR-06 | Inbound passes but outbound blocked | Edge | P2 | No inbound rules. `refund` saved in outbound. | 1. Send a message with no inbound matches. 2. The AI's draft contains `refund`. 3. Run. | Result: **Red**. Outbound rule fires even though inbound was clean. |
| AA-WAR-07 | Both inbound and outbound rules match | Edge | P2 | `cancel` in WIM. `sorry` in WAR. | 1. Send message with `cancel` in body AND craft a prompt where AI would say `sorry`. | Result: **Red**. Should block. Document which layer triggered. |
| AA-WAR-08 | Outbound rule does not affect inbound decisions | Negative | P2 | Only outbound rule set (`refund`) | 1. Send a message with `refund` in the body (inbound). 2. Run. | Result depends on expected behavior: outbound rule should NOT match against the inbound message body. Verify and document. |
| AA-WAR-09 | Config persists after reload | UX | P1 | Keywords saved | 1. Reload page. | Keywords still present. |
| AA-WAR-10 | Discard outbound changes | UX | P2 | No outbound keywords set | 1. Type `refund`. 2. Press Enter. 3. Click Discard. 4. Reload. | Chip not present after reload. |

---

## Cross-Cutting Test Cases

These tests apply across all sections and verify system-level behavior.

| ID | Name | Type | Priority | Steps | Expected Result |
|---|---|---|---|---|---|
| AA-CC-01 | Rules from all 4 sections are independently evaluated | Edge | P2 | Add 1 rule in each of the 4 sections. In Playground, send a message that only matches the Subjects rule. | Result: **Red**. Only the matching rule triggers. No side effects from the others. |
| AA-CC-02 | All 4 sections save and persist together | UX | P1 | Add one keyword to each section. Save once. Reload. | All 4 chips visible across all sections after reload. |
| AA-CC-03 | Save button state reflects unsaved changes | UX | P2 | Add a keyword but do not save. | Save/Discard controls appear in UI to indicate unsaved state. |
| AA-CC-04 | No rules configured — AI responds freely | Negative | P1 | Remove all rules from all sections. In Playground, send any message. | Result: **Green**. With no rules, AI always responds. |
| AA-CC-05 | Playground reflects live config | UX | P1 | Add a rule, save, then run Playground immediately (no reload). | Playground reflects the newly saved rule without requiring a page reload. |

---

## Out of Scope

| Area | Reason |
|---|---|
| Tags section | Explicitly out of scope per assignment brief |
| AI pipeline internals | Black box for this feature; Playground output is the observable surface |
| Google OAuth automation | Out of scope; handled manually in headed mode |
| Concurrent edits from multiple users | Infrastructure-level concern, not part of this assignment |
| API-layer assertions (bypassing UI) | Not in scope for Part 2 implementation; noted as a future layer |
