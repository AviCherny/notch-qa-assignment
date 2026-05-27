# Checklist: Port Infrastructure → Notch

**מטרה:** מבנה mature כמו infrastructure, טסט אחד רץ:
`Add "cancel" → Save → Open Playground → Body: "I want to cancel" → Assert: Red`

---

## PHASE 1 — ניקיון

- [ ] מחק `.browser-profile/` מ-git tracking + הוסף ל-`.gitignore`
- [ ] מחק `__pycache__/` מ-git tracking + הוסף ל-`.gitignore`

## PHASE 2 — מבנה (port מ-infrastructure)

- [ ] צור `ui/__init__.py`
- [ ] העבר `pages/` → `ui/pages/` (rename folder)
- [ ] מחק את `pages/` הריק לאחר ההעברה
- [ ] צור `ui/flows.py` עם `navigate_to_guardrails` + `navigate_to_playground` (`@allure.step`)

## PHASE 3 — שדרוג קבצים קיימים

- [ ] `config.py` — הוסף `PLAYWRIGHT_VIDEO_DIR = "videos/"`
- [ ] `tests/conftest.py` — הוסף video recording + cleanup (כמו infra)

## PHASE 4 — עדכון imports

- [ ] `ui/pages/automation_audit_page.py` — `from pages.base_page` → `from ui.pages.base_page`
- [ ] `ui/pages/playground_page.py` — `from pages.base_page` → `from ui.pages.base_page`
- [ ] `tests/e2e/test_cancel_playground.py` — `from pages.X` → `from ui.pages.X`

## PHASE 5 — CI + IDE

- [ ] צור `.github/workflows/tests.yml` (adapted מ-infra, ללא API tests)
- [ ] צור `.vscode/settings.json` + `launch.json`

## PHASE 6 — אימות

- [ ] `pytest --collect-only` — ודא שהטסט נמצא
- [ ] עדכן `README.md` למבנה החדש
- [ ] commit + push
