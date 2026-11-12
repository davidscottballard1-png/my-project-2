#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# REELVAULT_AUTO_UPDATE_SCRIPT
# Zero-Secret Pull-Based Auto-Updater for ReelVault Cloud Bridge & Plex Stack
# ==============================================================================

INSTALL_DIR="${INSTALL_DIR:-/opt/reelvault-server}"
RAW_BASE="${RAW_BASE:-https://raw.githubusercontent.com/davidscottballard1-png/my-project-2/main/server}"
LOCK_FILE="${LOCK_FILE:-/tmp/reelvault-auto-update.lock}"
HEALTH_RETRIES="${HEALTH_RETRIES:-15}"
HEALTH_SLEEP_SEC="${HEALTH_SLEEP_SEC:-1}"

log() {
  echo "[reelvault-auto-update] $*"
}

install_auto_updater() {
  if [ "${SKIP_ROOT_CHECK:-0}" != "1" ] && [ "$(id -u)" -ne 0 ]; then
    echo "Please run as root (e.g. curl -fsSL ${RAW_BASE}/auto-update.sh | sudo bash -s -- --install)"
    exit 1
  fi

  mkdir -p "${INSTALL_DIR}"
  local target_script="${INSTALL_DIR}/auto-update.sh"
  local tmp_self
  tmp_self="$(mktemp)"

  if [ -f "$0" ] && grep -q "REELVAULT_AUTO_UPDATE_SCRIPT" "$0" 2>/dev/null; then
    cp "$0" "$tmp_self"
  else
    curl -fsSL --max-time 15 "${RAW_BASE}/auto-update.sh?cb=$(date +%s)" -o "$tmp_self"
  fi

  if ! grep -q "REELVAULT_AUTO_UPDATE_SCRIPT" "$tmp_self" 2>/dev/null; then
    rm -f "$tmp_self"
    echo "Failed to verify auto-update.sh payload."
    exit 1
  fi

  chmod 755 "$tmp_self"
  mv "$tmp_self" "$target_script"

  if [ "${SKIP_SYSTEMD_INSTALL:-0}" = "1" ]; then
    log "Installed ${target_script} (systemd skipped)."
    return 0
  fi

  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    cat > /etc/systemd/system/reelvault-auto-update.service <<EOF
[Unit]
Description=ReelVault Cloud Bridge Auto-Updater
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
ExecStart=${target_script}
EOF

    cat > /etc/systemd/system/reelvault-auto-update.timer <<EOF
[Unit]
Description=Check GitHub main for ReelVault Server updates every 2 minutes

[Timer]
OnBootSec=90s
OnUnitActiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable --now reelvault-auto-update.timer >/dev/null
    log "Enabled systemd timer (reelvault-auto-update.timer — checks every 2 minutes)."
  else
    mkdir -p /etc/cron.d
    cat > /etc/cron.d/reelvault-auto-update <<EOF
*/2 * * * * root ${target_script} >> /var/log/reelvault-auto-update.log 2>&1
EOF
    chmod 644 /etc/cron.d/reelvault-auto-update
    log "Installed cron job (/etc/cron.d/reelvault-auto-update — checks every 2 minutes)."
  fi

  # Run an immediate sync so the server updates to latest right away
  if [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
    "${target_script}" --force-check || true
  fi

  echo ""
  echo "✅ ReelVault Auto-Updater is active! Your VPS will automatically pull & rebuild server updates pushed to GitHub main."
}

if [ "${1:-}" = "--install" ]; then
  install_auto_updater
  exit 0
fi

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    exit 0
  fi
fi

if [ ! -d "${INSTALL_DIR}" ] || [ ! -f "${INSTALL_DIR}/docker-compose.yml" ]; then
  exit 0
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

CB="$(date +%s)"
TRACKED_FILES=("bridge.js" "Dockerfile" "Caddyfile" "docker-compose.yml")

for f in "${TRACKED_FILES[@]}"; do
  if ! curl -fsSL --max-time 20 "${RAW_BASE}/${f}?cb=${CB}" -o "${TMP_DIR}/${f}" 2>/dev/null; then
    exit 0
  fi
  if [ ! -s "${TMP_DIR}/${f}" ]; then
    exit 0
  fi
done

# Sanity-check downloaded file markers so captive/error HTML never overwrites live config
grep -q "createBridgeServer" "${TMP_DIR}/bridge.js" || exit 0
grep -q "REELVAULT_API_KEY" "${TMP_DIR}/bridge.js" || exit 0
grep -q "^FROM node:" "${TMP_DIR}/Dockerfile" || exit 0
grep -q "reverse_proxy" "${TMP_DIR}/Caddyfile" || exit 0
grep -q "reelvault-bridge:" "${TMP_DIR}/docker-compose.yml" || exit 0

sha_of() {
  if [ ! -f "$1" ]; then
    echo "missing"
    return
  fi
  sha256sum "$1" | awk '{print $1}'
}

CHANGED_ANY="0"
STACK_CHANGED="0"

for f in "${TRACKED_FILES[@]}"; do
  old_sha="$(sha_of "${INSTALL_DIR}/${f}")"
  new_sha="$(sha_of "${TMP_DIR}/${f}")"
  if [ "$old_sha" != "$new_sha" ]; then
    CHANGED_ANY="1"
    if [ "$f" = "Caddyfile" ] || [ "$f" = "docker-compose.yml" ]; then
      STACK_CHANGED="1"
    fi
  fi
done

# Self-update auto-update.sh quietly if changed
if curl -fsSL --max-time 15 "${RAW_BASE}/auto-update.sh?cb=${CB}" -o "${TMP_DIR}/auto-update.sh" 2>/dev/null; then
  if grep -q "REELVAULT_AUTO_UPDATE_SCRIPT" "${TMP_DIR}/auto-update.sh" 2>/dev/null; then
    if [ "$(sha_of "${INSTALL_DIR}/auto-update.sh")" != "$(sha_of "${TMP_DIR}/auto-update.sh")" ]; then
      chmod 755 "${TMP_DIR}/auto-update.sh"
      cp "${TMP_DIR}/auto-update.sh" "${INSTALL_DIR}/auto-update.sh.next"
      mv "${INSTALL_DIR}/auto-update.sh.next" "${INSTALL_DIR}/auto-update.sh"
      log "Updated auto-update.sh script."
    fi
  fi
fi

if [ "$CHANGED_ANY" != "1" ]; then
  exit 0
fi

# Validate candidate bridge.js syntax before touching live files
if command -v node >/dev/null 2>&1; then
  if ! node --check "${TMP_DIR}/bridge.js" >/dev/null 2>&1; then
    log "Candidate bridge.js failed node --check; aborting update."
    exit 1
  fi
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'reelvault-bridge'; then
  if ! docker exec -i reelvault-bridge node --check - < "${TMP_DIR}/bridge.js" >/dev/null 2>&1; then
    log "Candidate bridge.js failed container node --check; aborting update."
    exit 1
  fi
fi

API_KEY=""
if [ -f "${INSTALL_DIR}/.env" ]; then
  API_KEY="$(grep -E '^REELVAULT_API_KEY=' "${INSTALL_DIR}/.env" | head -n1 | cut -d'=' -f2- || true)"
fi

probe_bridge_health() {
  if [ -n "$API_KEY" ]; then
    docker exec reelvault-bridge curl -fsS --max-time 5 -H "Authorization: Bearer ${API_KEY}" "http://127.0.0.1:8787/health${1:-}" 2>/dev/null || true
  else
    docker exec reelvault-bridge curl -fsS --max-time 5 "http://127.0.0.1:8787/health" 2>/dev/null || true
  fi
}

# Never interrupt an active Plex video download/transcode job
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'reelvault-bridge'; then
  LIVE_HEALTH="$(probe_bridge_health "")"
  if echo "$LIVE_HEALTH" | grep -qE '"activeJobs":[1-9][0-9]*'; then
    log "Deferring update because a Plex save job is currently active."
    exit 0
  fi
fi

log "Applying ReelVault server update from GitHub main..."
BACKUP_DIR="${TMP_DIR}/backup"
mkdir -p "${BACKUP_DIR}"
for f in "${TRACKED_FILES[@]}"; do
  if [ -f "${INSTALL_DIR}/${f}" ]; then
    cp "${INSTALL_DIR}/${f}" "${BACKUP_DIR}/${f}"
  fi
  cp "${TMP_DIR}/${f}" "${INSTALL_DIR}/${f}.tmp"
  mv "${INSTALL_DIR}/${f}.tmp" "${INSTALL_DIR}/${f}"
done

cd "${INSTALL_DIR}"

rebuild_target() {
  if [ "$STACK_CHANGED" = "1" ]; then
    docker compose up -d --build --remove-orphans
  else
    docker compose up -d --build reelvault-bridge
  fi
}

HEALTHY="0"
if rebuild_target; then
  for _ in $(seq 1 "${HEALTH_RETRIES}"); do
    POST_HEALTH="$(probe_bridge_health "?refreshPlex=1")"
    if echo "$POST_HEALTH" | grep -q '"service":"reelvault-bridge"'; then
      HEALTHY="1"
      break
    fi
    sleep "${HEALTH_SLEEP_SEC}"
  done
fi

if [ "$HEALTHY" != "1" ]; then
  log "Post-update health check failed; rolling back to previous known-good files."
  for f in "${TRACKED_FILES[@]}"; do
    if [ -f "${BACKUP_DIR}/${f}" ]; then
      cp "${BACKUP_DIR}/${f}" "${INSTALL_DIR}/${f}.tmp"
      mv "${INSTALL_DIR}/${f}.tmp" "${INSTALL_DIR}/${f}"
    fi
  done
  rebuild_target || true
  exit 1
fi

log "Update complete and verified healthy."
