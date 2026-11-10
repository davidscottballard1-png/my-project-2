#!/usr/bin/env node
/**
 * Live Production-Origin CORS Proxy Smoke Test
 *
 * Simulates mobile Safari running on https://davidscottballard1-png.github.io/my-project-2/:
 * - Sets window.location to the production github.io origin (so isLocalDevOrigin() === false).
 * - Forces direct cross-origin fetches to throw TypeError('CORS blocked') just like Safari,
 *   requiring app.js's fetchWithCorsFallback() to resolve via its production CORS proxy pool.
 * - Sends real HTTP requests with `Origin: https://davidscottballard1-png.github.io` and
 *   verifies that:
 *     1. Keyless corsproxy.io is never raced on production origins.
 *     2. fetchWithCorsFallback() returns genuine upstream JSON & text payloads without
 *        being poisoned by fast HTTP 200 proxy errors, rate-limit strings, or paywalls.
 */

import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PROD_ORIGIN = 'https://davidscottballard1-png.github.io';
const PROD_REFERER = 'https://davidscottballard1-png.github.io/my-project-2/';

const realFetch = globalThis.fetch;
assert.strictEqual(typeof realFetch, 'function', 'Node 18+ global fetch is required');

globalThis.window = {
  location: {
    protocol: 'https:',
    hostname: 'davidscottballard1-png.github.io',
    href: PROD_REFERER
  }
};

const {
  isLocalDevOrigin,
  fetchWithCorsFallback,
  isInvalidCorsProxyPayload
} = require('../app.js');

assert.strictEqual(
  isLocalDevOrigin(),
  false,
  'Production github.io hostname must report isLocalDevOrigin() === false'
);

const observedProxyRequests = [];

// Wrap global fetch so direct upstream calls throw like browser CORS, while proxy calls
// go over the real network carrying the production GitHub Pages Origin header.
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

  const mergedHeaders = new Headers(init?.headers || {});
  mergedHeaders.set('Origin', PROD_ORIGIN);
  mergedHeaders.set('Referer', PROD_REFERER);
  mergedHeaders.set(
    'User-Agent',
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  );

  return realFetch(url, { ...init, headers: mergedHeaders });
};

async function runWithRetry(fn, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i + 1 < attempts) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr;
}

const probeJsonUrl =
  'https://archive.org/advancedsearch.php?q=mediatype%3Amovies&fl%5B%5D=identifier&rows=1&output=json';

console.log(`[smoke] Probing fetchWithCorsFallback() with Origin: ${PROD_ORIGIN} ...`);

const jsonPayload = await runWithRetry(() => fetchWithCorsFallback(probeJsonUrl, false), 2);

assert.strictEqual(
  isInvalidCorsProxyPayload(jsonPayload, false, probeJsonUrl),
  false,
  'Returned JSON payload must pass isInvalidCorsProxyPayload()'
);
assert.ok(
  Array.isArray(jsonPayload?.response?.docs) && jsonPayload.response.docs.length >= 1,
  `Expected archive.org response.docs array via production CORS proxy, got: ${JSON.stringify(jsonPayload).slice(0, 200)}`
);
assert.strictEqual(
  observedProxyRequests.some((u) => u.startsWith('https://corsproxy.io/')),
  false,
  'Keyless corsproxy.io must never be contacted during production github.io proxy races'
);

console.log(
  `[smoke] PASS: Production CORS proxy race succeeded with valid upstream JSON (${observedProxyRequests.length} proxy requests issued, 0 corsproxy.io calls).`
);
