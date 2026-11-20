---
layout: docs
title: Documentation
permalink: /docs/
excerpt: Guides for running, deploying, and extending Vigil. These pages were moved out of the product repo so the site can own them.
---

Product and operator docs live here. The [Vigil](https://github.com/Vigil-SOC/vigil) repository keeps the root README, domain vocabulary (`CONTEXT.md`), GitHub/release files, and markdown that the product loads at runtime (workflow definitions, agent skills, templates); it also carries its own `docs/` tree for operator topics not covered on this site.

## Product

- [Architecture](/docs/architecture/)
- [Agents](/docs/agents/)
- [Integrations](/docs/integrations/)
- [Features](/docs/features/)
- [API](/docs/api/)
- [Detection engineering](/docs/detection-engineering/)
- [Chat-driven case management](/docs/chat-case-management/)
- [Chat case quick reference](/docs/chat-case-quick-reference/)
- [Backend tools](/docs/backend-tools/)
- [Source evidence](/docs/source-evidence/)
- [SLA usage](/docs/sla-usage/)
- [SLA policy API](/docs/sla-api/)
- [SLA quick reference](/docs/sla-quick-reference/)

## Deploy

- [Configuration](/docs/configuration/)
- [Deployment guide](/docs/deployment/)
- [Helm values](/docs/helm/)
- [Helm chart](/docs/helm-chart/)
- [Helm secrets](/docs/helm-secrets/) (examples: [sealed-secret.yaml](/docs/examples/sealed-secret.yaml), [sops-config.yaml](/docs/examples/sops-config.yaml))
- [Production security](/docs/production-security/)
- [State and secrets](/docs/state/)
- [Kafka ingestion](/docs/kafka-ingestion/)
- [Sandbox](/docs/sandbox/)
- [Bifrost gateway](/docs/bifrost/)
- [Database init SQL](/docs/database-init/)

## Develop

- [Contributing to Vigil](/docs/contributing/)
- [Releasing](/docs/releasing/)
- [Release setup](/docs/release-setup/)
- [DEV_MODE](/docs/dev-mode/)
- [CI/CD](/docs/ci-cd/)
- [GitHub workflows](/docs/github-workflows/)
- [Testing](/docs/testing/)
- [AI assistant notes](/docs/claude/)
- [LLM layer](/docs/llm-layer/)
- [Vendor slices](/docs/vendor-slices/)
- [Splunk testing](/docs/splunk-testing/)
- [Postgres to Splunk export](/docs/postgres-to-splunk/)
- [First admin bootstrap](/docs/first-admin-bootstrap/)

## Integrations

- [Amazon Security Lake](/docs/integrations/amazon-security-lake/)
- [Darktrace](/docs/integrations/darktrace/)
- [OpenCTI](/docs/integrations/opencti/)
- [OpenSearch](/docs/integrations/opensearch/)
- [VStrike kill chain MCP](/docs/integrations/vstrike-killchain/)
- [Wazuh](/docs/integrations/wazuh/)

## ADRs

- [0001 — Integration descriptor is the registry](/docs/adr/0001-integration-descriptor-is-the-registry/)
- [0014 — Off-host agent token and network policy](/docs/adr/0014-off-host-agent-token-and-network-policy/)
