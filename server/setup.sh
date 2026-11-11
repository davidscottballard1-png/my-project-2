#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ReelVault + Plex Cloud Vault — 1-Command Contabo Ubuntu/Debian Installer
# ==============================================================================

INSTALL_DIR="/opt/reelvault-server"
RAW_BASE="https://raw.githubusercontent.com/davidscottballard1-png/my-project-2/main/server"

echo ""
echo "============================================================"
echo "  🎬 ReelVault + Plex Cloud Vault Installer"
echo "============================================================"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (e.g. sudo bash setup.sh)"
  exit 1
fi

echo "[1/6] Checking system packages & Docker..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl openssl >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  echo "      Installing Docker Engine (takes ~45 seconds)..."
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker >/dev/null 2>&1 || true
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "      Opening ports 80, 443, and 32400 in UFW firewall..."
  ufw allow 22/tcp >/dev/null || true
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  ufw allow 443/udp >/dev/null || true
  ufw allow 32400/tcp >/dev/null || true
fi

if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  echo "      Opening ports 80, 443, and 32400 in firewalld..."
  firewall-cmd --permanent --add-port=80/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port=443/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port=443/udp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port=32400/tcp >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

echo "[2/6] Detecting server public IPv4 address..."
VPS_IP="${VPS_IP:-}"
if [ -z "$VPS_IP" ]; then
  VPS_IP="$(curl -4 -fsSL https://api.ipify.org || curl -4 -fsSL https://ifconfig.me || hostname -I | awk '{print $1}')"
fi
VPS_IP="$(echo "$VPS_IP" | tr -d '[:space:]')"
DASHED_IP="${VPS_IP//./-}"
echo "      Detected Server IP: ${VPS_IP}"

mkdir -p "${INSTALL_DIR}/media/safe" "${INSTALL_DIR}/media/vault-18" "${INSTALL_DIR}/plex-config"
cd "${INSTALL_DIR}"

# Load previous .env values if re-running setup.sh
HAS_EXISTING_ENV="0"
EXISTING_API_KEY=""
EXISTING_PROXY_URL=""
EXISTING_BRIDGE_DOMAIN=""
if [ -f "${INSTALL_DIR}/.env" ]; then
  HAS_EXISTING_ENV="1"
  EXISTING_API_KEY="$(grep -E '^REELVAULT_API_KEY=' "${INSTALL_DIR}/.env" | head -n1 | cut -d'=' -f2- || true)"
  EXISTING_PROXY_URL="$(grep -E '^RESIDENTIAL_PROXY_URL=' "${INSTALL_DIR}/.env" | head -n1 | cut -d'=' -f2- || true)"
  EXISTING_BRIDGE_DOMAIN="$(grep -E '^BRIDGE_DOMAIN=' "${INSTALL_DIR}/.env" | head -n1 | cut -d'=' -f2- || true)"
fi

DEFAULT_DOMAIN="${BRIDGE_DOMAIN:-${EXISTING_BRIDGE_DOMAIN:-${DASHED_IP}.nip.io}}"

