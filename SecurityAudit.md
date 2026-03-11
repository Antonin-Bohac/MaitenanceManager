# Security Audit Report

**Date:** 2026-03-11
**Scope:** Full codebase review — backend, frontend, install scripts, Docker configuration, dependencies, seed data
**Result:** PASS — No malicious code found. Recommendations for hardening noted below.

---

## Files Reviewed

- `install.sh`, `install.ps1`
- `Dockerfile`, `seed/maintenance.db`
- `app/main.py`, `app/database.py`, `app/models.py`, `app/schemas.py`, `app/migrate.py`
- All routers: `app/routers/*.py`
- All frontend: `app/static/js/*.js`, `app/static/css/style.css`, `app/static/index.html`
- Tests: `tests/*.py`
- `requirements.txt`

---

## Clean

- No backdoors, data exfiltration, hidden network calls, or obfuscated code
- Install scripts do exactly what they claim — no hidden commands or unexpected behavior
- All pip packages are legitimate and well-known (`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `pytest`, `httpx`, `python-multipart`)
- Seed database contains only factory/maintenance demo data — no embedded scripts or suspicious schemas
- All SQL queries use parameterized SQLAlchemy ORM — no SQL injection vectors
- Upload endpoint has solid path-traversal protection (double-check with `resolve()` and prefix validation)
- HTML escaping (`esc()` helper) is consistently applied to all server-supplied values rendered in the DOM
- No telemetry, analytics, or phone-home behavior

---

## Findings

### Critical (fix before shared/network deployment)

**1. No authentication on any endpoint**

All API routes are fully open. Any process or user that can reach the port can read, modify, or delete all data and upload files.

- **Risk:** High on shared networks or cloud VMs. Low for local Docker demo.
- **Fix:** Add HTTP Basic Auth via FastAPI's `HTTPBasic` dependency. A single username/password from an environment variable is sufficient for a PoC.

**2. Stored XSS via documentation URL field**

The `url` field on `DocumentationCreate` accepts any string, including `javascript:` or `data:` schemes. These are stored in the database and rendered as `<a href="...">` links and passed to `window.open()` in the frontend.

- **Files:** `app/schemas.py` (lines 82-83), `app/static/js/detail.js` (line 92), `app/static/js/detail-pane.js` (lines 283, 297)
- **Risk:** Low — requires an attacker to already have API access (see finding #1).
- **Fix:** Add a Pydantic `field_validator` that asserts the URL scheme is `http`, `https`, or empty. Add a client-side check before `window.open`.

### Warnings (should fix)

**3. Install scripts clone live `master` branch with no integrity verification**

The generated Dockerfile clones `master` at build time. If the repository is compromised or force-pushed, future installs silently get the compromised code.

- **Fix:** Pin to a git tag or commit SHA.

**4. Dockerfile runs as root**

No `USER` directive — the uvicorn process runs as root inside the container.

- **Fix:** Add `RUN adduser --disabled-password appuser` and `USER appuser` after pip install.

**5. Google Fonts loaded from external CDN**

`index.html` loads IBM Plex fonts from `fonts.googleapis.com`. Every page load pings Google's servers with the user's IP. The app looks broken without internet access.

- **Fix:** Self-host the font files.

**6. No input length validation on free-text fields**

Fields like `name`, `description`, `title`, `notes`, `assignee` have no `max_length` constraint in Pydantic schemas. SQLite does not enforce the column lengths defined in SQLAlchemy models.

- **Fix:** Add `Field(max_length=...)` constraints to Pydantic schemas.

**7. No Content-Security-Policy headers**

FastAPI serves no CSP, X-Frame-Options, or X-Content-Type-Options headers.

- **Fix:** Add a middleware that sets `Content-Security-Policy`, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.

### Notes (minor)

**8. `welcome_body` i18n string rendered as raw HTML**

Currently safe because the content is hard-coded in the JS bundle. Would become an XSS vulnerability if translation values ever come from an external source.

**9. `modal.js` uses inline `onclick` handlers**

Prevents future adoption of strict Content-Security-Policy. Should use `addEventListener` instead.

**10. `file_path` accepted from API clients in `DocumentationCreate`**

The upload serve endpoint validates paths correctly, but the field should be set by the server only, not accepted from clients.

**11. Test database uses file-path SQLite**

`tests/conftest.py` uses `sqlite:///./test.db` which creates a file in the working directory. Using `sqlite:///:memory:` would be faster and avoid leftover files.

---

## Positive Observations

- Upload endpoint path-traversal protection is well-implemented with double validation
- All database queries use parameterized ORM — no string concatenation SQL anywhere
- The `esc()` HTML escaping helper uses the correct browser-native `textContent`/`innerHTML` approach
- Install scripts contain no hidden network calls, credential harvesting, or obfuscated code
- Dependencies are minimal (7 packages), all well-known, with pinned exact versions
- Seed database is a clean SQLite file with only demo data

---

## Conclusion

**The application is safe to run as a local proof-of-concept demo.** No malicious code exists anywhere in the codebase. The critical findings (authentication, stored XSS) would need to be addressed before deploying to a shared network or production environment, but do not pose a risk for local Docker-based testing and demonstration.
