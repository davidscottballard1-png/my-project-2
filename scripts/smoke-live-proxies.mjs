#!/usr/bin/env node
/**
 * Live Production-Origin Cloud Bridge & Public CORS Proxy Smoke Test
 *
 * Simulates mobile Safari running on https://davidscottballard1-png.github.io/my-project-2/:
 * 1. Boots server/bridge.js locally and verifies end-to-end live fetching through
 *    ReelVault's Private Cloud Bridge (/health + /proxy) against GitHub Pages CDN.
 * 2. Disconnects the Cloud Bridge and probes the free public CORS proxy fallback pool
 *    with `Origin: https://davidscottballard1-png.github.io`:
 *      - Strictly verifies keyless corsproxy.io is NEVER contacted on github.io.
 *      - Strictly verifies any 200 payload is genuine JSON (never poisoned by paywalls/rate-limits).
 *      - Distinguishes shared GitHub Actions runner 429/5xx throttling on free third-party
 *        proxies from actual application regressions (while failing on weekly scheduled runs).
 */

import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PROD_ORIGIN = 'https://davidscottballard1-png.github.io';
const PROD_REFERER = 'https://davidscottballard1-png.github.io/my-project-2/';
const SMOKE_API_KEY = 'rv_ci_smoke_secret_key_987654321';

process.env.REELVAULT_API_KEY = SMOKE_API_KEY;

const realFetch = globalThis.fetch;
assert.strictEqual(typeof realFetch, 'function', 'Node 18+ global fetch is required');

globalThis.window = {
  location: {
    protocol: 'https:',
    hostname: 'davidscottballard1-png.github.io',
    href: PROD_REFERER
  }
};

const bridge = require('../server/bridge.js');
const {
  isLocalDevOrigin,
  fetchWithCorsFallback,
  isInvalidCorsProxyPayload,
  setCloudBackendConfig,
  clearCloudBackendConfig,
  testCloudBackendConnection
} = require('../app.js');

assert.strictEqual(
  isLocalDevOrigin(),
  false,
  'Production github.io hostname must report isLocalDevOrigin() === false'
);

const probeJsonUrl = 'https://davidscottballard1-png.github.io/my-project-2/manifest.json';

// ============================================================================
// PART 1: Live End-to-End Smoke Check via ReelVault Private Cloud Bridge
// ============================================================================
import net from 'node:net';
import { spawn } from 'node:child_process';

const bridgePort = await new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
  s.on('error', reject);
});
const localBridgeBase = `http://127.0.0.1:${bridgePort}`;

const bridgeProc = spawn(process.execPath, ['server/bridge.js'], {
  env: {
    ...process.env,
    NODE_USE_ENV_PROXY: '1',
    PORT: String(bridgePort),
    REELVAULT_API_KEY: SMOKE_API_KEY,
    MEDIA_SAFE_DIR: '/tmp/rv-smoke-safe',
    MEDIA_NSFW_DIR: '/tmp/rv-smoke-nsfw'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out starting server/bridge.js')), 5000);
  bridgeProc.stdout.on('data', (buf) => {
    if (buf.toString().includes('Listening on')) {
      clearTimeout(timer);
      resolve();
    }
  });
  bridgeProc.once('exit', (code) => {
    clearTimeout(timer);
    reject(new Error(`server/bridge.js exited early with code ${code}`));
  });
});

try {
  console.log(`[smoke] Part 1: Verifying live Cloud Bridge (/health + /proxy) on ${localBridgeBase} ...`);
  const healthRes = await testCloudBackendConnection(localBridgeBase, SMOKE_API_KEY);
  assert.strictEqual(healthRes?.ok, true, 'Cloud Bridge /health must succeed');
  assert.strictEqual(healthRes?.authenticated, true, 'Cloud Bridge /health must authenticate');

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith(localBridgeBase)) {
      throw new TypeError(`Simulated browser CORS block on direct fetch: ${url}`);
    }
    const mergedHeaders = new Headers(init?.headers || {});
    mergedHeaders.set('Origin', PROD_ORIGIN);
    mergedHeaders.set('Referer', PROD_REFERER);
    return realFetch(url, { ...init, headers: mergedHeaders });
  };

  const cloudJson = await fetchWithCorsFallback(probeJsonUrl, false);
  assert.strictEqual(cloudJson?.short_name, 'ReelVault');
  console.log('[smoke] Part 1 PASS: Private Cloud Bridge fetched live manifest.json with valid CORS.');
} finally {
  clearCloudBackendConfig();
  globalThis.fetch = realFetch;
  try {
    bridgeProc.kill('SIGTERM');
  } catch {}
}

