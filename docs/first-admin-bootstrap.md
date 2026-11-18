---
layout: docs
title: First Admin Bootstrap
permalink: /docs/first-admin-bootstrap/
---

{% raw %}
## There is no default admin

Vigil does not seed a default admin account or password. Database init
deliberately leaves the `users` table empty so the operator chooses the
first admin's credentials, and so no known default password exists in any
deployment. There is no initialization script that creates an admin user.

## What database init does seed

On first database init, `infra/database/init/06_auth_tables.sql` creates
the `roles` and `users` tables and inserts the 5 system roles:

- **Viewer** — Read-only access to findings and cases
- **Analyst** — Full access to findings and cases, limited integrations
- **Senior Analyst** — Full analyst access plus approval rights
- **Manager** — User management and all integrations
- **Admin** — Full system access

The roles insert uses `ON CONFLICT (role_id) DO NOTHING`. Init inserts no
users.

## Create the first admin

The first admin is created through the bootstrap endpoint:

```
POST /api/auth/bootstrap
```

This endpoint creates the first admin account and is only ever available
on an empty instance. It is gated in two ways:

- **Empty instance only.** Bootstrap closes permanently as soon as a human
  user exists (the `has_human_user` check). Once any account exists, the
  endpoint refuses further calls.
- **Startup setup code.** The request body must include the setup code the
  API logs at startup while the user table is empty. Look for the
  `First-run setup code:` line in the API logs and copy the code from
  there.

Send the credentials you choose for the first admin, together with the
setup code:

```json
{
  "username": "your-username",
  "email": "you@example.com",
  "password": "a password you choose",
  "full_name": "Your Name",
  "setup_code": "the code from the API startup log"
}
```

A successful call returns `201` and the created admin user. After that,
sign in with the credentials you chose, and ask an administrator to create
any further accounts.

## Troubleshooting

### Bootstrap refuses the request

- "An account already exists. Ask an administrator to create yours." —
  a human user already exists, so bootstrap is closed. Further accounts
  are created by an administrator, and password reset is the recovery path
  for an existing account.
- "Setup code is missing or incorrect." — the submitted setup code does
  not match the code the API logged at startup. Copy the current code
  from the `First-run setup code:` line in the API logs.

### After a database reset or volume recreation

First setup, a database reset, and a deleted-and-recreated Docker volume
all return the instance to the same empty state. Re-run database init
(which restores the 5 system roles and no users), start the API, take the
new setup code from its startup log, and create the first admin via
`POST /api/auth/bootstrap` as above.
{% endraw %}
