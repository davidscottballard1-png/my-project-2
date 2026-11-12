#!/usr/bin/env node
/**
 * Standalone Live Verification for All Built-In ReelVault Sources
 *
 * Dynamically audits every Safe Default, 18+ Preset, and 18+ Directory source
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
 *   node scripts/smoke-live-all-sources.mjs --diff=HEAD~1
 *   node scripts/smoke-live-all-sources.mjs --auto-ci=HEAD~1
 */

import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

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
  APP_BUILD_VERSION,
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

function buildCatalogList(defaultSources, presetSources, directoryCatalog) {
  return [
    ...(defaultSources || []).map((s) => ({ ...s, suite: 'SAFE_DEFAULT', isNsfw: false })),
    ...(presetSources || []).map((s) => ({ ...s, suite: 'ADULT_PRESET', isNsfw: true })),
    ...(directoryCatalog || []).flatMap((g) =>
      (g.items || []).map((i) => ({ ...i, suite: `DIR:${g.category}`, isNsfw: true }))
    )
  ];
}

const allSources = buildCatalogList(DEFAULT_SOURCES, ADULT_PRESET_SOURCES, ADULT_DIRECTORY_CATALOG);

assert.ok(
  allSources.length >= 63,
  `Expected at least 63 built-in sources (found ${allSources.length})`
);
{
  const seenIds = new Set();
  for (const s of allSources) {
    assert.ok(typeof s.id === 'string' && s.id.trim().length >= 3, `Invalid source id on ${JSON.stringify(s)}`);
    assert.ok(!seenIds.has(s.id), `Duplicate built-in source id: ${s.id}`);
    seenIds.add(s.id);
    assert.ok(['keyword', 'subreddit', 'url'].includes(s.type), `Invalid type "${s.type}" on ${s.id}`);
    assert.ok(typeof s.value === 'string' && s.value.trim().length > 0, `Empty value on ${s.id}`);
    assert.ok(typeof s.label === 'string' && s.label.trim().length > 0, `Empty label on ${s.id}`);
  }
}

