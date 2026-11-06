#!/usr/bin/env bash
# Get a release ready: one version everywhere, and CHANGELOG.md's "Unreleased" section dated as that
# version. It doesn't commit, tag or push. The steps after it are in docs/DOCUMENTATION.md §17:
# commit, merge to main, then push the tag (v1.2.3) and .github/workflows/release.yml takes over.
#
#   scripts/prepare-release.sh 1.2.3
#
# The version is MAJOR.MINOR.PATCH (semver): PATCH for fixes, MINOR for new features, MAJOR for changes
# people have to adapt to. The app's build number (after the + in pubspec.yaml) goes up by one every
# release, because the stores refuse a build number they've seen before.
set -euo pipefail
V=${1:?"usage: scripts/prepare-release.sh <major.minor.patch>"}
[[ $V =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "The version must look like 1.2.3" >&2; exit 1; }
cd "$(dirname "$0")/.."

# The Unreleased section must say what's in the release: it becomes the release notes.
awk '/^## Unreleased/ { f = 1; next } /^## / { f = 0 } f' CHANGELOG.md | grep -q '[^[:space:]]' \
  || { echo "CHANGELOG.md: write what's in this release under '## Unreleased' first" >&2; exit 1; }
! grep -q "^## $V " CHANGELOG.md || { echo "CHANGELOG.md already has $V" >&2; exit 1; }

BUILD=$(( $(sed -nE 's/^version: [^+]+\+([0-9]+)$/\1/p' app/pubspec.yaml) + 1 ))
sed -i -E "s/^version: .+$/version: $V+$BUILD/" app/pubspec.yaml
(cd backend && npm version "$V" --no-git-tag-version --allow-same-version >/dev/null)
(cd web && npm version "$V" --no-git-tag-version --allow-same-version >/dev/null)
sed -i "s/^## Unreleased.*/## Unreleased\n\n## $V ($(date +%F))/" CHANGELOG.md

echo "JamPacked $V (app build $BUILD) is ready. Next:"
echo "  git commit -am 'Release v$V'   then merge it to main, and on main:"
echo "  git tag v$V && git push origin v$V"
