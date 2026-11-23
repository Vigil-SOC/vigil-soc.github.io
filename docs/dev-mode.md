---
layout: docs
title: "DEV_MODE"
permalink: /docs/dev-mode/
---

{% raw %}
## 🚀 What is DEV_MODE?

DEV_MODE is a development-only feature that **bypasses session authentication** to allow rapid iteration without having to log in repeatedly. The bypass is not total — see the exceptions under "What Happens in DEV_MODE?" below.

**⚠️ CRITICAL WARNING**: This should **NEVER** be enabled in staging or production environments!

---

## 🎯 When to Use DEV_MODE

### ✅ Good Use Cases:
- Local frontend development and UI iteration
- Testing new features quickly
- Debugging without authentication barriers
- Running automated tests locally
- Rapid prototyping

### ❌ Never Use For:
- Staging environment
- Production environment
- Security testing
- Authentication flow testing
- Demos to stakeholders
- Any environment accessible from outside your machine

---

## 🔧 How to Enable DEV_MODE

### 🎉 Quick Setup for Fresh Install

**⚡ EASIEST: Use the setup script**

```bash
./setup_dev.sh
```

This script copies `env.example` to `.env` with authentication on — the template ships `DEV_MODE=false`. Set `DEV_MODE=true` in the resulting `.env` yourself if you want the bypass.

**Manual alternative:**

```bash
# Copy the template (DEV_MODE is set to false in the template)
cp env.example .env

# Then set DEV_MODE=true in .env

# Start services - auth will be bypassed!
./start.sh
```

That's it! **One file, one setting** - both backend and frontend will bypass authentication. 🚀

### ✨ New: Unified DEV_MODE Configuration

You now only need to set `DEV_MODE=true` in the **root `.env` file**!

The frontend automatically reads this setting - no separate frontend configuration is normally needed. One exception: an explicit `VITE_DEV_MODE` wins over the root setting (the desktop app forces it to `false`); otherwise the root `.env` `DEV_MODE` value is inherited. This makes it much simpler to enable/disable dev mode across the entire application.

### Setting DEV_MODE

**Option 1: Environment File (Recommended)**
```bash
# In root .env file
DEV_MODE=true

# Then restart services
./start.sh
# OR
./start.sh --daemon
```

**Option 2: Docker Compose**

The Compose file is `infra/docker/docker-compose.yml`, and its `backend` service already carries `DEV_MODE: ${DEV_MODE:-false}` — so set `DEV_MODE=true` in the root `.env` and recreate the service:

```bash
docker compose -f infra/docker/docker-compose.yml up -d backend
```

**Option 3: Terminal Export**

Do not rely on `export DEV_MODE=true` before `./start.sh`: `start.sh` loads the root `.env` over the exported value (and copies `env.example`, with `DEV_MODE=false`, if `.env` is missing). Set `DEV_MODE=true` in the root `.env` instead.

### How It Works

When you set `DEV_MODE=true` in the root `.env` file:

**Backend (FastAPI):**
- Reads `DEV_MODE` directly from environment
- Bypasses JWT authentication
- Returns a mock admin user (see "What Happens in DEV_MODE?" for the exact identity rules)

**Frontend (React + Vite):**
- Vite reads `DEV_MODE` from root `.env` file, unless an explicit `VITE_DEV_MODE` overrides it
- Automatically exposes it as `VITE_DEV_MODE` to the frontend
- Frontend bypasses login UI and uses mock admin user

No separate frontend configuration is normally needed! 🎉

---

## 🧪 Quick Start with DEV_MODE

### 1. Enable Dev Mode

**For Fresh Install** (Recommended):
```bash
# Copy template (DEV_MODE is set to false in the template, so set it to true in .env afterwards)
cp env.example .env
```

**For Existing Setup**:
```bash
# Just add to root .env file - controls both backend and frontend!
echo "DEV_MODE=true" >> .env
```

### 2. Restart Services

```bash
# Recreate the backend service so the changed .env is picked up
# (a plain restart does not recreate the container)
docker compose -f infra/docker/docker-compose.yml up -d backend

# Frontend: VITE_DEV_MODE is frozen into the bundle at Vite startup,
# so stop the running dev server first, then start it again
cd clients/web
npm run dev
```

