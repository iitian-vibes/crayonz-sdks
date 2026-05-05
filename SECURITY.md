# Security Audit — Crayonz SDKs

Last reviewed: **2026-05-05** (initial audit at v0.1.5).

This document explains the publishing trust model, what is and isn't exposed by these SDK packages, and a checklist of things to keep doing (or never do) so the next maintainer doesn't accidentally leak something.

---

## TL;DR

| Concern | Status | Why |
|---|---|---|
| Are tokens stored in this repo? | **No** | OIDC Trusted Publishing eliminated `NPM_TOKEN` + `PYPI_TOKEN` |
| Is the public source code sensitive? | **No** | SDKs only contain client-side request shaping. No keys, no backend code. |
| Can a stolen GitHub credential publish a malicious package? | **Limited** | Only GitHub users with write access to this repo + push permission for `v*` tags can trigger a release. Branch protection (recommended below) closes this further. |
| Can a malicious package update silently replace a real one? | **No** | Sigstore provenance attestation pins each tarball to the GitHub Actions run that built it. End users can verify with `npm audit signatures`. |
| Could a future PR accidentally leak a server secret? | **Yes — review carefully** | See "What to never put in this repo" below. |

---

## How publishing actually works (no secrets needed)

The `.github/workflows/publish.yml` workflow uses **OpenID Connect (OIDC) Trusted Publishing**, supported by both npm and PyPI as of 2024-2025. The flow on every release tag:

