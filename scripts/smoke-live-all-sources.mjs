#!/usr/bin/env node
/**
 * Standalone Live Verification for All 63 Built-In ReelVault Sources
 *
 * Audits every Safe Default (6), 18+ Preset (13), and 18+ Directory (44) source
 * 1-by-1 in strict isolation:
 *  - Simulates production iPhone Safari origin (https://davidscottballard1-png.github.io/my-project-2/)
 *  - Asserts zero still-image (.jpg/.png), hover-preview, or ad/cam decoy leaks
 *  - Asserts zero 18+ leaks in Safe Mode and zero mainstream SFW platform bleed in Strict 18+ Mode
 *  - Verifies playable video/HLS bytes via Range: bytes=0-2047 (and tests IP-bound FullTaboo via local Bridge unless --no-bridge)
 *
 * Usage:
 *   node scripts/smoke-live-all-sources.mjs
 *   node scripts/smoke-live-all-sources.mjs --group=SAFE|PRESET|DIR|SUB
 *   node scripts/smoke-live-all-sources.mjs --id=dir-rg-amateur,dir-sub-gonewild
 */

import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

globalThis.window = {
  location: {
    protocol: 'https:',
    hostname: 'davidscottballard1-png.github.io',
    href: 'https://davidscottballard1-png.github.io/my-project-2/'
  }
};

const bridgeKey = 'rv_smoke_all_sources_key_12345';
const prevApiKeyEnv = process.env.REELVAULT_API_KEY;
if (!process.argv.includes('--no-bridge')) {
  process.env.REELVAULT_API_KEY = bridgeKey;
}

const bridge = require('../server/bridge.js');
const {
  DEFAULT_SOURCES,
  ADULT_PRESET_SOURCES,
  ADULT_DIRECTORY_CATALOG,
  settings,
  pullFromSource,
  setAppState,
  setCloudBackendConfig,
  clearCloudBackendConfig,
  isCloudBackendConfigured,
  isIpBoundEmbedOrCdnUrl,
  buildHttpsMediaProxyCandidates,
  getVideoRefererUrl,
  isKnownNsfwUrl
} = require('../app.js');

const allSources = [
  ...DEFAULT_SOURCES.map((s) => ({ ...s, suite: 'SAFE_DEFAULT', isNsfw: false })),
  ...ADULT_PRESET_SOURCES.map((s) => ({ ...s, suite: 'ADULT_PRESET', isNsfw: true })),
  ...ADULT_DIRECTORY_CATALOG.flatMap((g) =>
    g.items.map((i) => ({ ...i, suite: `DIR:${g.category}`, isNsfw: true }))
  )
];

assert.strictEqual(allSources.length, 63, 'Expected 63 total built-in sources (6 Safe + 13 Preset + 44 Directory)');

const groupArg = (process.argv.find((a) => a.startsWith('--group=')) || '').split('=')[1] || 'ALL';
const idArg = (process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1] || '';
const noBridge = process.argv.includes('--no-bridge');

let targets = allSources;
if (idArg) {
  const idSet = new Set(idArg.split(',').map((x) => x.trim()).filter(Boolean));
  targets = allSources.filter((s) => idSet.has(s.id));
} else if (groupArg === 'SAFE') {
  targets = allSources.filter((s) => s.suite === 'SAFE_DEFAULT');
} else if (groupArg === 'PRESET') {
  targets = allSources.filter((s) => s.suite === 'ADULT_PRESET');
} else if (groupArg === 'DIR') {
  targets = allSources.filter((s) => s.suite.startsWith('DIR:'));
} else if (groupArg === 'SUB') {
  targets = allSources.filter((s) => s.type === 'subreddit');
}

const DECOY_CHECK_REGEX =
  /vcmdiawe\.com|(?:ew|ei|em|pix[\w-]*)\.phncdn\.com|phncdn\.com\/c\d+\/videos\/|flirtify\.com|\b180P_\d+K_\d+\.webm\b|\bprev_\d+\.mp4\b|Big_Buck_Bunny|test-videos\.co\.uk/i;

const STILL_IMAGE_URL_REGEX = /\.(?:jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i;

const SFW_BLEED_CHECK_REGEX =
  /(?:^|\.)(?:youtube\.com|youtu\.be|wikimedia\.org|wikipedia\.org|nasa\.gov|dailymotion\.com|dmcdn\.net|vimeo\.com|pbs\.org|ted\.com)(?:\/|$)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probeStream(item) {
  let url = item.videoUrl;
  const referer = getVideoRefererUrl(item, url);
  if (isCloudBackendConfigured() && isIpBoundEmbedOrCdnUrl(url)) {
    const cands = buildHttpsMediaProxyCandidates(url, { refererUrl: referer });
    if (cands.length > 0) url = cands[0];
  }
  const headers = {
    Range: 'bytes=0-2047',
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  };
  if (referer && !url.includes('/proxy?')) headers.Referer = referer;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal, redirect: 'follow' });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const reader = res.body?.getReader?.();
    let firstChunk = Buffer.alloc(0);
    if (reader) {
      const ch = await reader.read();
      if (ch?.value) firstChunk = Buffer.from(ch.value);
      await reader.cancel().catch(() => {});
    }
    const textSample = firstChunk.toString('utf8', 0, Math.min(200, firstChunk.byteLength));
    const isHlsManifest =
      textSample.trimStart().startsWith('#EXTM3U') ||
      /mpegurl|vnd\.apple\.mpegurl|x-mpegurl/i.test(ct);
    const isVideoBinary =
      /video\/|application\/octet-stream|binary\/octet-stream/i.test(ct) &&
      !/^<!doctype html|^<html/i.test(textSample.trimStart());

    return {
      ok: (res.ok || res.status === 206) && firstChunk.byteLength > 0 && (isVideoBinary || isHlsManifest),
      status: res.status,
      contentType: ct,
      bytesRead: firstChunk.byteLength
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: `${err?.name || 'Error'}: ${err?.message || err}`
    };
  } finally {
    clearTimeout(timer);
  }
}

