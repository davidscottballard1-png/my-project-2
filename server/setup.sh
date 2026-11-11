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

echo "[2/6] Detecting server public IPv4 address..."
VPS_IP="${VPS_IP:-}"
if [ -z "$VPS_IP" ]; then
  VPS_IP="$(curl -4 -fsSL https://api.ipify.org || curl -4 -fsSL https://ifconfig.me || hostname -I | awk '{print $1}')"
fi
VPS_IP="$(echo "$VPS_IP" | tr -d '[:space:]')"
DASHED_IP="${VPS_IP//./-}"
DEFAULT_DOMAIN="${BRIDGE_DOMAIN:-${DASHED_IP}.nip.io}"
echo "      Detected Server IP: ${VPS_IP}"

mkdir -p "${INSTALL_DIR}/media/safe" "${INSTALL_DIR}/media/vault-18" "${INSTALL_DIR}/plex-config"
cd "${INSTALL_DIR}"

# Load previous .env values if re-running setup.sh
EXISTING_API_KEY=""
EXISTING_PROXY_URL=""
if [ -f "${INSTALL_DIR}/.env" ]; then
  EXISTING_API_KEY="$(grep -E '^REELVAULT_API_KEY=' "${INSTALL_DIR}/.env" | head -n1 | cut -d'=' -f2- || true)"
  EXISTING_PROXY_URL="$(grep -E '^RESIDENTIAL_PROXY_URL=' "${INSTALL_DIR}/.env" | head -n1 | cut -d'=' -f2- || true)"
fi

PLEX_TOKEN_ALREADY=""
if [ -f "${INSTALL_DIR}/plex-config/Library/Application Support/Plex Media Server/Preferences.xml" ]; then
  PLEX_TOKEN_ALREADY="$(grep -oE 'PlexOnlineToken="[^"]+"' "${INSTALL_DIR}/plex-config/Library/Application Support/Plex Media Server/Preferences.xml" | cut -d'"' -f2 || true)"
fi

echo ""
echo "[3/6] Quick Configuration (2 optional pastes)"
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
if [ -z "${RESIDENTIAL_PROXY_URL:-}" ] && [ -e /dev/tty ]; then
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
fi

# Clean accidental 'curl --proxy' or surrounding quotes if user pasted the whole test line
PROXY_INPUT="$(echo "$PROXY_INPUT" | sed -E 's/^.*(https?:\/\/[^"'\''[:space:]]+@p\.webshare\.io:[0-9]+).*$/\1/' | tr -d '"' | tr -d "'")"

API_KEY="${REELVAULT_API_KEY:-$EXISTING_API_KEY}"
if [ -z "$API_KEY" ]; then
  API_KEY="rv_$(openssl rand -hex 16)"
fi

echo "[4/6] Downloading ReelVault Cloud Bridge & Plex stack..."
curl -fsSL "${RAW_BASE}/Dockerfile" -o "${INSTALL_DIR}/Dockerfile"
curl -fsSL "${RAW_BASE}/bridge.js" -o "${INSTALL_DIR}/bridge.js"
curl -fsSL "${RAW_BASE}/Caddyfile" -o "${INSTALL_DIR}/Caddyfile"
curl -fsSL "${RAW_BASE}/docker-compose.yml" -o "${INSTALL_DIR}/docker-compose.yml"

write_env_file() {
  local domain_val="$1"
  cat > "${INSTALL_DIR}/.env" <<EOF
VPS_IP=${VPS_IP}
BRIDGE_DOMAIN=${domain_val}
REELVAULT_API_KEY=${API_KEY}
PLEX_CLAIM=${PLEX_CLAIM_INPUT}
RESIDENTIAL_PROXY_URL=${PROXY_INPUT}
TZ=America/New_York
EOF
  chmod 600 "${INSTALL_DIR}/.env"
}

ACTIVE_DOMAIN="${DEFAULT_DOMAIN}"
write_env_file "${ACTIVE_DOMAIN}"

echo "[5/6] Building & starting Plex + ReelVault Bridge + HTTPS (takes ~60–90s first time)..."
docker compose up -d --build

echo "[6/6] Provisioning free HTTPS SSL certificate for ${ACTIVE_DOMAIN}..."
HTTPS_OK="0"
for _ in $(seq 1 20); do
  if curl -fsS --max-time 4 "https://${ACTIVE_DOMAIN}/health" >/dev/null 2>&1; then
    HTTPS_OK="1"
    break
  fi
  sleep 2
done

if [ "$HTTPS_OK" != "1" ] && [ "${ACTIVE_DOMAIN}" = "${DASHED_IP}.nip.io" ]; then
  echo "      nip.io certificate busy; switching to fallback ${DASHED_IP}.sslip.io..."
  ACTIVE_DOMAIN="${DASHED_IP}.sslip.io"
  write_env_file "${ACTIVE_DOMAIN}"
  docker compose up -d caddy
  for _ in $(seq 1 18); do
    if curl -fsS --max-time 4 "https://${ACTIVE_DOMAIN}/health" >/dev/null 2>&1; then
      HTTPS_OK="1"
      break
    fi
    sleep 2
  done
fi

# Trigger automatic creation of "ReelVault Clips" and "ReelVault 18+ Vault" libraries in Plex
for _ in $(seq 1 8); do
  if curl -fsS --max-time 5 -H "Authorization: Bearer ${API_KEY}" "http://127.0.0.1:8787/health" >/dev/null 2>&1 || \
     docker exec reelvault-bridge curl -fsS --max-time 5 -H "Authorization: Bearer ${API_KEY}" "http://127.0.0.1:8787/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

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
echo "  🎬 OPEN YOUR PLEX SERVER:"
echo "     • Plex App (iPhone / iPad / Apple TV / Smart TV): Sign in & pick your new server!"
echo "     • Plex Web Direct: http://${VPS_IP}:32400/web"
echo "     • Two libraries auto-created once claimed:"
echo "         - ReelVault Clips (Safe videos)"
echo "         - ReelVault 18+ Vault (Hidden from global home dashboard)"
echo "============================================================"
echo ""
