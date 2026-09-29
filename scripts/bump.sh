#!/usr/bin/env bash
# Bump the SDK version across all five files, commit, tag, and push.
#
# Usage:
#   ./scripts/bump.sh patch    # 0.1.5 → 0.1.6
#   ./scripts/bump.sh minor    # 0.1.5 → 0.2.0
#   ./scripts/bump.sh major    # 0.1.5 → 1.0.0
#   ./scripts/bump.sh 0.2.3    # explicit version
#
# After this script finishes, the GitHub Actions workflow will publish
# both packages via OIDC Trusted Publishing within ~30 seconds.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <patch|minor|major|X.Y.Z>" >&2
  exit 1
fi

# ─── Read current version ────────────────────────────────────────
current=$(grep '"version"' typescript/package.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')

if [[ -z "$current" ]]; then
  echo "could not read current version from typescript/package.json" >&2
  exit 1
fi

# ─── Compute new version ─────────────────────────────────────────
arg="$1"
if [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  new="$arg"
else
  IFS='.' read -r major minor patch <<<"$current"
  case "$arg" in
    patch) new="$major.$minor.$((patch + 1))" ;;
    minor) new="$major.$((minor + 1)).0" ;;
    major) new="$((major + 1)).0.0" ;;
    *)
      echo "invalid argument: $arg (expected patch|minor|major|X.Y.Z)" >&2
      exit 1
      ;;
  esac
fi

echo "Bumping $current → $new"

# ─── Sanity guard: registries don't allow re-publishing ──────────
if git tag --list | grep -q "^v$new$"; then
  echo "ERROR: tag v$new already exists. Pick a higher version." >&2
  exit 1
fi

# ─── Sanity guard: working tree clean ────────────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree has uncommitted changes. Commit or stash first." >&2
  git status --short
  exit 1
fi

# ─── Apply the bump (sed is BSD-style on macOS, GNU on Linux) ────
if [[ "$(uname)" == "Darwin" ]]; then
  SED_INPLACE=(-i '')
else
  SED_INPLACE=(-i)
fi

sed "${SED_INPLACE[@]}" "s/\"version\": \"$current\"/\"version\": \"$new\"/" typescript/package.json
sed "${SED_INPLACE[@]}" "s/version = \"$current\"/version = \"$new\"/" python/pyproject.toml
sed "${SED_INPLACE[@]}" "s/__version__ = \"$current\"/__version__ = \"$new\"/" python/src/crayonz/__init__.py
sed "${SED_INPLACE[@]}" "s/VERSION = \"$current\"/VERSION = \"$new\"/" python/src/crayonz/_client.py
sed "${SED_INPLACE[@]}" "s/VERSION = '$current'/VERSION = '$new'/" typescript/src/client.ts

# ─── Verify all five files updated ───────────────────────────────
echo "--- Verification ---"
grep '"version"' typescript/package.json | head -1
grep '^version' python/pyproject.toml | head -1
grep '__version__' python/src/crayonz/__init__.py
grep '^VERSION' python/src/crayonz/_client.py
grep '^const VERSION' typescript/src/client.ts

if ! grep -q "\"version\": \"$new\"" typescript/package.json; then
  echo "ERROR: typescript/package.json was not updated" >&2
  exit 1
fi

# ─── Remind about CHANGELOG ──────────────────────────────────────
echo ""
echo "==> Update CHANGELOG.md with notes for v$new before continuing."
echo "    (Add a new heading: ## [$new] — $(date +%Y-%m-%d))"
echo ""
read -r -p "Press Enter once CHANGELOG.md is updated, or Ctrl-C to abort: " _

# ─── Commit, tag, push ───────────────────────────────────────────
git add -A
git commit -m "chore: release v$new"
git tag -a "v$new" -m "Release v$new"
git push origin main
git push origin "v$new"

echo ""
echo "==> Pushed v$new. Workflow should publish both packages within ~30s."
echo "    Watch: gh run watch --repo iitian-vibes/crayonz-sdks"
echo "    Verify:"
echo "      curl -s https://registry.npmjs.org/@crayonz-ai%2Fsdk/latest | jq .version"
echo "      curl -s https://pypi.org/pypi/crayonz/json | jq -r .info.version"