PLEX_PREFS_FILE="${INSTALL_DIR}/plex-config/Library/Application Support/Plex Media Server/Preferences.xml"
PLEX_TOKEN_ALREADY=""
if [ -f "$PLEX_PREFS_FILE" ]; then
  PLEX_TOKEN_ALREADY="$(grep -oE 'PlexOnlineToken="[^"]+"' "$PLEX_PREFS_FILE" | cut -d'"' -f2 || true)"
fi

echo ""
echo "[3/6] Quick Configuration"
echo "------------------------------------------------------------"

PLEX_CLAIM_INPUT="${PLEX_CLAIM:-}"
if [ -z "$PLEX_CLAIM_INPUT" ] && [ -z "$PLEX_TOKEN_ALREADY" ] && [ -e /dev/tty ]; then
  echo "👉 STEP A — Link Your Plex Pass Account:"
  echo "   Open https://www.plex.tv/claim in Safari, copy the 'claim-...' code,"
  echo "   and paste it below within 4 minutes (or press Enter to skip for now):"
  read -r -p "   Plex Claim Code: " PLEX_CLAIM_INPUT </dev/tty || true
  echo ""
elif [ -n "$PLEX_TOKEN_ALREADY" ]; then
  echo "   ✓ Plex server is already claimed to your Plex account."
fi

PROXY_INPUT="${RESIDENTIAL_PROXY_URL:-$EXISTING_PROXY_URL}"
if [ -z "${RESIDENTIAL_PROXY_URL:-}" ] && [ -e /dev/tty ] && { [ "$HAS_EXISTING_ENV" != "1" ] || [ "${RECONFIGURE:-0}" = "1" ]; }; then
  echo "👉 STEP B — Webshare US Residential Proxy (Optional Turbocharger):"
  if [ -n "$EXISTING_PROXY_URL" ]; then
    echo "   Press Enter to keep your saved Webshare proxy, or paste a new one:"
  else
    echo "   Paste your Webshare URL (http://USER-US-rotate:PASS@p.webshare.io:80)"
    echo "   or press Enter to skip:"
  fi
  read -r -p "   Webshare Proxy URL: " NEW_PROXY_INPUT </dev/tty || true
  if [ -n "$NEW_PROXY_INPUT" ]; then
    PROXY_INPUT="$NEW_PROXY_INPUT"
  fi
  echo ""
elif [ -n "$PROXY_INPUT" ]; then
  echo "   ✓ Keeping your saved Webshare US Residential Proxy."
else
  echo "   ✓ Keeping existing proxy setting (run RECONFIGURE=1 bash setup.sh to change)."
fi

# Clean accidental 'curl --proxy' or surrounding quotes if user pasted the whole test line
PROXY_INPUT="$(echo "$PROXY_INPUT" | sed -E 's/^.*(https?:\/\/[^"'\''[:space:]]+@p\.webshare\.io:[0-9]+).*$/\1/' | tr -d '"' | tr -d "'")"

API_KEY="${REELVAULT_API_KEY:-$EXISTING_API_KEY}"
if [ -z "$API_KEY" ]; then
  API_KEY="rv_$(openssl rand -hex 16)"
fi

echo ""
echo "[4/6] Downloading ReelVault Cloud Bridge & Plex stack..."
curl -fsSL "${RAW_BASE}/Dockerfile" -o "${INSTALL_DIR}/Dockerfile"
curl -fsSL "${RAW_BASE}/bridge.js" -o "${INSTALL_DIR}/bridge.js"
curl -fsSL "${RAW_BASE}/Caddyfile" -o "${INSTALL_DIR}/Caddyfile"
curl -fsSL "${RAW_BASE}/docker-compose.yml" -o "${INSTALL_DIR}/docker-compose.yml"

write_env_file() {
  local domain_val="$1"
  local plex_domain_val="$2"
  cat > "${INSTALL_DIR}/.env" <<EOF
VPS_IP=${VPS_IP}
BRIDGE_DOMAIN=${domain_val}
PLEX_DOMAIN=${plex_domain_val}
REELVAULT_API_KEY=${API_KEY}
PLEX_CLAIM=${PLEX_CLAIM_INPUT}
RESIDENTIAL_PROXY_URL=${PROXY_INPUT}
TZ=America/New_York
EOF
  chmod 600 "${INSTALL_DIR}/.env"
}

ACTIVE_DOMAIN="${DEFAULT_DOMAIN}"
ACTIVE_PLEX_DOMAIN="${PLEX_DOMAIN:-plex-${ACTIVE_DOMAIN}}"
write_env_file "${ACTIVE_DOMAIN}" "${ACTIVE_PLEX_DOMAIN}"

echo "[5/6] Starting Plex (Host Network) + ReelVault Bridge + HTTPS..."
# Gracefully stop any old bridge-networked Plex container so Preferences.xml flushes cleanly and port 32400 is free
if docker ps -a --format '{{.Names}}' | grep -qx 'reelvault-plex'; then
  docker stop -t 15 reelvault-plex >/dev/null 2>&1 || true
  docker rm -f reelvault-plex >/dev/null 2>&1 || true
fi
docker compose up -d --build --remove-orphans

