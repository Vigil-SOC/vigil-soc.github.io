---
layout: docs
title: "Production Security"
permalink: /docs/production-security/
---

{% raw %}
This document enumerates every security-relevant configuration switch and
provides the recommended production values. Each item has a single env var
or file location so it can be audited mechanically.

---

## Critical — Must Set Before Production

| Switch | Env Variable | Default | Production Value | Notes |
|--------|-------------|-------------|------------------|-------|
| Dev Mode | `DEV_MODE` | `false` | `false` | Opens specific auth gates (see below). Never enable in prod; production refuses to start with it on. |
| JWT Secret | `JWT_SECRET_KEY` | (empty) | 64+ char random string (recommended) | Required when `DEV_MODE=false`. `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| CSRF Enforcement | `VIGIL_CSRF_REPORT_ONLY` | `false` | `false` | Must be `false` to reject forged requests. |
| Access Token TTL | (fixed in code) | `30` min | `30` min | Fixed constant; the retired `JWT_ACCESS_EXPIRATION_MINUTES` setting is ignored. |
| Refresh Token TTL | (fixed in code) | `7` days | `7` days | Fixed; the retired `JWT_REFRESH_EXPIRATION_DAYS` setting is ignored. Actual session length is capped by the sign-in limits below. |
| Cookie Secure Flag | `VIGIL_COOKIE_SECURE` | `true` | `true` | Cookies only sent over HTTPS. |
| Cookie SameSite | `VIGIL_COOKIE_SAMESITE` | `strict` | `strict` | Prevents cross-origin cookie send. |
| PostgreSQL Passwords | `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`, `POSTGRES_AGENT_PASSWORD` | Compose change-me placeholders | Strong random, all three different | Owner, app role, and agent role passwords respectively. Fail-closed: when `DEV_MODE=false` the backend refuses a shipped/published default password and refuses a missing password at startup. |
| LLM Budget Unlimited | `LLM_BUDGET_UNLIMITED` | `false` | `false` | Keep cost guardrails active. |

`JWT_SECRET_KEY` is the root secret for the auth key ring: per-purpose keys are stored wrapped (Fernet) under a key HKDF-derived from it. It must be set when `DEV_MODE=false`; only in `DEV_MODE` does the backend mint a random value into the secret store (`~/.vigil/secrets.enc`).

`DEV_MODE` does not bypass all authentication. It opens only the gates listed
in `DEV_MODE_OPEN_GATES`: session auth (every request runs as a mock admin)
and vstrike inbound pushes. `/internal` routes are not opened — they remain
shared-secret only — and person-only permissions are still refused in dev
mode. The backend also refuses to start when `DEV_MODE=true` and
`ENVIRONMENT=production`.

---

## Authentication & Session Security

### JWT Tokens

- **Access tokens** expire after a fixed 30 minutes.
- **Refresh tokens** expire after a fixed 7 days.
- Both lifetimes are constants in code. The former host settings
  `JWT_ACCESS_EXPIRATION_MINUTES` and `JWT_REFRESH_EXPIRATION_DAYS` are
  retired: if they are still set, the backend logs at startup that they are
  ignored.
- Token payloads carry `jti`, `exp`, and `iat`, plus `sid` (the sign-in the
  token belongs to) and, for refresh tokens, `gen` (the sign-in's refresh
  generation) when applicable.
- A token's expiry is capped by its sign-in's absolute limit:
  `exp = min(now + expiration, not_after)`, so no token outlives its sign-in.

### Sign-In Sessions and Session Policy

Sessions are server-side sign-in records in the database, not stateless
tokens alone. Session behaviour is governed by the database-backed
`SessionPolicy`, whose defaults are:

- **Idle limit**: 15 minutes for standard accounts, 10 minutes for
  privileged accounts.
- **Absolute limit**: 12 hours from sign-in start, regardless of activity.

### Token Revocation

Revocation works by ending sign-ins in the database; there is no Redis
token blacklist.

- **Logout** ends the current sign-in.
- **Password change** and **role change** end all of the user's sign-ins.
- Once a sign-in has ended, its tokens are no longer accepted.

Redis is not involved in revocation. Redis backs the rate limiter (below);
if Redis is unreachable, the rate limiter degrades to in-memory limiting
rather than taking auth offline.

### MFA (TOTP)

- MFA secrets are **encrypted at rest** under the key ring: a per-purpose
  random key for the "mfa" purpose, wrapped (Fernet) under a key
  HKDF-derived from `JWT_SECRET_KEY`. Decryption accepts any ring key for
  the purpose, so keys can be rotated.
- **Recovery codes**: 10 codes generated when MFA is enabled (i.e. after the
  first TOTP code is confirmed), not at setup. Each is hashed with
  PBKDF2-HMAC-SHA-256 and stored; the plaintext is returned exactly once and
  cannot be retrieved again. Single-use: consumed on verification and
  removed from the list. Code sets hashed with the legacy bcrypt scheme are
  detected after a successful MFA step, voided, and replaced with a fresh
  set.
- Legacy unencrypted secrets are handled gracefully (transparent fallback).
- Endpoint: `POST /api/auth/mfa/setup` → returns TOTP secret + QR URI.
- Endpoint: `POST /api/auth/mfa/verify` → confirms the first TOTP code, enables
  MFA, and returns the one-time recovery codes.
- Endpoint: `POST /api/auth/mfa/recovery-codes` → regenerates a fresh set of
  recovery codes, invalidating the previous set.

### Account Lockout

Lockout is governed by the `SessionPolicy`, not environment variables:

- After `lockout_threshold` (default 3) consecutive failed logins, the
  account locks.
- By default (`lockout_timed` off) the lock holds until an administrator
  unlocks the account or the person uses a password reset link.
- With timed lockout enabled, the lock instead ends after `lockout_minutes`
  (default 30); a successful auth after expiry resets the counter.

### Password Policy

Password rules are also `SessionPolicy` fields:

- Minimum length: `password_min_length` (default 16).
- Password history: last `password_history` (default 5) are rejected.
- Passwords are hashed with PBKDF2-HMAC-SHA-256. Legacy bcrypt hashes are
  still verified, and are rewritten to PBKDF2 on successful login.

The old `AUTH_MIN_PASSWORD_LENGTH` / `AUTH_PASSWORD_HISTORY_LIMIT`
environment values survive only as one-time seed values carried into the
policy when they differ from the old defaults.

---

## CSRF Protection

- Enabled via `VIGIL_CSRF_ENABLED=true` (default).
- Double-submit cookie pattern: frontend reads `csrf_token` cookie and echoes
  it as `X-CSRF-Token` header on state-changing requests.
- **Enforcement**: `VIGIL_CSRF_REPORT_ONLY=false` rejects violations. Set to
  `true` only during initial deployment monitoring.
- Always exempt, and not removable: `/api/webhooks/`, `/mcp`, `/internal/`.
- Operator-configured paths add to that set, e.g.
  `VIGIL_CSRF_EXEMPT_PATHS=/api/webhooks/`. Ingestion paths are deliberately
  not exempt.
- Production refuses to start with CSRF disabled, in report-only mode, or
  with an exemption outside the allowed set.

---

## Cookie Configuration

| Variable | Default | Production |
|----------|---------|------------|
| `VIGIL_COOKIE_SECURE` | `true` | `true` (HTTPS only) |
| `VIGIL_COOKIE_SAMESITE` | `strict` | `strict` |

There are no cookie domain or path settings. The console hostname is
controlled by `VIGIL_CONSOLE_HOSTNAME`, and cookie paths are fixed in code:
`/` for the access cookie and `/api/auth/` for the refresh cookie, each
prefixed by `VIGIL_CONTEXT_PATH` on sub-path deployments.

Tokens are stored in **HttpOnly** cookies (not accessible to JavaScript).
`Secure=true` requires HTTPS — the browser will not send the cookie over
plain HTTP.

---

## Security Headers

Set via the security headers middleware. Defaults are conservative:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS) —
  emitted only on HTTPS requests
- `Content-Security-Policy`: configurable via `VIGIL_CSP_POLICY`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Rate Limiting

- Applied globally via middleware (`services/api/middleware/rate_limit.py`,
  with shared logic in `core/rate_limit.py`).
- Auth endpoints have tighter limits to prevent brute force.
- Configure with `slowapi` settings in the middleware. Redis keeps limits
  consistent across workers; an unreachable Redis degrades to in-memory
  limiting rather than taking auth offline.

---

## Deployment Hardening Checklist

```bash
# 1. Generate secrets
export JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")

