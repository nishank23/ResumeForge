#!/usr/bin/env bash
# Build only on a disposable Linux amd64 CI runner, never on the showcase VM.
set -euo pipefail
: "${FORGE_PUBLIC_ORIGIN:?Set the public HTTPS origin}"
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]]
[[ "${GITHUB_ACTIONS:-}" == true ]]
test -f compose.cloud.yaml
test -f docker/compose.cloud.test.yaml
build=(docker build --platform linux/amd64 --build-arg "FORGE_PUBLIC_ORIGIN=$FORGE_PUBLIC_ORIGIN")
"${build[@]}" --target checks -t forge-studio:checks .
"${build[@]}" --target cloud-runtime -t forge-studio:cloud .
"${build[@]}" --target cloud-web -t forge-studio-web:cloud .

# A GitHub-hosted runner is disposable. This project name must never be the live one.
compose=(docker compose -p resumeforge-cloud-check -f compose.cloud.yaml -f docker/compose.cloud.test.yaml)
cleanup() { "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create resumeforge-cloud >/dev/null
"${compose[@]}" up -d --no-build --wait --wait-timeout 240 app web
"${compose[@]}" run --rm --no-deps test
