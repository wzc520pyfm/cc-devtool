#!/usr/bin/env bash
set -euo pipefail

# Bump version across all project manifests and optionally create a git tag.
#
# Usage:
#   ./scripts/bump-version.sh 0.2.0
#   ./scripts/bump-version.sh 0.2.0 --tag   # also creates git tag v0.2.0

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version> [--tag]"
  echo "  e.g. $0 0.2.0"
  echo "  e.g. $0 0.2.0 --tag"
  exit 1
fi

VERSION="$1"
CREATE_TAG="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Validate semver (basic check)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: '$VERSION' is not a valid semver version"
  exit 1
fi

echo "Bumping version to $VERSION ..."

# 1. package.json
node -e "
  const fs = require('fs');
  const path = '$ROOT/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"
echo "  Updated package.json"

# 2. src-tauri/tauri.conf.json
node -e "
  const fs = require('fs');
  const path = '$ROOT/src-tauri/tauri.conf.json';
  const conf = JSON.parse(fs.readFileSync(path, 'utf8'));
  conf.version = '$VERSION';
  fs.writeFileSync(path, JSON.stringify(conf, null, 2) + '\n');
"
echo "  Updated src-tauri/tauri.conf.json"

# 3. src-tauri/Cargo.toml
if [ -f "$ROOT/src-tauri/Cargo.toml" ]; then
  sed -i.bak -E "s/^version = \"[^\"]+\"/version = \"$VERSION\"/" "$ROOT/src-tauri/Cargo.toml"
  rm -f "$ROOT/src-tauri/Cargo.toml.bak"
  echo "  Updated src-tauri/Cargo.toml"
fi

# 4. cli/index.ts (.version() call)
if [ -f "$ROOT/cli/index.ts" ]; then
  sed -i.bak -E "s/\.version\('[^']+'\)/.version('$VERSION')/" "$ROOT/cli/index.ts"
  rm -f "$ROOT/cli/index.ts.bak"
  echo "  Updated cli/index.ts"
fi

echo ""
echo "Version bumped to $VERSION across all manifests."

# Optionally create git tag
if [ "$CREATE_TAG" = "--tag" ]; then
  echo ""
  echo "Creating git tag v$VERSION ..."
  cd "$ROOT"
  git add -A
  git commit -m "chore: bump version to $VERSION" || echo "  (nothing to commit)"
  git tag "v$VERSION"
  echo "  Tag v$VERSION created. Push with: git push && git push --tags"
fi
