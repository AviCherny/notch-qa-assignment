# Notch — QA Test Suite Assignment

## Overview

Design and partially implement an end-to-end test suite for the **Automation Audit** feature in Notch's configuration dashboard.

**Feature URL:** https://guardio.app.getnotch.dev/config/guardrails
**Scope:** `Automation Audit` section → 4 sub-features (see below)

---

## What the Feature Does

Notch is an AI-powered customer support assistant. The **Automation Audit** section defines deterministic rules that control whether the AI will respond to an incoming message — or hand it off to a human agent.

There are two directions these rules apply:

### Inbound rules (filter incoming messages)
These check what the customer sent **before** the AI processes it:

| Section | What it checks | Example |
|---|---|---|
| **Email patterns to unassign** | Sender email address | `no-reply`, `noreply`, `refunds@` |
| **Subjects** | Email subject line | `complain`, `unsubscribe` |
| **Words in user message** | Body of the customer's message | `banana`, `cancel`, `lawsuit` |

> If a match is found → the conversation is **unassigned** (AI does not respond; routed to a human).

### Outbound rules (filter AI-generated replies)
These check what the AI **is about to send** before it goes out:

| Section | What it checks | Example |
|---|---|---|
| **Words in assistant's reply** | The AI's drafted response | `refund`, `I cannot help` |

> If a match is found → the AI's reply is **suppressed** and the conversation is handed to a human.

---

## How to Test (The Playground)

Inside the dashboard, navigate to **Tests → Playground**.

1. Write a mock inbound email (from address, subject, body)
2. Click **Hit** (or equivalent run button)
3. The system simulates the full pipeline and shows:
   - **Green checkmark** → AI would respond
   - **Red X** → AI would NOT respond (rule triggered)

This playground is the primary mechanism for verifying behavior.

---

## Assignment Requirements

### Part 1 — Test Suite Design
- Plan test cases covering all 4 sub-features
- Cover: happy paths, edge cases, negative cases, boundary conditions, UX
- Choose any format (table, BDD, test plan doc, etc.)

### Part 2 — Code Implementation
- Pick **one** test case and implement it end-to-end as automated code
- Use Playwright (or equivalent) with **headed mode** so Google OAuth login can be completed manually
- After login, tests run automatically
- The code should be structured properly (page objects, config separation, clear sections)
- Deliver via GitHub repo link or zip file — **it must run**

---

## Auth Note

The app requires **Login with Google**. Automating OAuth is out of scope. The accepted approach:

1. Run the browser in **headed (non-headless) mode**
2. Manually complete Google login
3. Tests proceed automatically from that point

---

## Scope Boundaries

| In scope | Out of scope |
|---|---|
| Email patterns to unassign | Tags section |
| Subjects | How the AI pipeline works internally |
| Words in user message | Full OAuth automation |
| Words in assistant's reply | Other dashboard sections |
