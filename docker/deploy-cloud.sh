#!/usr/bin/env bash
# Existing VM only. Credentials, Compose configuration and volumes stay on the VM.
set -Eeuo pipefail
umask 077

schema_fingerprint() {
  docker run --rm --network none --entrypoint sh "$1" -c \
    'cd /app && find packages/prisma-client/prisma -type f -exec sha256sum {} + && sha256sum scripts/runtime-roles.mjs docker/bootstrap.mjs docker/credentials.mjs' |
    LC_ALL=C sort | sha256sum | cut -d ' ' -f 1
}

deploy_release() {
  local bundle=$1 release_id=$2 system_root=${3:-}
  [[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || return 2
  [[ -d "$bundle" && ! -L "$bundle" ]] || return 2
  local config="$system_root/opt/resumeforge/compose.cloud.yaml"
  local provider="$system_root/etc/resumeforge/provider.env"
  local state="$system_root/var/lib/resumeforge"
  local backup="$system_root/usr/local/sbin/resumeforge-backup"
  test -f "$config" && test -f "$provider" && test -x "$backup"
  install -d -m 700 "$state"
  exec 9>"$state/deployment.lock"
  flock -n 9 || { echo 'Another VM deployment is running.' >&2; return 1; }
  export FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com
  local -a compose=(docker compose --env-file "$provider" -f "$config")
  local app_container web_container old_app old_web new_app new_web
  app_container=$("${compose[@]}" ps -q app)
  web_container=$("${compose[@]}" ps -q web)
  test -n "$app_container" && test -n "$web_container"
  old_app=$(docker inspect --format '{{.Image}}' "$app_container")
  old_web=$(docker inspect --format '{{.Image}}' "$web_container")
  local available bytes
  available=$(df -Pk "$state" | awk 'NR==2 {printf "%.0f\n", $4 * 1024}')
  bytes=$(wc -c < "$bundle/images.tar.gz")
  # Reserve space for extraction and backup; never prune existing user data/images.
  (( available > bytes * 4 + 1073741824 )) || { echo 'Insufficient disk space; release stopped before changes.' >&2; return 1; }
  (cd "$bundle" && sha256sum --check images.tar.gz.sha256)
  gzip -dc "$bundle/images.tar.gz" | docker load >/dev/null
  local app_tag="forge-studio:release-$release_id" web_tag="forge-studio-web:release-$release_id"
  for image in "$app_tag" "$web_tag"; do
    [[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")" == linux/amd64 ]]
  done
  new_app=$(docker image inspect --format '{{.Id}}' "$app_tag")
  new_web=$(docker image inspect --format '{{.Id}}' "$web_tag")
  # Consume only this run's verified transfer files, never images, backups or volumes.
  rm -- "$bundle/images.tar.gz" "$bundle/images.tar.gz.sha256"
  if [[ "$old_app" == "$new_app" && "$old_web" == "$new_web" ]]; then
    docker exec "$app_container" node docker/healthcheck.mjs
    curl --fail --silent --max-time 15 http://127.0.0.1:8080/api/v1/health >/dev/null
    echo 'Release already running and healthy.'
    return 0
  fi
  local old_schema new_schema
  old_schema=$(schema_fingerprint "$old_app") || return 1
  new_schema=$(schema_fingerprint "$app_tag") || return 1
  if [[ "$old_schema" != "$new_schema" ]]; then
    echo 'Schema or credential/bootstrap code changed. A reviewed migration release is required.' >&2
    return 1
  fi
  # This existing helper also restores the dump to a temporary verification database.
  "$backup"
  docker tag "$old_app" forge-studio:ci-rollback
  docker tag "$old_web" forge-studio-web:ci-rollback

  rollback() {
    local original_status=$?
    trap - ERR HUP INT TERM
    set +e
    echo 'Release failed; restoring the previous app and web images.' >&2
    docker tag "$old_app" forge-studio:cloud
    docker tag "$old_web" forge-studio-web:cloud
    local rollback_status=0
    "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 240 app || rollback_status=1
    "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 60 web || rollback_status=1
    curl --fail --silent --max-time 15 http://127.0.0.1:8080/api/v1/health >/dev/null || rollback_status=1
    if (( rollback_status == 0 )); then
      echo 'Previous release restored; database and credential volumes retained.' >&2
    else
      echo 'Rollback needs operator attention. Retained images and private backup remain available.' >&2
    fi
    (( original_status != 0 )) || original_status=1
    exit "$original_status"
  }
  trap rollback ERR HUP INT TERM
  docker tag "$app_tag" forge-studio:cloud
  docker tag "$web_tag" forge-studio-web:cloud
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 240 app
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 60 web
  curl --fail --silent --max-time 15 http://127.0.0.1:8080/api/v1/health >/dev/null
  trap - ERR HUP INT TERM
  printf '%s\n' "$release_id" > "$state/current-release.tmp"
  mv "$state/current-release.tmp" "$state/current-release"
  echo "Release $release_id is healthy. Previous images remain tagged ci-rollback."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  [[ "$EUID" == 0 && "$#" == 2 ]] || { echo 'Usage: sudo bash deploy-cloud.sh BUNDLE_DIRECTORY RELEASE_ID' >&2; exit 2; }
  deploy_release "$1" "$2"
fi