### 3. Access Application

```bash
# Open browser
open http://localhost:6988

# You should be automatically "logged in" as dev-user
# No login screen will appear!
```

---

## 🔍 What Happens in DEV_MODE?

### Backend Behavior:

1. **Authentication Bypassed**: `get_current_user()` returns a mock admin user
2. **No JWT Validation**: Token validation is skipped for session auth
3. **Permissions**: Backend permission checks grant the built-in Admin role's catalog permissions — a permission name not in the catalog is denied, not granted
4. **Warning Logs**: Server logs will show warnings that DEV_MODE is active

**Exceptions — the bypass is not total:**

- `GET /metrics` still requires its metrics token: an unset token refuses everyone, including DEV_MODE.
- `/internal` endpoints are not affected: they stay shared-secret only and have no dev-mode branch.
- Person-only permissions (`audit.forward`, `audit.manage`) are still refused for a non-person principal, before the DEV_MODE branch is reached.

DEV_MODE also opens or relaxes other gates:

- The vstrike inbound push endpoint (`POST /api/integrations/vstrike/findings`) accepts pushes without its bearer token.
- LLM budget enforcement is relaxed.
- MCP auto-connect defaults at startup are relaxed.

```python
# Normal mode
Authorization: Bearer <valid-jwt-token>  # Required

# Dev mode
Authorization: <anything or nothing>     # Ignored
```

### Frontend Behavior:

1. **Login Skipped**: No redirect to /login
2. **Mock User Loaded**: Automatically logged in as "dev-user"
3. **Full Access**: Frontend `hasPermission()` returns `true` for any check — every feature is accessible in the UI. This frontend behaviour is broader than the backend catalog limit described above.
4. **Console Warnings**: Browser console shows DEV_MODE warnings

Frontend mock user (from `clients/web/src/contexts/AuthContext.tsx`) — it has no `permissions` field; the all-true effect comes from `hasPermission()`:

```javascript
{
  user_id: 'dev-user-id',
  username: 'dev-user',
  email: 'dev@localhost',
  full_name: 'Dev User (Full Admin)',
  role_id: 'role-admin',
}
```

Backend identity is different: `_get_dev_user` returns the real `admin` row if one exists; only otherwise does it return a transient `dev-user` with a random-UUID `user_id` and the admin role's id (or a random UUID). In DEV_MODE, backend `get_user_permissions` returns the whole built-in Admin catalog — do not rely on a fixed enumerated permission list.

---

## 🛡️ Security Considerations

### ⚠️ Never Enable in Production

**Risks if DEV_MODE is enabled in production:**
- **No authentication** - Anyone who can reach the instance can access the system, subject to the exceptions above
- **Full admin access** - Requests run with admin permissions
- **Data exposure** - Sensitive data is unprotected
- **Audit trail broken** - All actions appear to be from the admin account (or "dev-user" when no admin row exists)
- **Compliance violation** - Likely violates security compliance

### ✅ Safety Measures Implemented:

1. **Prominent Warnings**: 
   - Console warnings in both backend and frontend
   - Logs clearly indicate DEV_MODE is active

2. **Environment Separation**:
   - `DEV_MODE` is in the default `env.example` template, set to `false`
   - The backend refuses to start only when `DEV_MODE=true` and `ENVIRONMENT=production` (Helm sets `ENVIRONMENT=production`; Compose and local installs leave it unset). The staging ban above is policy, not code enforcement — a staging install without `ENVIRONMENT=production` is not automatically blocked.

3. **Documentation**:
   - Clear warnings in all documentation
   - This dedicated guide

4. **Code Reviews**:
   - Easy to spot in code reviews (env vars)
   - Grepping for `DEV_MODE` is straightforward

---

## 🐛 Troubleshooting DEV_MODE

### Problem: Still Redirecting to Login

**Check Configuration:**
```bash
# Check if DEV_MODE is set in root .env
cat .env | grep DEV_MODE

# Should show: DEV_MODE=true
```