echo "[6/6] Provisioning HTTPS certificates & syncing Plex Remote Access..."
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 "http://127.0.0.1:32400/identity" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

HTTPS_OK="0"
for _ in $(seq 1 22); do
  if curl -fsS --max-time 4 "https://${ACTIVE_DOMAIN}/health" >/dev/null 2>&1 && \
     curl -fsS --max-time 4 "https://${ACTIVE_PLEX_DOMAIN}/identity" >/dev/null 2>&1; then
    HTTPS_OK="1"
    break
  fi
  sleep 2
done

if [ "$HTTPS_OK" != "1" ] && [ "${ACTIVE_DOMAIN}" = "${DASHED_IP}.nip.io" ]; then
  echo "      nip.io certificate busy; switching to fallback ${DASHED_IP}.sslip.io..."
  ACTIVE_DOMAIN="${DASHED_IP}.sslip.io"
  ACTIVE_PLEX_DOMAIN="${PLEX_DOMAIN:-plex-${ACTIVE_DOMAIN}}"
  write_env_file "${ACTIVE_DOMAIN}" "${ACTIVE_PLEX_DOMAIN}"
  docker compose up -d
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 4 "https://${ACTIVE_DOMAIN}/health" >/dev/null 2>&1 && \
       curl -fsS --max-time 4 "https://${ACTIVE_PLEX_DOMAIN}/identity" >/dev/null 2>&1; then
      HTTPS_OK="1"
      break
    fi
    sleep 2
  done
fi

sync_plex_bridge() {
  curl -fsS --max-time 8 -H "Authorization: Bearer ${API_KEY}" "https://${ACTIVE_DOMAIN}/health?refreshPlex=1" 2>/dev/null || \
    docker exec reelvault-bridge curl -fsS --max-time 8 -H "Authorization: Bearer ${API_KEY}" "http://127.0.0.1:8787/health?refreshPlex=1" 2>/dev/null || \
    true
}

# Sync Plex FriendlyName ("ReelVault Cloud"), Remote Access, HTTPS customConnections, and libraries
HEALTH_JSON=""
for _ in $(seq 1 8); do
  HEALTH_JSON="$(sync_plex_bridge)"
  if echo "$HEALTH_JSON" | grep -q '"reachable":true'; then
    break
  fi
  sleep 2
done

# If Plex preferences were newly updated (e.g. migrating from bridge container ID to ReelVault Cloud),
# restart Plex once so all network bindings & customConnections reload cleanly, then push reachability to plex.tv
if echo "$HEALTH_JSON" | grep -q '"updatedPrefs":\["'; then
  echo "      Applying updated Plex Remote Access & HTTPS endpoints to plex.tv..."
  docker restart reelvault-plex >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do
    if curl -fsS --max-time 3 "http://127.0.0.1:32400/identity" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  sync_plex_bridge >/dev/null 2>&1 || true
fi

echo ""
echo "============================================================"
echo "  ✅ YOUR REELVAULT + PLEX CLOUD SERVER IS LIVE!"
echo "============================================================"
echo ""
echo "  📱 PASTE THESE TWO VALUES INTO REELVAULT"
echo "     (Sources Tab -> Cloud Server & Plex Vault):"
echo ""
echo "  1) Backend HTTPS URL:"
echo "     https://${ACTIVE_DOMAIN}"
echo ""
echo "  2) API Secret Key:"
echo "     ${API_KEY}"
echo ""
echo "------------------------------------------------------------"
echo "  🎬 OPEN YOUR PLEX SERVER (Named: ReelVault Cloud):"
echo "     • iPad / iPhone / Apple TV: Force-close & reopen the Plex app!"
echo "       (Your server now appears as 'ReelVault Cloud' & connects via HTTPS)"
echo "     • Plex Web (HTTPS): https://app.plex.tv"
echo "     • Direct HTTPS URL: https://${ACTIVE_PLEX_DOMAIN}/web"
echo "     • Two libraries auto-created:"
echo "         - ReelVault Clips (Safe videos)"
echo "         - ReelVault 18+ Vault (Hidden from global home dashboard)"
echo "============================================================"
echo ""