1. GitHub Actions issues a short-lived OIDC JWT to the workflow run, signed by GitHub. The JWT's `sub` claim contains the org, repo, ref, and workflow filename: `repo:iitian-vibes/crayonz-sdks:ref:refs/tags/v0.1.5`.
2. `npm publish` (Node 24 / npm 11+) automatically detects it's running in GitHub Actions with `id-token: write`, requests the JWT, and presents it to the npm registry as auth.
3. npm checks the `sub` claim against the **Trusted Publisher** config at https://www.npmjs.com/package/@crayonz-ai/sdk/access. If it matches `iitian-vibes/crayonz-sdks` + `publish.yml`, the publish is accepted.
4. Same flow on the Python side via `pypa/gh-action-pypi-publish`, configured at https://pypi.org/manage/project/crayonz/settings/publishing/.
5. The OIDC JWT is single-use and expires within minutes. Even if leaked from logs (it isn't — GitHub redacts it), it can't be replayed.

**There are no `NPM_TOKEN`, `PYPI_TOKEN`, or any other secrets in:**
- This repo's `.github/workflows/`
- The repo's GitHub Actions secrets (verified empty: `gh secret list`)
- Any branch, tag, or commit history

---

## What's published vs. what's only in the repo

### Published to npm (`@crayonz-ai/sdk`)

Inspect with `npm pack --dry-run` from `typescript/`. Tarball contains:

- `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts` (built TypeScript output)
- `dist/index.*.map` (source maps — they reveal `src/` paths but not secrets)
- `LICENSE`, `README.md`, `package.json`

**Excluded** (via `.npmignore` + `package.json` `files` field): `src/`, `node_modules/`, `tsconfig.json`, `tsup.config.ts`.

### Published to PyPI (`crayonz`)

Inspect with `python -m build` from `python/`. Wheel contains:

- `crayonz/__init__.py`, `crayonz/_client.py`, `crayonz/_exceptions.py` (the package)
- `crayonz-X.Y.Z.dist-info/` (PyPI metadata)

**Excluded** (via `pyproject.toml` `tool.hatch.build.targets`): `tests/`, `dist/`, `.pytest_cache/`, etc.

### Public on GitHub but not published

- `.github/workflows/publish.yml` — the publish workflow itself
- `scripts/bump.sh` — release helper
- `CHANGELOG.md`, `SECURITY.md`, this README

These are visible on github.com/iitian-vibes/crayonz-sdks. None of them contain secrets.

---

## What's in the SDK source (and what isn't)

### What IS in the SDK (and is fine to be public)

- **Cloud Run service URLs** (`memeagent-199406543652.asia-south1.run.app`, etc.). These are publicly addressable URLs by design — anyone on the internet could discover them. They're guarded by API key auth (`X-API-Key`), so exposing the URL leaks nothing. When the API moves to a proxied gateway (`api.crayonz.ai`), update the SDK defaults.
- **Endpoint paths** (`/generate`, `/api/blog/generate`, etc.). Already public via the OpenAPI spec at https://crayonz.ai/api/openapi.
- **Type/field names** (`tone`, `count`, `meme_format`). Public by design — they're the developer-facing API.
- **The User-Agent string** (`@crayonz-ai/sdk` / `crayonz-python-sdk/X.Y.Z`). Useful for debugging, no security impact.
- **Header names** we send: `X-API-Key`, `X-Crayonz-Tag`, `Content-Type`, `User-Agent`. None are secret.

### What is NOT in the SDK (and must never be added)

- ❌ **No API keys, no `cz_live_*` strings, no `cz_test_*` strings.** The SDK takes the key as a constructor argument from the user's env.
- ❌ **No `SUPABASE_*` keys, `RESEND_API_KEY`, `CASHFREE_*` secrets, `GEMINI_API_KEY`.** These are server-only.
- ❌ **No backend code.** No imports from `nano-commerce/` or `crayonz_backend/`. The SDK is a thin HTTP client.
- ❌ **No internal endpoints** (`/admin/*`, `/api/cron/*`, `/api/webhooks/*`). These are server-internal and would be unsafe to expose in a client SDK even if they happened to work.
- ❌ **No internal hostnames** (Supabase project IDs aside from what's already in compiled JS, internal DNS names, debug URLs).

---

## Security checklist before each release

Run through this every time you cut a new version:

```bash
# 1. Inspect what npm will ship
cd typescript && npm install && npm pack --dry-run | head -30

# 2. Inspect what PyPI will ship
cd python && python -m build && tar -tzf dist/*.tar.gz | head -20 && unzip -l dist/*.whl

# 3. Search the repo for accidentally-committed secrets
grep -rIE 'cz_(live|test)_[a-zA-Z0-9_-]+' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist
grep -rIE 'eyJ[a-zA-Z0-9_-]{40,}' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist  # JWT-shaped strings
grep -rIE 'sk_[a-z]+_[A-Za-z0-9]{20,}' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist  # Stripe-style keys
grep -rIE 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist  # GitHub PATs

# 4. Run the workflow file linter
gh workflow view publish.yml --repo iitian-vibes/crayonz-sdks
```

All four should produce no surprising results.

---

## What an attacker could try (and why it doesn't work)

### Attack 1: Steal a token from this repo

There's nothing to steal. `gh secret list --repo iitian-vibes/crayonz-sdks` returns empty.

### Attack 2: Open a PR that adds malicious code, then merge it

Possible only if they have write access. Mitigated by:
- GitHub branch protection on `main` (see "Recommended hardening" below — set it up if not already)
- Required PR review from a CODEOWNER
- Two-person rule for any change that touches `.github/workflows/publish.yml` (workflow self-edits are high-blast-radius)

### Attack 3: Forge an OIDC token to trick npm

GitHub signs OIDC tokens with a private key the public can verify. Forging requires breaking GitHub's signing infra — not a realistic threat.

### Attack 4: Compromise an npm/PyPI maintainer account and disable Trusted Publishers

Possible but: (a) requires hijacking a maintainer's npm/PyPI account directly, (b) leaves a clear audit trail on both registries, (c) doesn't touch this repo at all. Mitigated by enabling 2FA on both `aivolvix` accounts (already done).

### Attack 5: Typosquat — publish `@crayonz-ai/sdk-utils`, `crayonz-sdk`, etc.

Real concern. Mitigated by:
- Reserving common typo variants on both registries (see "Recommended hardening")
- Linking from official docs at crayonz.ai to the canonical packages

---

## Recommended hardening (next steps)

These are not required to ship safely today, but each one tightens the security posture further. Pick whatever feels worth the effort.

### 1. Enable branch protection on `main` (5 min, high value)

```
Settings → Branches → Add rule
- Branch name pattern: main
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks before merging (once we add CI tests)
- ✅ Restrict who can push to matching branches → only "iitian-vibes/admins"
```

Without this, anyone with write access can push directly to `main`.

### 2. Tag protection (3 min)

```
Settings → Tags → New rule
- Tag pattern: v*.*.*
- Require approval from a maintainer to push the tag
```

Releases are tag-driven, so this gates releases behind approval.

### 3. Required CODEOWNERS for the workflow (3 min)

Create `.github/CODEOWNERS`:

```
.github/workflows/  @aivolvix
SECURITY.md         @aivolvix
typescript/package.json  @aivolvix
python/pyproject.toml    @aivolvix
```

Any PR touching these auto-requests review from the listed user(s).

### 4. Reserve typosquat package names (15 min, $0)

Publish empty stubs of common typo variants pointing to the canonical name:

| Squat candidate | Action |
|---|---|
| `@crayonz/sdk` (npm) | Once the bare `crayonz` user account is recovered, publish a deprecated stub re-exporting `@crayonz-ai/sdk` |
| `crayonz-ai` (PyPI) | Publish a single-line stub: `from crayonz import *` |
| `crayonz-sdk` (PyPI) | Same |
| `crayonzai` (PyPI) | Same |

Each costs nothing, prevents impersonation.

### 5. Dependabot for the build toolchain (5 min)

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/typescript"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/python"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

Auto-PRs to bump `tsup`, `hatchling`, `actions/setup-node`, etc.

### 6. CI tests on every PR (later, when tests exist)

Currently we have no test suite. When we add one, add a `test.yml` workflow that runs on `pull_request` to `main`.

### 7. Sign git tags (2 min, defense in depth)

```bash
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

So tags can be verified as coming from a specific human. npm's provenance covers the workflow run; signed tags cover the input commit.

### 8. Move to `api.crayonz.ai` gateway (longer term)

Eventually wrap the three Cloud Run services behind a single `api.crayonz.ai` domain. The SDK already supports `baseUrls` override; default-pointing it at the gateway makes service URL changes invisible to users and simplifies docs.

---

## Reporting a vulnerability

If you find a security issue with the SDK or this publishing setup:

- **Don't** open a public GitHub issue
- Email **support@crayonz.ai** with details + proof-of-concept
- Expect a response within 48 hours

---

## Audit history

| Date | Reviewer | Version | Notes |
|---|---|---|---|
| 2026-05-05 | initial setup | v0.1.5 | OIDC Trusted Publishing live on both registries; no repo secrets; provenance attestation enabled |