**Check Backend:**
```bash
# Check if backend sees DEV_MODE
docker compose -f infra/docker/docker-compose.yml exec backend env | grep DEV_MODE

# Should show: DEV_MODE=true
```

**Solution:**
```bash
# Make sure DEV_MODE=true is in root .env
echo "DEV_MODE=true" >> .env

# Restart both services
./start.sh
# OR recreate the backend, and stop then restart the frontend dev server
docker compose -f infra/docker/docker-compose.yml up -d backend
cd clients/web && npm run dev
```

### Problem: API Returns 401 Unauthorized

This means backend DEV_MODE is not enabled.

**Check logs:**
```bash
docker compose -f infra/docker/docker-compose.yml logs backend | grep "DEV_MODE"

# Should see: "⚠️  DEV_MODE is ENABLED"
```

**If not showing:**
```bash
# Set in root .env
DEV_MODE=true

# Recreate the backend service so the change is picked up
docker compose -f infra/docker/docker-compose.yml up -d backend
```

### Problem: Frontend Still Shows Login Page

This means DEV_MODE is not being read by the frontend.

**Check console:**
```javascript
// Should see in browser console:
"⚠️  DEV_MODE is ENABLED - Authentication is BYPASSED!"
```

**If not showing:**
```bash
# Make sure DEV_MODE=true is in root .env (not clients/web/.env.development)
cat .env | grep DEV_MODE

# If missing, add it
echo "DEV_MODE=true" >> .env

# Stop the running frontend dev server first, then restart it
# (VITE_DEV_MODE is computed when Vite loads its config)
cd clients/web
npm run dev
```

---

## 📝 Testing Authentication with DEV_MODE

### Temporarily Disable for Auth Testing

**Simple - Just change one setting:**
```bash
# In root .env file, comment out or set to false
DEV_MODE=false

# Restart services (both backend and frontend will use auth)
./start.sh
# OR recreate the backend, and stop then restart the frontend dev server
docker compose -f infra/docker/docker-compose.yml up -d backend

cd clients/web
npm run dev
```

Now you can test the actual login flow!

---

## 🔄 Switching Between Modes

### Quick Toggle Script

Create a helper script:

```bash
#!/bin/bash
# toggle_dev_mode.sh

if [ "$1" == "on" ]; then
    echo "Enabling DEV_MODE..."
    # Update or add DEV_MODE=true to .env
    if grep -q "^DEV_MODE=" .env 2>/dev/null; then
        sed -i.bak 's/^DEV_MODE=.*/DEV_MODE=true/' .env
    else
        echo "DEV_MODE=true" >> .env
    fi
    echo "✅ DEV_MODE enabled - restart services"
elif [ "$1" == "off" ]; then
    echo "Disabling DEV_MODE..."
    # Update DEV_MODE to false in .env
    if grep -q "^DEV_MODE=" .env 2>/dev/null; then
        sed -i.bak 's/^DEV_MODE=.*/DEV_MODE=false/' .env
    fi
    echo "✅ DEV_MODE disabled - restart services"
else
    echo "Usage: ./toggle_dev_mode.sh [on|off]"
fi
```

Make executable:
```bash
chmod +x toggle_dev_mode.sh
```

Use it:
```bash
# Enable (controls both backend and frontend!)
./toggle_dev_mode.sh on
./start.sh

# Disable
./toggle_dev_mode.sh off
./start.sh
```

---

## 📊 DEV_MODE vs Normal Mode Comparison