# 2. Disable dev mode
export DEV_MODE=false

# 3. Enforce CSRF
export VIGIL_CSRF_REPORT_ONLY=false

# 4. Secure cookies (requires HTTPS)
export VIGIL_COOKIE_SECURE=true
export VIGIL_COOKIE_SAMESITE=strict

# 5. Token lifetimes are fixed in code (access 30 min, refresh 7 days).
#    The retired JWT_ACCESS_EXPIRATION_MINUTES /
#    JWT_REFRESH_EXPIRATION_DAYS settings are ignored — do not export them.

# 6. Set the three database passwords (all must differ)
export POSTGRES_PASSWORD=<strong random>
export POSTGRES_APP_PASSWORD=<strong random>
export POSTGRES_AGENT_PASSWORD=<strong random>
```

Token revocation needs no extra infrastructure: it ends sign-ins in the
database. Redis is used by the rate limiter, not by revocation.

---

## Require Single Sign-On (SSO)

When **Require single sign-on** is on, password sign-in and
password-reset links are refused for non-break-glass users. The setting
stays in force even when SSO itself is unusable — for example when the
client secret is unreadable or the `auth.sso` settings row is invalid —
so a fault never lets passwords back in.

The only ways back are:

- Re-save the client secret so SSO works again, or
- Run the host command `python -m core.auth.require_sso_off` inside the
  backend's environment. It asks for a reason, sets `require_sso` off,
  and records the change on the audit trail; it is not an API route.

Break-glass accounts are unaffected and can always sign in with a
password.

---

## Migration Notes

### Existing MFA Secrets

Pre-existing `mfa_secret` values stored as plaintext will continue to work:
the decrypt function falls back to the raw value only for values that are
not Fernet tokens. A value that looks like a Fernet token (prefix `gAAAAA`)
but cannot be decrypted with the ring's MFA keys raises an error rather
than falling back. New secrets are always stored encrypted. To force
re-encryption of all existing secrets, run a one-time migration script:

```python
from core.auth.auth_service import AuthService
from core.storage.connection import get_db_session
from core.storage.models import User

session = get_db_session()
for user in session.query(User).filter(User.mfa_secret.isnot(None)).all():
    # Check if already encrypted (Fernet tokens start with 'gAAAAA')
    if not user.mfa_secret.startswith("gAAAAA"):
        user.mfa_secret = AuthService._encrypt_mfa_secret(user.mfa_secret)
session.commit()
session.close()
```

### New Database Column

The `mfa_recovery_codes` column (JSONB, default `[]`) must be added to
existing deployments. For fresh installs it is in the upgrade baseline
(`core/upgrade/versions/0001_baseline.sql`), applied by `python -m core.upgrade`.
For existing databases:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes JSONB NOT NULL DEFAULT '[]';
```
{% endraw %}
