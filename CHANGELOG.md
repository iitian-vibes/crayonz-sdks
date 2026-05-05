# Changelog

All notable changes to `@crayonz-ai/sdk` (npm) and `crayonz` (PyPI). Both packages are released in lockstep — the version below is the version on **both** registries.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.5] — 2026-05-05

### Added
- npm publish via OIDC Trusted Publishing — releases now require **zero secrets** on both npm and PyPI. (Workflow uses Node 24 / npm 11+ on the npm side.)
- `SECURITY.md` documenting the trust model, what's exposed, and recommended hardening.
- `scripts/bump.sh` helper for one-command releases.

### Changed
- Workflow upgraded from Node 20 (npm 10) to Node 24 (npm 11) — npm 10 signed provenance via OIDC but didn't auth the registry PUT via OIDC, causing 404. Fixed in npm 11.

## [0.1.0] — 2026-05-05

### Added
- Initial release of TypeScript SDK `@crayonz-ai/sdk` and Python SDK `crayonz`.
- Resources: `memes`, `content` (blog, post, reel, general), `design` (trends, generate, mockup, customize, score).
- `CrayonzError` typed error class on both languages.
- Cost-allocation tag support via `tag` constructor option (sends `X-Crayonz-Tag` header).
- `baseUrls` override option for self-hosted or staging deployments.
- TypeScript: dual ESM + CJS via tsup, full `.d.ts` types, Node 18+ native fetch, no runtime deps.
- Python: sync `httpx` client, context-manager support, Python 3.9+.

[Unreleased]: https://github.com/iitian-vibes/crayonz-sdks/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/iitian-vibes/crayonz-sdks/compare/v0.1.0...v0.1.5
[0.1.0]: https://github.com/iitian-vibes/crayonz-sdks/releases/tag/v0.1.0
