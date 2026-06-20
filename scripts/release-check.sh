#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="${TMPDIR:-/tmp}/pi-tasks-release-check"
NPM_CACHE="${TMP_ROOT}/npm-cache"
PACK_DIR="${TMP_ROOT}/pack"
CONSUMER_DIR="${TMP_ROOT}/consumer"

cd "${ROOT_DIR}"

rm -rf "${TMP_ROOT}"
mkdir -p "${NPM_CACHE}" "${PACK_DIR}" "${CONSUMER_DIR}"

echo "==> typecheck"
npm run typecheck

echo "==> check"
npm run check

echo "==> unit tests"
npm test

echo "==> build"
npm run build

echo "==> source import smoke"
node --experimental-strip-types -e "import('./index.ts')"

echo "==> dist import smoke"
node -e "import('./dist/index.js')"

echo "==> npm pack dry run"
env npm_config_cache="${NPM_CACHE}" npm pack --dry-run

echo "==> tarball install smoke"
env npm_config_cache="${NPM_CACHE}" npm pack --pack-destination "${PACK_DIR}"
TARBALL="$(find "${PACK_DIR}" -maxdepth 1 -name 'pi-tasks-*.tgz' -print -quit)"
if [[ -z "${TARBALL}" ]]; then
	echo "No package tarball was created" >&2
	exit 1
fi

(
	cd "${CONSUMER_DIR}"
	npm init -y >/dev/null
	env npm_config_cache="${NPM_CACHE}" npm install "${TARBALL}" >/dev/null
	node -e "import('pi-tasks')"
)

echo "==> audit"
env npm_config_cache="${NPM_CACHE}" npm audit --audit-level=low

echo "Release check passed"
