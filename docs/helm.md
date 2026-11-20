---
layout: docs
title: "Helm Values"
permalink: /docs/helm/
---

{% raw %}
Vigil ships with a Helm chart under [`infra/helm/vigil/`](https://github.com/Vigil-SOC/vigil/blob/main/infra/helm/vigil) that
installs the backend, autonomous daemon, LLM worker, agent worker,
agent serve, MCP runner, agent shell, Bifrost gateway, Postgres, and
Redis as a single release. Medic is also in the chart but is off by
default (`medic.enabled: false`).

This is the MVP chart — it covers the common single-cluster deployment.
See the "Out of scope" section at the bottom for what it deliberately does
not do yet.

## Prerequisites

- Kubernetes 1.25+ (the chart declares `kubeVersion: '>=1.25.0-0'`)
- Helm 3 (the chart sets no minimum Helm version; CI pins Helm v3.15.2).
  Helm 4 is not in the CI matrix and has not been verified against this
  chart.
- A working container registry pull path. Release images are published to
  `ghcr.io/vigil-soc/vigil-backend`, `ghcr.io/vigil-soc/vigil-daemon`,
  `ghcr.io/vigil-soc/vigil-agent`, and
  `ghcr.io/vigil-soc/vigil-mcp-runner` by the `release.yml` workflow on
  `vX.Y.Z` tags pushed by release-please, for both `linux/amd64` and
  `linux/arm64`. A default install also pulls third-party images — see
  the image list on the [Helm Chart](/docs/helm-chart/) page before
  allow-listing a registry.
- An LLM provider — an Anthropic API key, or another provider (see
  "LLM providers" below). The chart does not require a key to install;
  the AI features return errors until one provider is configured.

## Get the chart

No packaged chart (Helm repository or OCI) is published; install from a
checkout of the code repository. Check out the release tag you intend
to install — `main` can be ahead of the latest release, and the chart's
default image tag comes from the chart `appVersion`, so installing from
`main` can mix unreleased templates with release images:

```bash
git clone https://github.com/Vigil-SOC/vigil.git
cd vigil
git checkout <release-tag>   # for example the latest vX.Y.Z tag
```

## Build the chart dependencies

The chart declares three subchart dependencies in `Chart.yaml`
(Bitnami `postgresql`, Bitnami `redis`, `opentelemetry-collector`) and
none are vendored in the repository. Helm checks for them on every
install, even when the subcharts' conditions are off (the default), so
this step is required for every install, not only for the optional
Bitnami or OTEL modes:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update
helm dependency build ./infra/helm/vigil
```

Run it from the repository root, once after cloning (and again after
checking out a release whose `Chart.lock` changed).

## Local test cluster (kind)

For local testing, [kind](https://kind.sigs.k8s.io/) or
[minikube](https://minikube.sigs.k8s.io/) both work. With kind:

```bash
kind create cluster --name vigil
kubectl get nodes
```

- kind needs Docker usable by your current user, without `sudo`.
- kind's default inotify limits are commonly too low for a stack this
  size. Raise them on the host, as kind's own known-issues page
  recommends:

  ```bash
  sudo sysctl -w fs.inotify.max_user_watches=524288
  sudo sysctl -w fs.inotify.max_user_instances=512
  ```

- The Postgres, Redis, daemon, and upgrade PVCs use the cluster's
  default StorageClass when no class is set in values. kind ships
  `standard` (local-path) as the default; minikube ships its own. Check
  with `kubectl get storageclass` before installing.
- Sizing: the development profile's resource requests sum to roughly
  1.3 CPU / 3.2 GiB across the default workloads, and the production
  profile's to roughly 2.6 CPU / 5.6 GiB, before the cluster's own
  overhead. Give a kind host at least 4 CPU and 8 GiB for the
  development profile below.

## Quick install

Every install must set the upgrade acknowledgement values (see
"How schema upgrades work" below) as well as the required secrets.
Do **not** use `--wait`: app pods fail their schema check until the
post-install upgrade Job finishes, and Helm waits for pods to become
Ready before it runs post-install hooks — so `--wait` deadlocks the
install.

The acknowledgement version must equal the chart `appVersion` of the
checkout you are installing from. Derive it instead of copying a
version number from this page, which will be stale by the next release:

```bash
ACK_VERSION="$(awk '/^appVersion:/ {print $2}' ./infra/helm/vigil/Chart.yaml)"
```

```bash
# Production-ish install with in-chart Postgres + Redis
helm install vigil ./infra/helm/vigil \
  --namespace vigil --create-namespace \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set secrets.postgresPassword="$(openssl rand -hex 24)" \
  --set secrets.vigilAppPassword="$(openssl rand -hex 24)" \
  --set secrets.jwtSecretKey="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')" \
  --set upgrade.acknowledgeVersion="$ACK_VERSION" \
  --set upgrade.acknowledgeReason="initial install" \
  --timeout 10m
```

`secrets.vigilAppPassword` is required whenever the chart renders the
Secret itself, and it must differ from `secrets.postgresPassword` —
app workloads log in as `vigil_app` and must not be able to authenticate
as the database owner.

```bash
# Development install — auth bypassed, smaller resource requests
helm install vigil ./infra/helm/vigil \
  -f ./infra/helm/vigil/values-dev.yaml \
  --namespace vigil --create-namespace \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set upgrade.acknowledgeVersion="$ACK_VERSION" \
  --set upgrade.acknowledgeReason="dev install"
```

(The dev values file supplies development passwords for the Postgres
roles; the acknowledgement values are still required.)

## Verifying the install

```bash
kubectl get pods -n vigil
kubectl get jobs -n vigil -l app.kubernetes.io/component=upgrade

# End-to-end smoke test
helm test vigil -n vigil

# Port-forward and hit the API
kubectl port-forward -n vigil svc/vigil-backend 6987:6987
curl http://localhost:6987/api/health/ready
```

Verify with `/api/health/ready`, not `/api/health`. `/api/health` is a
liveness check: it returns HTTP 200 whenever the process is up, even on
a broken install whose database has no schema yet. `/api/health/ready`
returns the same JSON body, but HTTP 503 until the install is actually
ready. On a working install it returns 200 with
`"database_available": true` under `storage` and `"state": "ok"` under
`schema`. The chart's own readiness probe and `helm test` use
`/api/health/ready`. Every app pod showing `1/1 Running` is the other
signal: the pods do not become Ready until the schema upgrade Job has
finished.

## First login

The backend serves the web UI itself, so with the port-forward above
running, open `http://localhost:6987`.

No default admin account ships. On first visit the UI opens a
bootstrap screen where you create the admin account with a password of
your choosing. The screen asks for a setup code, which the backend
logs once its database is ready:

```bash
kubectl logs -n vigil deploy/vigil-backend | grep 'First-run setup code:'
```

Bootstrap is one-time: it closes as soon as one account exists. Get
the setup code from the backend's logs yourself, and do not expose the
port-forward beyond your own machine (for example with
`--address 0.0.0.0`) before the admin account exists.

Two access notes:

- **Secure cookies.** The production values set
  `VIGIL_COOKIE_SECURE: "true"`. Browsers accept Secure cookies on
  `http://localhost`, but not on `http://<lan-ip>:6987`, so browsing a
  forwarded port by LAN IP will not keep a session. Port-forward to
  localhost (as above), tunnel from a remote box with
  `ssh -L 6987:localhost:6987 <host>`, or use Ingress with TLS (below)
  for anything beyond local access.
- **Remote boxes.** `kubectl port-forward` binds to localhost by
  default; the SSH tunnel above is the way to reach a cluster you
  administer remotely.

## LLM providers

All of Vigil's LLM traffic goes through the Bifrost gateway. The chart
deploys it by default (`bifrost.enabled: true`, a StatefulSet with a
ClusterIP Service) and points the workloads at it via
`config.BIFROST_URL`. Set `bifrost.enabled: false` and
`config.BIFROST_URL` to run against a gateway you operate yourself.
See [Bifrost](/docs/bifrost/) for how the gateway routes providers.

Configure at least one provider, or the AI features return errors (the
chart's install notes warn about this too):

- **Anthropic, OpenAI, or Gemini** — set `secrets.anthropicApiKey`,
  `secrets.openaiApiKey`, or `secrets.geminiApiKey`, or supply the keys
  through `secrets.existingSecret` / an ExternalSecret. Providers and
  keys can also be managed after install in
  Settings → AI models → Providers & Keys.
- **Local Ollama** — point `config.OLLAMA_URL` (default
  `http://ollama:11434`) at your Ollama server. For an Ollama running
  on the host of a kind or minikube cluster, use an address that is
  reachable from inside the cluster: `localhost` inside a pod is the
  pod itself.

## Secrets

The chart supports three native options for secrets, plus external
tooling that feeds option 2:

### 1. Plain values (simplest)

Set `secrets.*` in values.yaml or via `--set`. The chart renders a
`Secret` object containing the values you pass. Its name is
`<fullname>-secrets`, where `<fullname>` is the release name alone if
the release name contains `vigil`, and `<release>-vigil` otherwise —
so a release named `vigil` gets `vigil-secrets`, while a release named
`prod` gets `prod-vigil-secrets`.

**Do not commit these values.** Use `--set-file`, an external `values.yaml`
that's `.gitignore`d, or (better) option 2 below.

### 2. Pre-created Secret (recommended for prod)

Create the Secret out-of-band (e.g. via
[ExternalSecrets Operator](https://external-secrets.io/), SOPS, or sealed
secrets) and point the chart at it:

```yaml
secrets:
  existingSecret: vigil-prod-secrets
```

The Secret must provide keys matching env var names. At minimum:

- `ANTHROPIC_API_KEY`
- `POSTGRES_PASSWORD` (the database owner password; used by Postgres
  and the upgrade Jobs only — app pods do not receive it)
- `POSTGRES_APP_PASSWORD` (the `vigil_app` password app pods log in with)
- `POSTGRES_AGENT_PASSWORD` (the `vigil_agent` password used by
  agent-serve and agent-worker)
- `JWT_SECRET_KEY` (when `DEV_MODE=false`)

The chart also carries the Bifrost admin password:
`secrets.bifrostAdminPassword` (rendered as `BIFROST_ADMIN_PASSWORD`).
Agent pods do not receive it — they load only the app-Secret keys they
read. When rendering with `helm template` or GitOps, set it explicitly:
a generated value cannot be preserved by lookup. Set it in
`secrets.bifrostAdminPassword` when you run an external Bifrost gateway
that has an admin password.

Where those components are used, the Secret must also carry
`MCP_RUNNER_TOKEN` (MCP runner) and `SHELL_TOKEN` (agent shell).

Plus whichever integrations you use (`SPLUNK_PASSWORD`, `SLACK_BOT_TOKEN`,
`CROWDSTRIKE_CLIENT_ID`, `FALCON_CLIENT_SECRET`, etc.). Note the rendered
key names: the CrowdStrike client secret is stored as
`FALCON_CLIENT_SECRET`, not `CROWDSTRIKE_CLIENT_SECRET`.

### 3. ExternalSecret (ExternalSecrets Operator)

Set `secrets.externalSecret.enabled: true` and configure
`secrets.externalSecret.secretStoreRef`, `.data`, or `.dataFrom`. The
chart renders an `ExternalSecret` that materializes the Secret from an
external store, and skips rendering the plain Secret — the same skip
that applies when `existingSecret` is set.

## External Postgres / Redis

Disable the in-chart services and point at existing infrastructure:

```yaml
postgresql:
  enabled: false
  external:
    host: db.prod.example.com
    port: 5432
    database: deeptempo_soc
    username: deeptempo
    existingSecret: vigil-db-credentials
    existingSecretKey: password

redis:
  enabled: false
  external:
    url: "rediss://:password@redis.prod.example.com:6379/0"
```

The chart's own defaults for the external database and username are
`deeptempo_soc` / `deeptempo`. App pods always log in as `vigil_app`
regardless of the configured username.

There is no `postgresql.external.sslRequired` setting — the chart
injects discrete `POSTGRES_*` variables, not a DSN, and no template
consumes that key. To require SSL, set `POSTGRES_SSL_MODE=require`
via `extraConfig` / `extraEnv`.

## Ingress + TLS

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
  hosts:
    - host: vigil.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: vigil-tls
      hosts:
        - vigil.example.com
```

## How the daemon stays a singleton

The SOC daemon runs as a StatefulSet with `replicas: 1` hardcoded in the
template (not exposed in values.yaml). The orchestrator keeps in-memory
state — work queues, agent tracking — that is not safe to share across
replicas. On rolling updates, the `OrderedReady` + partition strategy ensures
the new pod fully replaces the old one before anything else happens.

If you need horizontal daemon scaling, that's a larger architectural
change; the chart deliberately does not expose daemon replicas.

## How schema upgrades work

`python -m core.upgrade`, run from the backend image as the database
owner, is the only schema writer. App pods never write schema — they
only check that the database's `alembic_version` is at their head, and
fail that check until it is.

With `upgrade.enabled: true` (the default), the chart runs hook Jobs:

- `install` (post-install, weight 0): takes an empty database to head.
- `check` (pre-upgrade, weight -10): runs `--check` after verifying the
  upgrade acknowledgement. It never scales anything. If it refuses,
  Helm stops before applying any manifest and the previous release
  keeps serving.
- `apply` (pre-upgrade, weight 0): scales every Deployment and
  StatefulSet of the release except Postgres and Redis to 0, waits for
  the pods to go, ends leftover `vigil_app` sessions, and applies the
  upgrade.

Helm takes no Vigil backup. The acknowledgement stands in for the
restore point, so both values are required on install and on every
upgrade:

- `upgrade.acknowledgeVersion` — must equal the chart `appVersion`
  (a value left over from an earlier upgrade refuses, as does an
  empty one).
- `upgrade.acknowledgeReason` — why you are upgrading without a Vigil
  restore point, e.g. "nightly RDS snapshot 2026-10-22". Recorded in
  the upgrade history.

Set `upgrade.enabled: false` to render none of this — but then you
must run `python -m core.upgrade` as the owner yourself before app
pods can start.

## Upgrades

Re-derive `ACK_VERSION` from the new checkout first (see Quick
install): the value from the previous release refuses by design, and
`--reuse-values` carries that stale value forward unless it is set
again here.

```bash
helm upgrade vigil ./infra/helm/vigil -n vigil --reuse-values \
  --set upgrade.acknowledgeVersion="$ACK_VERSION" \
  --set upgrade.acknowledgeReason="nightly RDS snapshot" \
  --timeout 30m
```

Plan a maintenance window. Once the `apply` Job has stopped the
release, it is down until Helm has rolled out the new pods, and source
events are not queued meanwhile. Set `--timeout` to cover the stop and
rollout (Helm's default is 5m). Do not use `--wait` for the same reason
as on install.

If the upgrade fails before a revision ran, the recorded scales come
back and the previous release serves again. If it fails after a
revision ran, workloads stay at 0: restore your own database backup
and run `helm rollback`.

The chart's default image tag resolves to `Chart.AppVersion`, which
release-please bumps in lockstep with the chart `version` on every
release — so a `helm upgrade` after pulling the new chart picks up the
matching images automatically. Override only if you need to pin to a
different tag than the chart's `appVersion` (for example, to deploy a
`:latest` build for testing):

```bash
helm upgrade vigil ./infra/helm/vigil -n vigil --reuse-values \
  --set upgrade.acknowledgeVersion="$ACK_VERSION" \
  --set upgrade.acknowledgeReason="nightly RDS snapshot" \
  --set backend.image.tag=latest \
  --set daemon.image.tag=latest
```

Pod checksums on the ConfigMap + Secret force pod restarts when config
changes, so `helm upgrade --set config.X=Y --reuse-values` will do the right
thing.

## Uninstall

```bash
helm uninstall vigil -n vigil
kubectl get pvc -n vigil   # StatefulSet volume claims carry no instance label — list them first
kubectl delete pvc -n vigil <claim-names-from-the-listing>  # optional: drop data
kubectl delete namespace vigil
```

PVCs are **not** auto-deleted with the release — that's a safety measure
against accidental data loss. The StatefulSets' `volumeClaimTemplates`
carry no labels, so a label selector such as
`app.kubernetes.io/instance=vigil` matches nothing; delete claims by
the explicit names shown by `kubectl get pvc`.

## NetworkPolicies

Flip `networkPolicies.enabled=true` to lock down inter-pod traffic. The chart
emits a default-deny policy plus per-component allow rules:

- Postgres: accepts only from backend, daemon, llm-worker, agent-worker,
  and agent-serve
- Redis: accepts only from backend, daemon, llm-worker, and agent-worker
- The upgrade Jobs get their own hook NetworkPolicy in the upgrade
  template, separate from the per-component policies above
- Daemon webhook (port 8081): restricted to CIDRs listed in
  `networkPolicies.daemon.webhookAllowFrom` — an empty list omits the
  CIDR rule entirely, leaving only the same-namespace pods rule
  (`podSelector: {}`)
- Backend: accepts traffic from the ingress controller's namespace (by
  label selector) + cluster-internal

```yaml
networkPolicies:
  enabled: true
  ingressControllerNamespaceSelector:
    kubernetes.io/metadata.name: ingress-nginx
  daemon:
    webhookAllowFrom:
      - 203.0.113.0/24   # your SIEM's outbound CIDR
```

When Bitnami postgresql / redis subcharts are active, their own
`networkPolicy.*` settings take over; the chart's NetworkPolicy for the
corresponding data service suppresses itself.

## Observability

### ServiceMonitor (Prometheus Operator)

```yaml
observability:
  serviceMonitor:
    enabled: true
    labels:
      release: kube-prometheus-stack  # match your Prometheus instance's selector
```

The daemon's `/metrics` endpoint on port 9090 only serves traffic when
`DAEMON_METRICS_ENABLED` is on — it defaults to `"true"` in the chart's
config, so the endpoint serves unless you turn it off.

### In-chart OTEL Collector

Ships the upstream `open-telemetry/opentelemetry-collector` chart as an
optional subchart. Requires `helm dependency update` once:

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm dependency update infra/helm/vigil
```

Then enable:

```yaml
otelCollector:
  enabled: true
  # Replace the default debug exporter with whatever your stack consumes
  config:
    exporters:
      otlphttp/jaeger:
        endpoint: http://jaeger-collector:4318
    service:
      pipelines:
        traces:
          exporters: [otlphttp/jaeger]
```

Telemetry is enabled by setting a non-empty
`OTEL_EXPORTER_OTLP_ENDPOINT` — empty exports nothing. When
`otelCollector.enabled=true`, the chart rewrites
`OTEL_EXPORTER_OTLP_ENDPOINT` to
`http://<release>-opentelemetry-collector:4317` in the rendered
ConfigMap, but you can override if needed.

## Autoscaling the LLM worker

Two modes — pick one.

### CPU-based (no extra dependencies)

```yaml
llmWorker:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
```

### KEDA-based (queue-depth driven)

Recommended for Vigil workloads: LLM calls are I/O-bound, so CPU is a poor
proxy for load. KEDA watches the `arq:llm` Redis list and scales when the
backlog grows.

Prerequisite: KEDA installed on the cluster (https://keda.sh/docs/latest/deploy/).

```yaml
llmWorker:
  autoscaling:
    enabled: false   # disable the CPU HPA
    keda:
      enabled: true
      minReplicas: 2
      maxReplicas: 20
      listLength: "5"   # 1 replica per 5 queued items
```

For an external Redis, set `llmWorker.autoscaling.keda.redisAddress`
explicitly (host:port form, without scheme or password): the KEDA
scaler takes its address only from that value when neither the in-chart
Redis nor the Bitnami subchart is active, and does not parse
`redis.external.url`. When Redis auth is in play — the Bitnami subchart
or the in-chart Redis — the chart also emits a KEDA
`TriggerAuthentication` referencing the corresponding Secret.

## Choosing a Postgres/Redis backend

Three modes, mutually exclusive:

| Mode | When | How |
|---|---|---|
| MVP in-chart StatefulSet | default, dev, small deployments | default values |
| Bitnami subchart | production, want HA / metrics exporters / replicas | `postgresql.bitnami.enabled=true` + `redis.bitnami.enabled=true` |
| External | managed DB (RDS, Aurora, ElastiCache, etc.) | `postgresql.enabled=false` + `postgresql.external.*` |

Bitnami is opt-in because it requires `helm dependency update` (the
subcharts are not vendored in the chart). Run once after cloning:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update infra/helm/vigil
```

Then enable in values:

```yaml
postgresql:
  enabled: false         # disable MVP StatefulSet
  bitnami:
    enabled: true
    auth:
      database: deeptempo_soc
      username: deeptempo
    primary:
      persistence:
        size: 100Gi
      resources: { requests: { cpu: "1", memory: "2Gi" } }

redis:
  enabled: false
  bitnami:
    enabled: true
    architecture: replication
    auth:
      enabled: true
```

## Development utilities (Splunk, pgAdmin)

Off by default; flip on for demo clusters or local testing only:

```yaml
splunk:
  enabled: true    # ClusterIP Service on 8000 (web), 8088 (HEC), 8089 (mgmt), 9997 (forwarder)
  persistence:
    size: 50Gi

pgadmin:
  enabled: true    # ClusterIP Service on port 80
```

Neither is exposed via Ingress — use `kubectl port-forward` to reach them.
NOTES.txt warns if either is enabled alongside `config.DEV_MODE=false`.

## Secrets — advanced patterns

See [HELM-SECRETS.md](/docs/helm-secrets/) for end-to-end workflows covering
[Bitnami SealedSecrets](https://github.com/bitnami-labs/sealed-secrets) and
[Mozilla SOPS](https://github.com/getsops/sops), plus a comparison of the
supported secret-management patterns.

## Out of scope (today)

Not yet implemented; contributions welcome:

- Pre-canned Grafana dashboards
- Vertical Pod Autoscaler (VPA) support
- Multi-region deployment patterns

## Troubleshooting

**Upgrade Job refuses to run** — check the acknowledgement values:
`upgrade.acknowledgeVersion` must equal the chart `appVersion` and
`upgrade.acknowledgeReason` must be non-empty, on install and on every
upgrade. If an upgrade failed after a revision ran, workloads stay
scaled to 0 — restore your own database backup and run
`helm rollback`.

**Daemon pod keeps restarting** — probe the `/health` endpoint directly:
`kubectl exec -n vigil vigil-daemon-0 -- curl http://localhost:9091/health`.
If it returns 200, the probe is misconfigured; if it returns an error or
hangs, the daemon is actually unhealthy (check Anthropic API key, DB
connectivity).

**SPA shows a blank page** — the SPA is bundled into the backend image via
a multi-stage build in `infra/docker/Dockerfile.backend`. If you're using a
custom build of the backend, make sure the multi-stage build step ran and
copied `clients/web/build/` into the final image.
{% endraw %}
