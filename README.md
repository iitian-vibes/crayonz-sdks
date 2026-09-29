# Crayonz SDKs

Official client libraries for the [Crayonz AI](https://crayonz.ai) API.

| Language | Package | Install |
|---|---|---|
| TypeScript / JavaScript | [`@crayonz-ai/sdk`](https://www.npmjs.com/package/@crayonz-ai/sdk) | `npm install @crayonz-ai/sdk` |
| Python | [`crayonz`](https://pypi.org/project/crayonz/) | `pip install crayonz` |

Both SDKs cover the full public Crayonz API (`api.crayonz.ai`): print-ready AI design generation, garment mockups, model/product photoshoots, and virtual try-on. See the live reference at https://crayonz.ai/api/docs.

## TypeScript

```ts
import { Crayonz } from '@crayonz-ai/sdk';

const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY });
const design = await client.designs.createAndWait({ idea: 'Retro skate shop logo' });
const mockup = await client.mockups.render({ design_url: design.file_url, garment: 'tshirt' });
```

Full docs: [`typescript/README.md`](./typescript/README.md)

## Python

```python
from crayonz import Client

client = Client(api_key="cz_live_...")
design = client.designs.create_and_wait(idea="Retro skate shop logo")
mockup = client.mockups.render(design_url=design["file_url"], garment="tshirt")
```

Full docs: [`python/README.md`](./python/README.md)

---

## Releasing a new version

Both packages are published to npm and PyPI **automatically via OIDC Trusted Publishing** when you push a `v*.*.*` git tag. Zero secrets, no OTP. Workflow: [`.github/workflows/publish.yml`](.github/workflows/publish.yml).

### Quick path (one command)

```bash
./scripts/bump.sh patch    # 0.1.5 → 0.1.6
./scripts/bump.sh minor    # 0.1.5 → 0.2.0
./scripts/bump.sh major    # 0.1.5 → 1.0.0
```

The script bumps all four version files, commits, tags, and pushes. Both packages go live in ~30 seconds.

### Manual path

If you'd rather edit by hand, **bump these four files together** so npm and PyPI stay in lockstep:

| File | Field |
|---|---|
| `typescript/package.json` | `"version": "X.Y.Z"` |
| `python/pyproject.toml` | `version = "X.Y.Z"` |
| `python/src/crayonz/__init__.py` | `__version__ = "X.Y.Z"` |
| `python/src/crayonz/_client.py` | `VERSION = "X.Y.Z"` |
| `typescript/src/client.ts` | `VERSION = 'X.Y.Z'` |

Then:

```bash
git add -A
git commit -m "chore: bump SDKs to vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

### What happens behind the scenes

1. Tag push triggers `.github/workflows/publish.yml`.
2. Two parallel jobs run:
   - **`Publish @crayonz-ai/sdk`** — Node 24 / npm 11+, builds with `tsup`, then `npm publish --access public`. OIDC token from GitHub auths to npm.
   - **`Publish crayonz`** — Python 3.12, `python -m build`, then `pypa/gh-action-pypi-publish` uploads via OIDC.
3. Both registries verify the OIDC subject matches their **Trusted Publisher** config.
4. Packages live within ~30s. npm gets a sigstore provenance attestation linking the tarball to this exact GitHub Actions run.

### Verifying a release

```bash
# npm
curl -s https://registry.npmjs.org/@crayonz-ai%2Fsdk/latest | jq '.version'
# PyPI
curl -s https://pypi.org/pypi/crayonz/json | jq -r '.info.version'
# Or watch the run live
gh run watch --repo iitian-vibes/crayonz-sdks
```

### If a publish fails

| Symptom | Cause | Fix |
|---|---|---|
| `EOTP` (npm) | A token was found in env, overriding OIDC | Don't set `NODE_AUTH_TOKEN`; ensure no `NPM_TOKEN` repo secret exists |
| `404 Not Found - PUT registry.npmjs.org` | Old npm version (10.x) signs provenance via OIDC but doesn't auth via OIDC | Use `node-version: '24'` (npm 11+) — already configured |
| `403 Forbidden` (npm) | Trusted Publisher config doesn't match this workflow | Check `iitian-vibes/crayonz-sdks` + `publish.yml` (no `.github/workflows/` prefix) at npmjs.com/package/@crayonz-ai/sdk/access |
| `400` on PyPI with "trusted publisher" message | Trusted Publisher not configured for this project/workflow | Check pypi.org/manage/project/crayonz/settings/publishing |
| Job runs but neither package updates | Both Trusted Publishers need re-verification | Re-add publishers on npm + PyPI; cache propagation can take ~5 min |

### Pre-release checklist (paste into PR description)

- [ ] All five version files bumped to the same number
- [ ] Bumped version is **higher** than `crayonz` on PyPI and `@crayonz-ai/sdk` on npm — neither registry allows re-publishing the same version
- [ ] `CHANGELOG.md` has an entry for the new version
- [ ] If you added a new endpoint: `typescript/src/types.ts` + `typescript/src/resources/*.ts` + `python/src/crayonz/resources/*.py` all updated, plus a test for it in both languages
- [ ] Local smoke test passes: `cd typescript && npm install && npm run build && npm run typecheck`
- [ ] Local smoke test passes: `cd python && python -m build && twine check dist/*`

---

## Security model

See [`SECURITY.md`](./SECURITY.md) for the full audit. Short version:

- **No secrets in this repo.** Both registries authenticate via short-lived OIDC tokens issued by GitHub during the workflow run. No `NPM_TOKEN` or `PYPI_TOKEN` to steal.
- **Public source** — anyone can read the SDK code; that's normal for client libraries. The SDK only contains client-side request shaping; no backend logic, no API keys, no credentials.
- **Provenance** — every npm release has a sigstore attestation pinning the tarball to this exact workflow run, so users can verify a package wasn't tampered with after publish.

## License

MIT
