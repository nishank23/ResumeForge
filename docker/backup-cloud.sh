#!/usr/bin/env bash
# Manual, private backup for the owned showcase VM. Run when no edits are in flight.
set -euo pipefail
umask 077
if [[ "$EUID" -ne 0 ]]; then
  printf 'Run this backup with sudo on the showcase VM.\n' >&2
  exit 1
fi
compose=(docker compose --env-file /etc/resumeforge/provider.env -f /opt/resumeforge/compose.cloud.yaml)
install -d -m 700 /var/backups/resumeforge
stage=$(mktemp -d /var/backups/resumeforge/.backup-XXXXXXXX)
restore_database="resumeforge_restore_verify_${BASHPID}"
restore_created=false
database() {
  "${compose[@]}" exec -T database sh -c 'export PGPASSWORD="$(cat "$POSTGRES_PASSWORD_FILE")"; exec "$@"' sh "$@"
}
cleanup() {
  if [[ "$restore_created" == true ]]; then
    database dropdb -h 127.0.0.1 -U resume_forge "$restore_database" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$stage"
}
trap cleanup EXIT
database pg_dump -h 127.0.0.1 -U resume_forge -d resume_forge_dev -Fc > "$stage/database.dump"
for service in database app; do
  container=$("${compose[@]}" ps -q "$service")
  if [[ "$service" == database ]]; then
    destination=/run/forge-admin
    filename=admin-credentials.tar.gz
  else
    destination=/app/.local
    filename=runtime-credentials.tar.gz
  fi
  volume=$(docker inspect --format "{{range .Mounts}}{{if eq .Destination \"$destination\"}}{{.Name}}{{end}}{{end}}" "$container")
  [[ -n "$volume" ]]
  docker run --rm --network none --user 0:0 --read-only --cap-drop ALL --cap-add DAC_OVERRIDE --security-opt no-new-privileges:true --mount "type=volume,source=$volume,target=/credentials,readonly" forge-studio:cloud tar -C /credentials -czf - . > "$stage/$filename"
done
install -m 600 /etc/resumeforge/provider.env "$stage/provider.env"
install -m 600 /opt/resumeforge/compose.cloud.yaml "$stage/compose.cloud.yaml"
database createdb -h 127.0.0.1 -U resume_forge "$restore_database"
restore_created=true
database pg_restore -h 127.0.0.1 -U resume_forge -d "$restore_database" --exit-on-error < "$stage/database.dump"
counts='SELECT count(*) FROM "_prisma_migrations"; SELECT count(*) FROM "User"; SELECT count(*) FROM "Resume"; SELECT count(*) FROM "ResumeVersion"; SELECT extversion FROM pg_extension WHERE extname = '\''vector'\'';'
source_counts=$(database psql -h 127.0.0.1 -U resume_forge -d resume_forge_dev -At -v ON_ERROR_STOP=1 -c "$counts")
restored_counts=$(database psql -h 127.0.0.1 -U resume_forge -d "$restore_database" -At -v ON_ERROR_STOP=1 -c "$counts")
if [[ "$source_counts" != "$restored_counts" ]]; then
  printf 'Backup verification differed. Run again when no edits are in flight.\n' >&2
  exit 1
fi
printf 'Restore verified: migration, user, resume, version counts and pgvector match.\n%s\n' "$restored_counts" > "$stage/verification.txt"
archive_name="resumeforge-$(date -u +%Y%m%dT%H%M%SZ)-${BASHPID}.tar.gz"
archive="/var/backups/resumeforge/$archive_name"
tar -C "$stage" -czf "$archive" .
chmod 600 "$archive"
(cd /var/backups/resumeforge && sha256sum "$archive_name") > "$archive.sha256"
printf 'Private backup created and restored successfully: %s\n' "$archive"