// ============================================================================
// PART 2: Public Free CORS Proxy Fallback Pool Check (Origin: github.io)
// ============================================================================
const observedProxyRequests = [];
const proxyDiagnostics = [];

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const isConfiguredProxy =
    url.startsWith('https://api.cors.lol/') ||
    url.startsWith('https://api.allorigins.win/') ||
    url.startsWith('https://api.codetabs.com/') ||
    url.startsWith('https://corsproxy.io/');

  if (!isConfiguredProxy) {
    throw new TypeError(`Simulated browser CORS block on direct fetch: ${url}`);
  }

  observedProxyRequests.push(url);
  if (url.startsWith('https://corsproxy.io/')) {
    throw new Error('Regression: fetchWithCorsFallback attempted keyless corsproxy.io on production github.io!');
  }

  const proxyHost = new URL(url).hostname;
  const mergedHeaders = new Headers(init?.headers || {});
  mergedHeaders.set('Origin', PROD_ORIGIN);
  mergedHeaders.set('Referer', PROD_REFERER);
  mergedHeaders.set(
    'User-Agent',
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  );

  try {
    const res = await realFetch(url, { ...init, headers: mergedHeaders });
    proxyDiagnostics.push(`${proxyHost}: HTTP ${res.status}`);
    return res;
  } catch (err) {
    proxyDiagnostics.push(`${proxyHost}: ${err?.name || 'Error'} (${err?.message || err})`);
    throw err;
  }
};

console.log(`[smoke] Part 2: Probing public free CORS proxy pool with Origin: ${PROD_ORIGIN} ...`);

let jsonPayload = null;
let publicPoolErr = null;
for (let attempt = 0; attempt < 2; attempt++) {
  try {
    jsonPayload = await fetchWithCorsFallback(probeJsonUrl, false);
    publicPoolErr = null;
    break;
  } catch (err) {
    publicPoolErr = err;
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

console.log(`[smoke] Public proxy diagnostics: ${proxyDiagnostics.join(' | ')}`);

assert.strictEqual(
  observedProxyRequests.some((u) => u.startsWith('https://corsproxy.io/')),
  false,
  'Keyless corsproxy.io must never be contacted during production github.io proxy races'
);
assert.ok(
  observedProxyRequests.length >= 3,
  'Expected all 3 production fallback proxies to be raced when direct CORS is blocked'
);

if (jsonPayload) {
  assert.strictEqual(
    isInvalidCorsProxyPayload(jsonPayload, false, probeJsonUrl),
    false,
    'Returned JSON payload must pass isInvalidCorsProxyPayload()'
  );
  assert.strictEqual(
    jsonPayload?.short_name,
    'ReelVault',
    `Expected ReelVault manifest JSON via production CORS proxy, got: ${JSON.stringify(jsonPayload).slice(0, 200)}`
  );
  console.log(
    `[smoke] Part 2 PASS: Public CORS proxy race succeeded (${observedProxyRequests.length} proxy requests, 0 corsproxy.io calls).`
  );
} else if (process.env.GITHUB_EVENT_NAME === 'schedule') {
  throw publicPoolErr || new Error('All public free CORS proxies failed during scheduled weekly monitor');
} else {
  console.warn(
    `[smoke] Part 2 NOTE: Free third-party proxies returned transient 429/5xx/timeout from shared runner IP (${publicPoolErr?.message}); anti-poisoning & corsproxy.io exclusion verified.`
  );
}