| Feature | Normal Mode | DEV_MODE |
|---------|-------------|----------|
| **Login Required** | ✅ Yes | ❌ No |
| **JWT Validation** | ✅ Enforced | ❌ Bypassed |
| **Permissions Check** | ✅ RBAC enforced | ✅ Granted (frontend grants all; the backend grants only the built-in Admin role's catalog permissions and denies a name not in the catalog) |
| **User Identity** | ✅ Real users | ⚠️ Mock "dev-user" |
| **Audit Trail** | ✅ Accurate | ⚠️ Admin account (or "dev-user" when no admin row exists) |
| **Security** | ✅ Secure | ❌ INSECURE |
| **Iteration Speed** | 🐢 Slower | 🚀 Faster |
| **Production Ready** | ✅ Yes | ❌ NEVER |

---

## ✅ Best Practices

### DO:
- ✅ Use DEV_MODE for local development only
- ✅ Set DEV_MODE=true in root `.env` file (controls both backend and frontend!)
- ✅ Disable DEV_MODE before committing code
- ✅ Test authentication flows with DEV_MODE off
- ✅ Document when DEV_MODE was used in PRs
- ✅ Keep `.env` file in `.gitignore`

### DON'T:
- ❌ Enable DEV_MODE in staging/production
- ❌ Commit `.env` files with DEV_MODE=true
- ❌ Share DEV_MODE configs outside team
- ❌ Forget DEV_MODE is enabled during demos
- ❌ Use DEV_MODE for security testing
- ❌ Leave DEV_MODE on overnight (someone might access your dev machine)

---

## 🎓 Example Workflows

### Workflow 1: Frontend UI Development

```bash
# 1. Enable DEV_MODE (single setting for both!)
echo "DEV_MODE=true" >> .env

# 2. Start frontend
cd clients/web
npm run dev

# 3. Develop UI
# - No login required
# - Instant access to all features
# - Full admin permissions
# - Backend auth also bypassed automatically!

# 4. When done, disable for testing
# Stop the dev server first, then change the root .env and restart it
# (the working directory is still clients/web — edit the repo-root .env)
sed -i 's/DEV_MODE=true/DEV_MODE=false/' ../../.env
npm run dev

# 5. Test actual login flow
```

### Workflow 2: Backend API Development

```bash
# 1. Enable DEV_MODE in .env
echo "DEV_MODE=true" >> .env

# 2. Start API
uvicorn services.api.main:app --host 127.0.0.1 --port 6987 --reload

# 3. Test endpoints with curl (no auth needed)
curl http://localhost:6987/api/cases
# Works without Authorization header!

# 4. When done, disable for testing
sed -i 's/DEV_MODE=true/DEV_MODE=false/' .env
uvicorn services.api.main:app --host 127.0.0.1 --port 6987 --reload

# 5. Test with real auth
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:6987/api/cases
```

### Workflow 3: Full Stack Development

```bash
# 1. Enable DEV_MODE (one setting controls everything!)
echo "DEV_MODE=true" >> .env

# 2. Start all services
# start.sh already launches the frontend (Vite) itself — do not start it again,
# and Compose has no frontend service.
./start.sh
# OR
docker compose -f infra/docker/docker-compose.yml up -d

# 3. Develop freely without auth barriers
# - Backend auth bypassed
# - Frontend auth bypassed
# - All from one setting!

# 4. Before committing
sed -i 's/DEV_MODE=true/DEV_MODE=false/' .env

# 5. Test and commit
```

---

## 🔒 Pre-Production Checklist

Before deploying to staging or production, verify:

- [ ] `DEV_MODE` is not set to `true` in `.env` files (or is set to `false`)
- [ ] No `DEV_MODE=true` reaches the deployment through the root `.env` / Compose interpolation
- [ ] Environment variables verified in deployment config
- [ ] Authentication tested and working (login page appears)
- [ ] RBAC permissions enforced correctly
- [ ] Audit logs showing real users (not "dev-user")
- [ ] No console warnings about DEV_MODE in browser
- [ ] No server logs showing DEV_MODE warnings
- [ ] Security scan completed
- [ ] Code review approved

---

## 📞 Support

If you encounter issues with DEV_MODE:

1. Check this guide first
2. Verify environment variables are set correctly
3. Check console/logs for DEV_MODE warnings
4. Try restarting services
5. Check `.env.development` vs `.env` files

---

## 🎉 Summary

DEV_MODE is a powerful tool for rapid development, but use it responsibly:

- ✅ **Faster Iteration**: No login required
- ✅ **Full Access**: All permissions granted
- ⚠️ **Local Only**: Never in production
- ⚠️ **No Security**: Session authentication bypassed (with the exceptions noted above)

**Happy developing! 🚀**

---
{% endraw %}
