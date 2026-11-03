# Production readiness review — 2026-11-03

This review fixes concrete deployment and credential-revocation defects. It is not a certification
of an operator's production environment. Use [deployment.md](deployment.md) for configuration.

## Changes

- Enable Actuator probes outside Kubernetes. Readiness includes database health; liveness does
  not depend on the database. Public probes disclose status only. Other Actuator endpoints require
  an administrator, including when an operator enables metrics. Only health is exposed by default.
- Give the unprivileged container a writable `/var/lib/portal-sso` home. Compose persists it,
  binds the application port to loopback by default, allows 45 seconds for shutdown, and permits
  removing optional bootstrap credentials after setup.
- Correct deployment volume paths, remove fallback database credentials from the Compose example,
  document trusted-proxy boundaries, and require a maintenance window for database migration.
- Revoke stored OAuth authorizations after self-service password changes, password resets, and
  forced expired-password changes. Other users' grants remain intact. Already-issued, independently
  validated JWT access tokens remain valid until expiry; deleting a grant stops subsequent refreshes.
- Update Angular framework packages to 21.2.26 and compatible dependency patches. CI now rejects
  high/critical findings in shipped frontend dependencies.

## Validation

- Java 25: `./mvnw -B verify -Dexec.skip=true` — 377 tests discovered, 371 passed,
  six MySQL tests skipped because Docker is unavailable. New regression coverage checks probe
  behavior, Actuator authorization, and credential-change grant revocation.
- Node 24.22.2 / npm 11.19.1: clean `npm ci`, production console build, and all 36 frontend tests pass.
- SDK TypeScript build passes. The executable JAR is repackaged with the updated console.
- `npm audit --omit=dev --audit-level=high` — zero findings. Full frontend audit reports
  16 moderate development-tooling findings, with no high or critical findings. The remaining
  chains involve Angular CLI's glob/minimatch dependencies; npm proposes a major CLI upgrade.
  Track that as a coordinated Angular/toolchain upgrade rather than forcing dependency overrides.
- First-run Playwright suite: all seven tests pass against the final packaged JAR, covering
  setup-key validation, administrator creation, branding, and subsequent browser sign-in.
- `git diff --check` passes.

## Before accepting production traffic

1. Run the existing CI Docker/PostgreSQL smoke test and MySQL integration tests. Neither database
   engine nor the container image was exercised locally; H2 tests do not establish their readiness.
2. Verify the public HTTPS issuer, secure cookies, proxy header rewriting, sign-in and MFA on the
   actual host. Keep the backend reachable only through the trusted proxy when forwarding is enabled.
3. Back up and restore the database, Portal home, and encryption key together. Migrate existing
   container home contents before adopting the new volume path; preserve the old volume until
   restoration and sign-in have been verified.
4. Test SMTP delivery, database connectivity/failure recovery, monitoring, and restart behavior
   against the deployment configuration. Avoid concurrent writes during in-app database migration.
5. Scan the final JVM dependencies and container image with the deployment's vulnerability scanner.
   This review ran npm audits, not a JVM/image vulnerability scan. Resolve or assess remaining
   development-tool findings before using the build environment with untrusted inputs.

No production service was deployed or modified by this review.
