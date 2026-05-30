import json
import logging
import os
import socket
import urllib.request
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
    # Notch/Descope stores the session in localStorage (not cookies).
    origin = BASE_URL.rstrip("/")
    auth_state = {
        "cookies": [],
        "origins": [
            {
                "origin": origin,
                "localStorage": [
                    {"name": "DS",  "value": ds},
                    {"name": "DSR", "value": dsr},
                ],
            }
        ],
    }
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUTH_FILE.write_text(json.dumps(auth_state, indent=2))
    logging.info("[auth] Session created from env tokens.")


def _auth_json_is_valid() -> bool:
    if not AUTH_FILE.exists():
        return False
    try:
        data = json.loads(AUTH_FILE.read_text())
        # Notch/Descope stores DS and DSR tokens in localStorage, not cookies.
        for origin in data.get("origins", []):
            ls_keys = {item.get("name") for item in origin.get("localStorage", [])}
            if ls_keys & {"DS", "DSR"}:
                return True
        return False
    except Exception:
        return False


def _interactive_login() -> None:
    if os.getenv("CI"):
        raise RuntimeError(
            "[auth] CI environment detected but no valid auth session found.\n"
            "Set the AUTH_JSON_B64 repository secret to a fresh base64-encoded auth.json,\n"
            "or set NOTCH_DS_TOKEN + NOTCH_DSR_TOKEN env vars."
        )

    logging.info("[auth] No saved session — opening browser for Google login.")
    print("\n[auth] No saved session found.")
    print("[auth] Opening browser — please sign in with Google.")
    print("[auth] You have 5 minutes.\n")

    # Use bundled Chromium (not Chrome) so storage_state() can extract cookies
    # without DPAPI encryption (Windows Chrome encrypts httpOnly cookies via DPAPI,
    # making them inaccessible to Playwright's cookie extraction API).
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(f"{BASE_URL}/config/guardrails")
        page.bring_to_front()
        page.wait_for_load_state("load")

        # The app is an SPA that shows the login form inline (no /login redirect).
        # Wait for any state — either the login form or the authenticated app content.
        # "Sign in to Notch" text only appears on the login page.
        login_text = page.get_by_text("Sign in to Notch")
        try:
            login_text.wait_for(state="visible", timeout=30_000)
            logging.info("[auth] Login form visible — waiting for user to sign in.")
        except Exception:
            logging.info("[auth] Login form not detected — assuming already authenticated.")

        # If the login form IS present, wait for it to go away (user signed in).
        if login_text.is_visible():
            login_text.wait_for(state="hidden", timeout=300_000)
            # Give the app and Descope time to finish the auth callback and set cookies.
            page.wait_for_timeout(5_000)

        AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
        ctx.storage_state(path=str(AUTH_FILE))
        ctx.close()
        browser.close()

    logging.info("[auth] Login successful. Session saved to auth.json.")


@pytest.fixture(scope="session", autouse=True)
def ensure_auth() -> None:
    if _auth_json_is_valid():
        logging.info("[auth] Reusing saved session from auth.json.")
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

    # Login is always done via Chromium + storage_state (see _interactive_login).
    # Chrome channel is preferred on non-CI local runs for closer production fidelity,
    # but CI only has Playwright's bundled Chromium installed.
    is_ci = bool(os.getenv("CI"))
    launch_kwargs: dict = {} if is_ci else {"channel": "chrome"}

    # Some environments (e.g. machines using ISP DNS that blocks this domain) can't resolve
    # guardio.app.getnotch.dev via the system resolver, while Chrome's built-in DoH works.
    # If system DNS fails, resolve via Google DNS and inject via --host-resolver-rules.
    try:
        socket.getaddrinfo("guardio.app.getnotch.dev", 443)
    except socket.gaierror:
        doh = urllib.request.urlopen(
            "https://dns.google/resolve?name=guardio.app.getnotch.dev&type=A",
            timeout=5,
        )
        answers = json.loads(doh.read()).get("Answer", [])
        ip = next((a["data"] for a in answers if a.get("type") == 1), None)
        if ip:
            launch_kwargs["args"] = [f"--host-resolver-rules=MAP guardio.app.getnotch.dev {ip}"]
            logging.info(f"[dns] System DNS failed — using resolved IP {ip} via --host-resolver-rules")

    browser_instance = playwright.chromium.launch(**launch_kwargs)
    ctx = browser_instance.new_context(
        storage_state=str(AUTH_FILE),
        viewport={"width": 1440, "height": 900},
        base_url=BASE_URL,
        record_video_dir=PLAYWRIGHT_VIDEO_DIR,
    )

    ctx.set_default_timeout(TIMEOUTS["element"])
    ctx.set_default_navigation_timeout(TIMEOUTS["navigation"])
    ctx.tracing.start(screenshots=True, snapshots=True, sources=True)
    yield ctx
    ctx.close()
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