let bridgeServer = null;
let bridgeUrl = '';

if (!noBridge && targets.some((s) => /fulltaboo\.tv/i.test(s.value))) {
  bridgeServer = bridge.createBridgeServer();
  await new Promise((resolve) => bridgeServer.listen(0, '127.0.0.1', resolve));
  bridgeUrl = `http://127.0.0.1:${bridgeServer.address().port}`;
}

console.log(`Auditing ${targets.length} standalone source(s) live...\n`);

let passedCount = 0;
const failures = [];
let prevSubreddit = false;

try {
  for (const src of targets) {
    if (src.type === 'subreddit' && prevSubreddit) {
      await sleep(1400);
    }
    prevSubreddit = src.type === 'subreddit';

    const wantNsfw = Boolean(src.isNsfw);
    const useBridgeForSource = Boolean(bridgeUrl && /fulltaboo\.tv/i.test(src.value));
    if (useBridgeForSource) {
      setCloudBackendConfig(bridgeUrl, bridgeKey, true);
    } else {
      clearCloudBackendConfig();
    }

    settings.allowNsfw = wantNsfw;
    settings.nsfwMode = wantNsfw ? 'strict' : 'safe';
    settings.formatMode = 'all';
    settings.tubeDurationFilter = 'all';
    settings.tubeQualityFilter = 'all';

    setAppState({
      sources: [{ ...src, enabled: true, isNsfw: wantNsfw }],
      videoQueue: [],
      currentIndex: -1,
      clearSeenHistory: true,
      resetRedgifsToken: false
    });

    const t0 = Date.now();
    try {
      const items = await pullFromSource({ ...src, enabled: true, isNsfw: wantNsfw });
      const elapsed = Date.now() - t0;

      if (!items || items.length === 0) {
        console.log(`❌ [${src.id}] (${src.type}: "${src.value}") -> 0 videos (${elapsed}ms)`);
        failures.push(`${src.id}: 0 videos`);
        continue;
      }

      const decoyHit = items.find((i) => DECOY_CHECK_REGEX.test(i.videoUrl));
      const imageHit = items.find(
        (i) => STILL_IMAGE_URL_REGEX.test(i.videoUrl) && !/[?&]format=mp4\b/i.test(i.videoUrl)
      );
      const nsfwLeakInSafe = !wantNsfw
        ? items.find((i) => i.isNsfw || isKnownNsfwUrl(i.videoUrl) || isKnownNsfwUrl(i.pageUrl || ''))
        : null;
      const sfwLeakInAdult = wantNsfw
        ? items.find((i) => {
            if (!i.isNsfw) return true;
            try {
              return SFW_BLEED_CHECK_REGEX.test(new URL(i.videoUrl).hostname);
            } catch {
              return false;
            }
          })
        : null;

      const probe = await probeStream(items[0]);
      const ok = !decoyHit && !imageHit && !nsfwLeakInSafe && !sfwLeakInAdult && probe.ok;
      if (ok) {
        passedCount++;
      } else {
        failures.push(
          `${src.id}: HTTP ${probe.status} (${probe.contentType || probe.error || 'n/a'})` +
            (imageHit ? ` IMAGE_LEAK=${imageHit.videoUrl}` : '') +
            (decoyHit ? ` DECOY=${decoyHit.videoUrl}` : '') +
            (nsfwLeakInSafe ? ` NSFW_LEAK=${nsfwLeakInSafe.videoUrl}` : '') +
            (sfwLeakInAdult ? ` SFW_LEAK=${sfwLeakInAdult.videoUrl}` : '')
        );
      }

      const platforms = [...new Set(items.map((i) => i.platform || 'unknown'))].join(', ');
      console.log(
        `${ok ? '✅' : '⚠️'} [${src.id}]${useBridgeForSource ? ' (+Bridge)' : ''} (${src.type}: "${src.value}") -> ${items.length} vids in ${elapsed}ms | [${platforms}] | HTTP ${probe.status} (${probe.contentType || probe.error || 'n/a'}, ${probe.bytesRead || 0}B)`
      );
    } catch (err) {
      console.log(`❌ [${src.id}] ERROR (${Date.now() - t0}ms): ${err?.message || err}`);
      failures.push(`${src.id}: ${err?.message || err}`);
    }
  }
} finally {
  clearCloudBackendConfig();
  if (prevApiKeyEnv === undefined) delete process.env.REELVAULT_API_KEY;
  else process.env.REELVAULT_API_KEY = prevApiKeyEnv;
  if (bridgeServer) bridgeServer.close();
}

console.log(`\n=== SUMMARY: ${passedCount}/${targets.length} standalone source(s) verified live ===`);
if (failures.length > 0) {
  console.error('Failures:', failures);
  process.exitCode = 1;
}
