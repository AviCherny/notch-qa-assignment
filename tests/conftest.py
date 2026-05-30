import json
import logging
import os
from pathlib import Path

import allure
import pytest
from playwright.sync_api import sync_playwright

from config import BASE_URL, PLAYWRIGHT_TRACE_DIR, PLAYWRIGHT_VIDEO_DIR, TIMEOUTS

AUTH_FILE       = Path(__file__).parent.parent / "auth" / "auth.json"
BROWSER_PROFILE = Path(__file__).parent.parent / ".browser-profile"


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)


def _create_auth_from_tokens(ds: str, dsr: str) -> None:
    domain = BASE_URL.replace("https://", "").replace("http://", "").split("/")[0]
    auth_state = {
        "cookies": [
            {
                "name": "DS", "value": ds,
                "domain": domain, "path": "/",
                "httpOnly": True, "secure": True, "sameSite": "Lax", "expires": -1,
            },
            {
                "name": "DSR", "value": dsr,
                "domain": domain, "path": "/",
                "httpOnly": True, "secure": True, "sameSite": "Lax", "expires": -1,
            },
        ],
        "origins": [],
    }
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUTH_FILE.write_text(json.dumps(auth_state, indent=2))
    logging.info("[auth] Session created from env tokens.")


def _auth_json_is_valid() -> bool:
    if not AUTH_FILE.exists():
        return False
    try:
        data = json.loads(AUTH_FILE.read_text())
        return bool(data.get("cookies") or data.get("origins"))
    except Exception:
        return False


def _interactive_login() -> None:
    logging.info("[auth] No saved session — opening browser for Google login.")
    print("\n[auth] No saved session found.")
    print("[auth] Opening browser — please sign in with Google.")
    print("[auth] You have 5 minutes.\n")

    BROWSER_PROFILE.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(BROWSER_PROFILE),
            headless=False,
            channel="chrome",
            viewport={"width": 1440, "height": 900},
        )
        page = ctx.new_page()
        page.goto(f"{BASE_URL}/config/guardrails")
        page.bring_to_front()

        page.wait_for_url(
            lambda url: "getnotch.dev" in url and "/login" not in url,
            timeout=300_000,
        )
        page.wait_for_load_state("networkidle")
        ctx.close()

    logging.info("[auth] Login successful. Session stored in browser profile.")


@pytest.fixture(scope="session", autouse=True)
def ensure_auth() -> None:
    if _auth_json_is_valid():
        logging.info("[auth] Reusing saved session from auth.json.")
        return

    if BROWSER_PROFILE.exists():
        logging.info("[auth] Reusing browser profile session.")
        return

    ds  = os.getenv("NOTCH_DS_TOKEN")
    dsr = os.getenv("NOTCH_DSR_TOKEN")
    if ds and dsr:
        _create_auth_from_tokens(ds, dsr)
        return

    _interactive_login()


@pytest.fixture
def context(ensure_auth, playwright):
    # On Windows, Chrome (not Chromium) stores session cookies with DPAPI encryption.
    # Playwright's storage_state() cannot extract them from a persistent context.
    # When auth.json has valid tokens (CI / env-var injection), use a regular context.
    # Otherwise, reuse the browser profile from interactive login directly.
    browser_instance = None

    if _auth_json_is_valid():
        browser_instance = playwright.chromium.launch(channel="chrome")
        ctx = browser_instance.new_context(
            storage_state=str(AUTH_FILE),
            viewport={"width": 1440, "height": 900},
            base_url=BASE_URL,
            record_video_dir=PLAYWRIGHT_VIDEO_DIR,
        )
    else:
        ctx = playwright.chromium.launch_persistent_context(
            str(BROWSER_PROFILE),
            channel="chrome",
            viewport={"width": 1440, "height": 900},
            base_url=BASE_URL,
            record_video_dir=PLAYWRIGHT_VIDEO_DIR,
        )

    ctx.set_default_timeout(TIMEOUTS["element"])
    ctx.set_default_navigation_timeout(TIMEOUTS["navigation"])
    ctx.tracing.start(screenshots=True, snapshots=True, sources=True)
    yield ctx
    ctx.close()
    if browser_instance:
        browser_instance.close()


@pytest.fixture
def page(context, request):
    p = context.new_page()
    console_errors: list[str] = []
    p.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    yield p

    rep_setup = getattr(request.node, "rep_setup", None)
    rep_call = getattr(request.node, "rep_call", None)
    failed = (
        (rep_setup is not None and rep_setup.failed)
        or (rep_call is not None and rep_call.failed)
        or (rep_call is not None and hasattr(rep_call, "wasxfail") and not rep_call.passed)
    )

    video = p.video
    try:
        if failed:
            allure.attach(
                p.screenshot(),
                name="screenshot_on_failure",
                attachment_type=allure.attachment_type.PNG,
            )
            if console_errors:
                allure.attach(
                    "\n".join(console_errors),
                    name="console_errors",
                    attachment_type=allure.attachment_type.TEXT,
                )
            os.makedirs(PLAYWRIGHT_TRACE_DIR, exist_ok=True)
            trace_path = f"{PLAYWRIGHT_TRACE_DIR}/{request.node.name}.zip"
            context.tracing.stop(path=trace_path)
            logging.info(f"[trace] Saved → {trace_path}  (open at trace.playwright.dev)")
        else:
            context.tracing.stop()
    finally:
        p.close()
        if video:
            if failed:
                allure.attach(
                    Path(video.path()).read_bytes(),
                    name="video_on_failure",
                    attachment_type=allure.attachment_type.WEBM,
                )
            else:
                video.delete()
