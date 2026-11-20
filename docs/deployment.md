---
layout: docs
title: "Deployment Guide"
permalink: /docs/deployment/
---

{% raw %}
Guide to deploying Vigil with Docker Compose or the Helm chart, and
managing a production environment.

Deployment is manual. No workflow in the repository deploys to a VM or
cluster automatically: the release workflow (`.github/workflows/release.yml`)
only builds and publishes images when release-please creates a `vX.Y.Z`
tag. An operator runs the Compose or Helm commands below.

Releases also publish channel tags: the stable channel adds `latest`,
`stable`, `X.Y` and `sha-…` tags, and a daily signed beta build of `main`
publishes `<next-minor>.0-beta.<date>.<run>` plus a moving `beta` tag
(beta images are deleted after 14 days).

## Table of Contents

- [Overview](#overview)
- [VM Requirements](#vm-requirements)
- [Initial Setup](#initial-setup)
- [Deployment Methods](#deployment-methods)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

---

## Overview

Vigil can be deployed in several configurations:

1. **Single VM**: All services on one machine (development/testing)
2. **Multi-VM**: Distributed deployment (staging/production)
3. **Docker Compose**: Container-based deployment using
   `infra/docker/docker-compose.yml`
4. **Kubernetes**: Via the Helm chart in `infra/helm/vigil/`
   (chart version 1.1.4, `appVersion` 1.1.4, requires Kubernetes
   `>=1.25.0-0`). See [Helm Values](/docs/helm/).

This guide focuses on **VM deployment with Docker Compose**.

---

## VM Requirements

> **Operator guidance only.** The sizing and multi-VM topology in this
> section are generic guidance. No sizing, load-balancer, or Postgres
> replication setup is defined in the Compose file, the Helm values, or
> the README at release 1.1.4. Adapt them to your own measurements.
> Note that the SOC daemon is a singleton, profile-gated service
> (`soc-daemon` runs only with the Compose `daemon` profile); it is not
> a free-standing tier in the documented stacks.

### Minimum Requirements (Single VM)

- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 50 GB SSD
- **Network**: Public IP with firewall

### Recommended Requirements (Production)

- **OS**: Ubuntu 22.04 LTS
- **CPU**: 8 cores
- **RAM**: 16 GB
- **Disk**: 100 GB SSD
- **Network**: Load balancer + multiple VMs

### Multi-VM Architecture

**Example production layout (operator guidance)**:

```
┌─────────────────┐
│ Load Balancer   │
│  (Nginx/HAProxy)│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌─▼──────┐
│ VM 1   │ │ VM 2   │
│Backend │ │Backend │
└────────┘ └────────┘
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │ VM 3    │
    │Postgres │
    └────┬────┘
         │
    ┌────▼────┐
    │ VM 4    │
    │ Daemon  │
    └─────────┘
```

**VM Roles**:
- **VM 1-2**: Backend API (load balanced)
- **VM 3**: PostgreSQL database
- **VM 4**: SOC Daemon (autonomous operations, singleton)

---

## Initial Setup

### 1. Prepare VM

Install Docker with the Compose v2 plugin from the Docker apt
repository. Do not install the standalone Compose v1 binary.

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker (includes the Compose v2 plugin)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Verify installation — note the space: `docker compose`, not `docker-compose`
docker --version
docker compose version

# Logout and login again for group changes
```

### 2. Create Deployment User

```bash
# Create deployer user
sudo adduser deployer
sudo usermod -aG docker deployer
sudo usermod -aG sudo deployer

# Setup SSH key for deployer
sudo su - deployer
mkdir ~/.ssh
chmod 700 ~/.ssh
vi ~/.ssh/authorized_keys  # Paste your SSH public key
chmod 600 ~/.ssh/authorized_keys
```

### 3. Prepare Deployment Directory

```bash
# As deployer user
sudo mkdir -p /opt/vigil
sudo chown deployer:deployer /opt/vigil
cd /opt/vigil

# Clone repository
git clone https://github.com/Vigil-SOC/vigil.git .

# Create necessary directories
mkdir -p logs evidence backups
```

### 4. Configure Firewall

Only the API and the daemon webhook are published on all interfaces by
the Compose file. The daemon metrics and health ports are bound to
loopback in Compose and must stay host-local — do not open them in the
firewall.

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow API (backend publishes 6987:6987; the SPA is bundled into the
# backend image, there is no separate production frontend port)
sudo ufw allow 6987/tcp

# Allow Webhook ingestion (daemon publishes 8081:8081)
sudo ufw allow 8081/tcp

# Do NOT allow 9090 or 9091: in infra/docker/docker-compose.yml the
# daemon metrics port (9090, /metrics, unauthenticated) and the daemon
# health port (9091, /health + /status, unauthenticated) are bound as
# 127.0.0.1:9090:9090 and 127.0.0.1:9091:9091 — host-local only.

# Enable firewall
sudo ufw enable
sudo ufw status
```

Port 6988 is only the Vite development server
(`clients/web/vite.config.ts`); Compose does not publish it.

---

## Deployment Methods

### Method 1: Docker Compose

The real Compose file is `infra/docker/docker-compose.yml` in the
repository checkout. Always invoke it explicitly:

```bash
# On deployment machine
cd /opt/vigil

# Set environment variables in .env file
cp env.example .env
vi .env  # Edit configuration (see Configuration below)

# Build local images and start the default set
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d

# Include the SOC daemon (and the ARQ worker)
docker compose --env-file .env -f infra/docker/docker-compose.yml --profile daemon up -d

# Check status
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
```

The Compose stack builds local images (for example the backend is
`image: vigil-backend:local` with `pull_policy: never`); it does not
pull the published release images. The default set runs the database,
cache, gateway, backup, API, and agent layer. Opt-in profiles add
more: `daemon`, `dev`, `observability`, `splunk`, `kafka`, `elastic`,
`misp`, `medic` (the Medic services), and `wazuh-sandbox`.

For a quick local start, the repository README also documents
`./start.sh`, which starts PostgreSQL, Redis, and Bifrost in Docker
and the API, agent layer, and frontend as host processes.

### Method 2: Published Release Images

Releases are created by release-please. When its release PR merges, a
`vX.Y.Z` tag triggers `.github/workflows/release.yml`, which builds
and publishes four images to GHCR. Image tags are pushed without the
`v` prefix (git tags still use `v`):

- `ghcr.io/vigil-soc/vigil-backend:<tag>` — FastAPI API + bundled SPA
- `ghcr.io/vigil-soc/vigil-daemon:<tag>` — headless SOC daemon
- `ghcr.io/vigil-soc/vigil-agent:<tag>` — TypeScript agent (worker + serve)
- `ghcr.io/vigil-soc/vigil-mcp-runner:<tag>` — MCP servers

For example, for release 1.1.4:

```bash
docker pull ghcr.io/vigil-soc/vigil-backend:1.1.4
docker pull ghcr.io/vigil-soc/vigil-daemon:1.1.4
docker pull ghcr.io/vigil-soc/vigil-agent:1.1.4
docker pull ghcr.io/vigil-soc/vigil-mcp-runner:1.1.4
```

Publishing an image does not deploy it. Pulling or referencing a new
tag in your own deployment and recreating the services is a manual
operator step.

### Method 3: Kubernetes (Helm)

```bash
helm install vigil ./infra/helm/vigil \
  --namespace vigil --create-namespace \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set secrets.postgresPassword="$(openssl rand -hex 24)" \
  --set secrets.vigilAppPassword="$(openssl rand -hex 24)" \
  --set secrets.jwtSecretKey="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"
```

See [Helm Values](/docs/helm/) for the full chart reference.

---

## Configuration

### Environment Variables

**File**: `.env` in the repository checkout (pass it explicitly with
`--env-file .env`).

`.env` is for bootstrap-only settings. LLM provider keys, SIEM
credentials, and other secrets are configured through the web UI
(Settings → AI / LLM Providers, Settings → Integrations) and stored
encrypted at `~/.vigil/secrets.enc`. For server-side / orchestrated
deployments where the UI isn't available at first boot, inject secrets
via the Helm chart values (see [Helm Values](/docs/helm/)) or your secret
manager of choice.

```bash
# Database — Python reads POSTGRES_* (via the encrypted
# POSTGRESQL_CONNECTION_STRING first, then POSTGRES_*). It never reads
# DATABASE_URL; only the TypeScript agent reads DATABASE_URL first,
# and env.example says to leave it unset.
# Three distinct passwords are required:
POSTGRES_PASSWORD=owner_password_change_me          # owner role: deeptempo
POSTGRES_APP_PASSWORD=app_password_change_me        # app role: vigil_app (backend, daemon, workers)
POSTGRES_AGENT_PASSWORD=agent_password_change_me    # agent role: vigil_agent (agent-serve, agent-worker)
# DATABASE_URL=  # leave unset (agent-only override)

# Backend — there is no SECRET_KEY setting. Unset JWT_SECRET_KEY means
# the backend refuses to start.
JWT_SECRET_KEY=generate_with_openssl_rand_base64_48
ENVIRONMENT=production

# LLM gateway (Bifrost) — provider keys are NOT set here
BIFROST_URL=http://bifrost:8080

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
RELEASE_VERSION=v1.1.4
```

### Docker Compose Configuration

Use the Compose file shipped in the repository:
`infra/docker/docker-compose.yml`. There is no Compose file at the
repository root, and the shipped file has no `version:` key.

It defines around 30 services, including `postgres` (`postgres:16-alpine`,
database `deeptempo_soc`, owner user `deeptempo`), `upgrade`, `redis`,
`backend`, `backup`, `soc-daemon` (profile `daemon`), `llm-worker`,
`agent-worker`, `agent-serve`, `medic`, `medic-gateway`,
`medic-dockerproxy`, `bifrost`, and `mcp-runner`, plus optional-profile
services such as Grafana and Prometheus.

State that must survive container recreation lives in named volumes.
In particular the encrypted secret store is persisted as:

```yaml
volumes:
  - vigil_home:/home/vigil/.vigil
```

The application runs as user `vigil` with `HOME=/home/vigil`, and looks
for `~/.vigil/secrets.enc` and `~/.vigil/master.key` there
(`core/secrets_manager.py`). Mounting that volume anywhere else (for
example `/root/.vigil`) means UI-configured provider keys are not
persisted where the app looks and are lost or undecryptable on
recreate. Do not replace the shipped volume mapping.

Published ports in the shipped file include:

- Backend: `6987:6987`
- Daemon webhook: `8081:8081`
- Daemon metrics: `127.0.0.1:9090:9090` (loopback only)
- Daemon health: `127.0.0.1:9091:9091` (loopback only)

### Nginx Reverse Proxy (Optional)

> **Generic operator example.** No nginx configuration ships in the
> code repository. Use your own domain, and proxy everything to the
> backend: the SPA is bundled into the backend image
> (`ghcr.io/vigil-soc/vigil-backend` is "FastAPI API + bundled SPA"),
> so there is no separate static frontend root to serve in production.

**File**: `/etc/nginx/sites-available/vigil`

```nginx
server {
    listen 80;
    server_name vigil.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vigil.example.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/vigil.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vigil.example.com/privkey.pem;

    # API and bundled SPA — both served by the backend on 6987
    location / {
        proxy_pass http://localhost:6987;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Monitoring

All Compose commands below use the shipped file:

```bash
COMPOSE="docker compose --env-file .env -f infra/docker/docker-compose.yml"
```

### Health Checks

```bash
# API health (the routes are /api/health and /api/health/ready;
# there is no bare /health route on the API)
curl http://localhost:6987/api/health

# Daemon metrics — loopback only, unauthenticated
curl http://localhost:9090/metrics

# Daemon health and status — loopback only, on 9091 (not 9090)
curl http://localhost:9091/health
curl http://localhost:9091/status

# Docker container status
$COMPOSE ps

# View logs
$COMPOSE logs -f backend
$COMPOSE logs -f soc-daemon
```

### Log Management

**View Logs**:
```bash
# All services
$COMPOSE logs --tail=100

# Specific service
$COMPOSE logs -f backend

# Save logs to file
$COMPOSE logs > logs/deployment-$(date +%Y%m%d).log
```

### Metrics Collection

Daemon metrics are exposed on the loopback-only port 9090 described
above. The backend also serves its metrics registry at `GET /metrics`
on port 6987.

**Grafana**: Compose already ships Grafana (`grafana/grafana:10.4.0`)
on host port `3001` (container port `3000`) under the `observability`
profile, with provisioned datasources and dashboards. Do not run a
separate ad-hoc Grafana container:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml --profile observability up -d
# Grafana UI: http://localhost:3001
```

---

## Maintenance

### Database Backups

Use the backup tooling that ships with the repository. There is no
`scripts/backup.sh`.

For a Compose deployment, use `scripts/vigil-compose.sh`. Backups are
online (nothing is stopped), use the stack's own `backup` service
(`pg_dump -Fc` plus `vigil_home` including `master.key`/`secrets.enc`,
investigations, and Bifrost) into an encrypted restic repository, add
an independent `pg_dump -Fc` and an encrypted extras bundle, and are
verified with `restore --test` before success is reported:

```bash
scripts/vigil-compose.sh backup
scripts/vigil-compose.sh list
```

For a `start.sh` / systemd install, use `scripts/vigil-backup.sh`,
which layers the native `./start.sh backup` snapshot, an independent
`pg_dump -Fc`, and an encrypted extras bundle, and is safe to run from
cron:

```bash
scripts/vigil-backup.sh
# Example cron entry (daily at 2 AM):
# 0 2 * * * /opt/vigil/scripts/vigil-backup.sh
```

### Database Restore

Restore through the same tooling — do not pipe a plain dump into a
stopped stack. `vigil-compose.sh restore` keeps Postgres and Redis up,
stops everything holding a database session, takes a safety dump of
the current database, swaps the snapshot in, brings the services back
up, and compares row counts. A restore rotates the JWT secret (every
session ends) and expires pending approvals.

```bash
# Verify a snapshot without touching the live stack
scripts/vigil-compose.sh restore --test

# Restore the latest snapshot
scripts/vigil-compose.sh restore
```

### Update Deployment

```bash
# Pull the latest code, rebuild the local images, and recreate
cd /opt/vigil
git pull origin main
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build

# Verify
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
curl http://localhost:6987/api/health/ready
```

### Certificate Renewal (Let's Encrypt)

If you terminate TLS with the nginx example above:

```bash
# Renew certificates
sudo certbot renew --nginx

# Verify renewal
sudo certbot certificates
```

---

## Troubleshooting

All Compose commands below use
`docker compose --env-file .env -f infra/docker/docker-compose.yml`.

### Service Not Starting

```bash
# Check logs
docker compose --env-file .env -f infra/docker/docker-compose.yml logs backend

# Check configuration
docker compose --env-file .env -f infra/docker/docker-compose.yml config

# Restart service
docker compose --env-file .env -f infra/docker/docker-compose.yml restart backend

# Rebuild and restart
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build --force-recreate backend
```

A common cause is an unset `JWT_SECRET_KEY`: the backend refuses to
start without it.

### Database Connection Issues

```bash
# Check PostgreSQL status
docker compose --env-file .env -f infra/docker/docker-compose.yml ps postgres

# Test connection
docker compose --env-file .env -f infra/docker/docker-compose.yml exec postgres psql -U deeptempo -d deeptempo_soc -c "SELECT 1;"

# Check network
docker network ls
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Restart memory-heavy service
docker compose --env-file .env -f infra/docker/docker-compose.yml restart soc-daemon
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Remove old images (keep the tags you need for rollback)
docker images | grep vigil | grep -v latest | awk '{print $3}' | xargs docker rmi

# Cleanup old logs
find /opt/vigil/logs -name "*.log" -mtime +7 -delete
```

> **Warning — volume loss.** Do not run
> `docker system prune -a --volumes` or
> `docker compose down -v` casually: they delete every named volume in
> the Compose file, including `postgres_data` (the database) and
> `vigil_home` (including `master.key`, without which `secrets.enc`
> cannot be decrypted), plus `bifrost_data`, `vigil_investigations`,
> `redis_data`, `backup_repo`, and `upgrade_state`. Keep backups
> outside the Compose volumes first (see the README warning on
> `shutdown_all.sh -d --full`).

---

## Security Hardening

Vigil-specific points first:

- Keep daemon ports 9090 (metrics) and 9091 (health/status) bound to
  loopback; both are unauthenticated.
- Set a strong, distinct value for each of `POSTGRES_PASSWORD`,
  `POSTGRES_APP_PASSWORD`, and `POSTGRES_AGENT_PASSWORD`, and a
  generated `JWT_SECRET_KEY`.
- Serve the console over HTTPS; sign-in cookies are `Secure` by
  default.

Generic host hardening (no repository counterpart — operator's own
responsibility) includes disabling root SSH login and password
authentication in `/etc/ssh/sshd_config`, and optionally installing
fail2ban for SSH protection.

---

## Rollback Procedures

Image tags are pushed without the `v` prefix (git tags still use
`v`). For example, release `v1.1.4` publishes image tag `1.1.4`, and
the previous release example below is `1.1.3`.

### Quick Rollback

For a deployment that runs the published images, point it back at the
previous tag and recreate the services. For a Compose deployment,
check out the previous release tag and rebuild instead — the Compose
stack builds local images and does not pull the published ones.

```bash
# Published-image deployments: select the previous version
export IMAGE_TAG=1.1.3  # image tags are pushed without the v prefix (git tags still use v)

# Compose deployments: check out the previous release and recreate
git checkout v1.1.3
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build

# Verify
curl http://localhost:6987/api/health/ready
```

### Complete Rollback with Database

Restore the database while Postgres is running, using the backup
tooling — never `exec` into Postgres after `down`, which cannot work
because the stack is stopped.

```bash
# 1. Verify the pre-upgrade snapshot first (leaves the live stack running)
scripts/vigil-compose.sh restore --test

# 2. Revert code to the previous release
git checkout v1.1.3

# 3. Restore the snapshot (the tool stops the app services itself,
#    keeps Postgres and Redis up, and takes a safety dump first)
scripts/vigil-compose.sh restore

# 4. Recreate the services at the previous version
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build

# 5. Verify
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
curl http://localhost:6987/api/health/ready
```

---

## Best Practices

1. **Always test in staging first**
2. **Backup before major updates**
3. **Monitor logs during deployment**
4. **Keep rollback images available**
5. **Document all configuration changes**
6. **Use infrastructure as code (IaC)**
7. **Automate routine maintenance**
8. **Set up alerts for critical issues**

---

## Additional Resources

- [Helm Values](/docs/helm/)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Sentry Documentation](https://docs.sentry.io/)
{% endraw %}