function loadCatalogSnapshotFromGitRef(gitRef) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-prev-app-'));
  const tempFile = path.join(tempDir, 'prev-app.cjs');
  try {
    const prevSourceCode = execFileSync('git', ['show', `${gitRef}:app.js`], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    fs.writeFileSync(tempFile, prevSourceCode, 'utf8');
    const prevMod = require(tempFile);
    return {
      ok: true,
      version: prevMod.APP_BUILD_VERSION || '',
      sources: buildCatalogList(
        prevMod.DEFAULT_SOURCES,
        prevMod.ADULT_PRESET_SOURCES,
        prevMod.ADULT_DIRECTORY_CATALOG
      )
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), version: '', sources: [] };
  } finally {
    try {
      delete require.cache[tempFile];
    } catch {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

function computeAddedOrChangedSources(prevSources, currSources) {
  const prevMap = new Map(prevSources.map((s) => [s.id, s]));
  return currSources.filter((curr) => {
    const prev = prevMap.get(curr.id);
    if (!prev) return true;
    return (
      prev.type !== curr.type ||
      prev.value !== curr.value ||
      Boolean(prev.isNsfw) !== Boolean(curr.isNsfw)
    );
  });
}

const groupArg = (process.argv.find((a) => a.startsWith('--group=')) || '').split('=')[1] || 'ALL';
const idArg = (process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1] || '';
const diffRefArg = (process.argv.find((a) => a.startsWith('--diff=')) || '').slice('--diff='.length).trim();
const autoCiRefArg = (process.argv.find((a) => a.startsWith('--auto-ci=')) || '').slice('--auto-ci='.length).trim();
const noBridge = process.argv.includes('--no-bridge');

let targets = allSources;

if (idArg) {
  const idSet = new Set(idArg.split(',').map((x) => x.trim()).filter(Boolean));
  targets = allSources.filter((s) => idSet.has(s.id));
} else if (autoCiRefArg) {
  const snap = loadCatalogSnapshotFromGitRef(autoCiRefArg);
  if (!snap.ok) {
    console.log(
      `[auto-ci] Could not read ${autoCiRefArg}:app.js (${snap.error}); running full live audit across all ${allSources.length} built-in sources.`
    );
    targets = allSources;
  } else {
    const changed = computeAddedOrChangedSources(snap.sources, allSources);
    const versionBumped = Boolean(snap.version && snap.version !== APP_BUILD_VERSION);
    if (versionBumped) {
      console.log(
        `[auto-ci] APP_BUILD_VERSION bumped (${snap.version} -> ${APP_BUILD_VERSION})${
          changed.length ? ` with ${changed.length} new/edited source(s)` : ''
        } — running full standalone live audit across all ${allSources.length} built-in sources.`
      );
      targets = allSources;
    } else if (changed.length > 0) {
      console.log(
        `[auto-ci] Detected ${changed.length} added/modified built-in source(s) since ${autoCiRefArg}: ${changed
          .map((s) => s.id)
          .join(', ')}`
      );
      targets = changed;
    } else {
      console.log(
        `[auto-ci] No APP_BUILD_VERSION bump (${APP_BUILD_VERSION}) or built-in source changes since ${autoCiRefArg} (${allSources.length} catalog sources verified). Skipping redundant live sweep.`
      );
      targets = [];
    }
  }
} else if (diffRefArg) {
  const snap = loadCatalogSnapshotFromGitRef(diffRefArg);
  assert.ok(snap.ok, `Failed to load ${diffRefArg}:app.js: ${snap.error}`);
  targets = computeAddedOrChangedSources(snap.sources, allSources);
  console.log(
    `[diff] Found ${targets.length} added/modified source(s) since ${diffRefArg}${
      targets.length ? `: ${targets.map((s) => s.id).join(', ')}` : ''
    }`
  );
} else if (groupArg === 'SAFE') {
  targets = allSources.filter((s) => s.suite === 'SAFE_DEFAULT');
} else if (groupArg === 'PRESET') {
  targets = allSources.filter((s) => s.suite === 'ADULT_PRESET');
} else if (groupArg === 'DIR') {
  targets = allSources.filter((s) => s.suite.startsWith('DIR:'));
} else if (groupArg === 'SUB') {
  targets = allSources.filter((s) => s.type === 'subreddit');
}

if (targets.length === 0) {
  if (prevApiKeyEnv === undefined) delete process.env.REELVAULT_API_KEY;
  else process.env.REELVAULT_API_KEY = prevApiKeyEnv;
  process.exit(0);
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

if (!noBridge) {
  bridgeServer = bridge.createBridgeServer();
  await new Promise((resolve) => bridgeServer.listen(0, '127.0.0.1', resolve));
  bridgeUrl = `http://127.0.0.1:${bridgeServer.address().port}`;
}

console.log(`Auditing ${targets.length} standalone source(s) live (build ${APP_BUILD_VERSION}, catalog size ${allSources.length})...\n`);

let passedCount = 0;
const failures = [];
let prevSubreddit = false;

async function runSingleSourceAttempt(src, useBridge) {
  const wantNsfw = Boolean(src.isNsfw);
  if (useBridge && bridgeUrl) {
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
  const items = await pullFromSource({ ...src, enabled: true, isNsfw: wantNsfw });
  const elapsed = Date.now() - t0;

  if (!items || items.length === 0) {
    return { ok: false, elapsed, items: [], reason: '0 videos' };
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

  let probe = { ok: false, status: 0, error: 'not probed' };
  for (const candidateItem of items.slice(0, 2)) {
    probe = await probeStream(candidateItem);
    if (probe.ok) break;
  }

  const ok = !decoyHit && !imageHit && !nsfwLeakInSafe && !sfwLeakInAdult && probe.ok;
  const reason =
    `HTTP ${probe.status} (${probe.contentType || probe.error || 'n/a'})` +
    (imageHit ? ` IMAGE_LEAK=${imageHit.videoUrl}` : '') +
    (decoyHit ? ` DECOY=${decoyHit.videoUrl}` : '') +
    (nsfwLeakInSafe ? ` NSFW_LEAK=${nsfwLeakInSafe.videoUrl}` : '') +
    (sfwLeakInAdult ? ` SFW_LEAK=${sfwLeakInAdult.videoUrl}` : '');

  return { ok, elapsed, items, probe, reason, hasPolicyViolation: Boolean(decoyHit || imageHit || nsfwLeakInSafe || sfwLeakInAdult) };
}

try {
  for (const src of targets) {
    if (src.type === 'subreddit' && prevSubreddit) {
      await sleep(1400);
    }
    prevSubreddit = src.type === 'subreddit';

    const requiresIpBoundBridge = Boolean(bridgeUrl && /fulltaboo\.tv/i.test(src.value));
    let usedBridge = requiresIpBoundBridge;

    try {
      let attempt = await runSingleSourceAttempt(src, usedBridge);

      // Retry once on transient network timeout / shared-CI CORS proxy 429 (never retry policy/safety violations)
      if (!attempt.ok && !attempt.hasPolicyViolation) {
        await sleep(2500);
        const allowBridgeOnRetry = Boolean(bridgeUrl && (requiresIpBoundBridge || src.type === 'url'));
        usedBridge = allowBridgeOnRetry;
        attempt = await runSingleSourceAttempt(src, usedBridge);
      }

      if (!attempt.items || attempt.items.length === 0) {
        console.log(`❌ [${src.id}] (${src.type}: "${src.value}") -> 0 videos (${attempt.elapsed}ms)`);
        failures.push(`${src.id}: 0 videos`);
        continue;
      }

      if (attempt.ok) {
        passedCount++;
      } else {
        failures.push(`${src.id}: ${attempt.reason}`);
      }

      const platforms = [...new Set(attempt.items.map((i) => i.platform || 'unknown'))].join(', ');
      console.log(
        `${attempt.ok ? '✅' : '⚠️'} [${src.id}]${usedBridge ? ' (+Bridge)' : ''} (${src.type}: "${src.value}") -> ${attempt.items.length} vids in ${attempt.elapsed}ms | [${platforms}] | HTTP ${attempt.probe.status} (${attempt.probe.contentType || attempt.probe.error || 'n/a'}, ${attempt.probe.bytesRead || 0}B)`
      );
    } catch (err) {
      console.log(`❌ [${src.id}] ERROR: ${err?.message || err}`);
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
