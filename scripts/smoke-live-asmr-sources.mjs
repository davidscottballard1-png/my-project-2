#!/usr/bin/env node
/**
 * Standalone Live Verification for All 10 18+ ASMR, Roleplay & GFE Sources
 *
 * Tests each 18+ ASMR preset and directory source 1-by-1 in strict isolation:
 *  - Simulates production iPhone Safari origin (https://davidscottballard1-png.github.io/my-project-2/)
 *  - Asserts zero silent hover-preview or ad/cam decoy leaks
 *  - Sends a live byte-range GET probe (bytes=0-2047) with getVideoRefererUrl() to verify playable video bytes
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

const {
  ADULT_PRESET_SOURCES,
  ADULT_DIRECTORY_CATALOG,
  settings,
  pullFromSource,
  setAppState,
  getVideoRefererUrl
} = require('../app.js');

settings.allowNsfw = true;
settings.nsfwMode = 'strict';
settings.formatMode = 'all';

const newPresets = ADULT_PRESET_SOURCES.filter((s) => s.id.includes('asmr'));
const asmrCategory = ADULT_DIRECTORY_CATALOG.find((g) => g.category.includes('ASMR'));
const allNewSources = [...newPresets, ...(asmrCategory?.items || [])];

assert.strictEqual(allNewSources.length, 10, 'Expected 10 total 18+ ASMR sources (2 presets + 8 directory items)');
console.log(`Testing ${allNewSources.length} standalone 18+ ASMR sources live...\n`);

async function verifyStreamReachable(item) {
  const url = item.videoUrl;
  const referer = getVideoRefererUrl(item, url);
  const headers = {
    Range: 'bytes=0-2047',
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  };
  if (referer) headers.Referer = referer;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal, redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    const cl = res.headers.get('content-range') || res.headers.get('content-length') || '';
    const reader = res.body?.getReader?.();
    let bytesRead = 0;
    if (reader) {
      const chunk = await reader.read();
      bytesRead = chunk?.value?.byteLength || 0;
      await reader.cancel().catch(() => {});
    }
    return {
      ok: (res.ok || res.status === 206) && bytesRead > 0 && /video|mpegurl|octet-stream/i.test(ct),
      status: res.status,
      contentType: ct,
      contentMeta: cl,
      bytesRead
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: `${err?.name || 'Error'}: ${err?.message || err} (${err?.cause?.message || ''})`
    };
  } finally {
    clearTimeout(timer);
  }
}

let passedCount = 0;
const failures = [];

for (const src of allNewSources) {
  setAppState({
    sources: [{ ...src, enabled: true, isNsfw: true }],
    videoQueue: [],
    currentIndex: -1,
    clearSeenHistory: true,
    resetRedgifsToken: false
  });

  const t0 = Date.now();
  try {
    const items = await pullFromSource({ ...src, enabled: true, isNsfw: true });
    const elapsed = Date.now() - t0;
    if (!items || items.length === 0) {
      console.log(`❌ [${src.id}] (${src.type}: "${src.value}") -> 0 videos returned (${elapsed}ms)\n`);
      failures.push(`${src.id}: 0 videos`);
      continue;
    }

    const previewLeak = items.find((i) =>
      /vcmdiawe\.com|(?:ew|ei|em|pix[\w-]*)\.phncdn\.com|flirtify\.com|\b180P_\d+K_\d+\.webm\b|\bprev_\d+\.mp4\b/i.test(
        i.videoUrl
      )
    );
    assert.strictEqual(
      previewLeak,
      undefined,
      `Unexpected hover-preview or ad leak in ${src.id}: ${previewLeak?.videoUrl}`
    );

    const sample = items[0];
    const probe = await verifyStreamReachable(sample);
    const platforms = [...new Set(items.map((i) => i.platform || 'unknown'))].join(', ');
    if (probe.ok) passedCount++;
    else failures.push(`${src.id}: stream HTTP ${probe.status}`);

    console.log(
      `${probe.ok ? '✅' : '⚠️'} [${src.id}] (${src.type}: "${src.value}") -> ${items.length} video(s) in ${elapsed}ms | platforms: [${platforms}]`
    );
    console.log(`   Sample 1     : "${sample.title}" (.${sample.format}, ${sample.duration || 0}s)`);
    if (items[1]) {
      console.log(`   Sample 2     : "${items[1].title}" (.${items[1].format}, ${items[1].duration || 0}s)`);
    }
    console.log(`   Stream URL   : ${sample.videoUrl.slice(0, 95)}`);
    console.log(
      `   Stream probe : HTTP ${probe.status} | type=${probe.contentType || 'n/a'} | bytesRead=${probe.bytesRead || 0} | meta=${probe.contentMeta || 'n/a'}\n`
    );
  } catch (err) {
    console.log(`❌ [${src.id}] ERROR after ${Date.now() - t0}ms: ${err?.message || err}\n`);
    failures.push(`${src.id}: ${err?.message || err}`);
  }
}

console.log(`=== SUMMARY: ${passedCount}/${allNewSources.length} standalone 18+ ASMR sources verified live ===`);
if (failures.length > 0) {
  console.error('Failures:', failures);
  process.exitCode = 1;
}
