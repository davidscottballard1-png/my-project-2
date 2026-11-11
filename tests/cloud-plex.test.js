'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// Ensure REELVAULT_API_KEY is set before requiring server/bridge.js
process.env.REELVAULT_API_KEY = 'rv_unit_test_secret_key_123456';

const bridge = require('../server/bridge.js');
const app = require('../app.js');

describe('Private Cloud Bridge Server (server/bridge.js)', () => {
  it('blocks loopback, RFC1918 private, link-local metadata, CGNAT, and IPv4-mapped IPv6 addresses (SSRF guard)', async () => {
    const blockedIps = [
      '127.0.0.1',
      '0.0.0.0',
      '10.0.0.1',
      '172.16.0.10',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      '::',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:0001',
      '::ffff:169.254.169.254'
    ];
    for (const ip of blockedIps) {
      assert.strictEqual(bridge.isPrivateOrReservedIp(ip), true, `Expected ${ip} to be blocked`);
    }

    assert.strictEqual(bridge.isPrivateOrReservedIp('85.239.249.225'), false);
    assert.strictEqual(bridge.isPrivateOrReservedIp('1.1.1.1'), false);
    assert.strictEqual(bridge.isPrivateOrReservedIp('2606:4700:4700::1111'), false);

    await assert.rejects(() => bridge.assertSafePublicUrl('http://127.0.0.1:32400/web'));
    await assert.rejects(() => bridge.assertSafePublicUrl('http://plex:32400/library/sections'));
    await assert.rejects(() => bridge.assertSafePublicUrl('http://169.254.169.254/latest/meta-data/'));
    await assert.rejects(() => bridge.assertSafePublicUrl('file:///etc/passwd'));
    await assert.rejects(() => bridge.assertSafePublicUrl('https://user:pass@85.239.249.225/video.mp4'));
  });

  it('verifies constant-time API Secret Keys across Bearer header, X-Api-Key, and ?key= query param', () => {
    assert.strictEqual(bridge.verifyApiKey('rv_unit_test_secret_key_123456'), true);
    assert.strictEqual(bridge.verifyApiKey('rv_wrong_key'), false);
    assert.strictEqual(bridge.verifyApiKey(''), false);

    const parsed1 = new URL('http://localhost:8787/proxy?key=rv_qkey&url=https://example.com/a.mp4');
    assert.strictEqual(bridge.extractProvidedApiKey({ headers: {} }, parsed1), 'rv_qkey');

    const parsed2 = new URL('http://localhost:8787/health');
    assert.strictEqual(
      bridge.extractProvidedApiKey({ headers: { authorization: 'Bearer rv_bkey' } }, parsed2),
      'rv_bkey'
    );
  });

  it('separates binary video/Range requests from small JSON/HTML metadata lookups so proxy GBs are never wasted on video streams', () => {
    assert.strictEqual(
      bridge.isBinaryMediaRequest(new URL('https://archive.org/download/clip/video.mp4'), { headers: {} }),
      true
    );
    assert.strictEqual(
      bridge.isBinaryMediaRequest(new URL('https://v.redd.it/abc123/CMAF_720.mp4'), { headers: {} }),
      true
    );
    assert.strictEqual(
      bridge.isBinaryMediaRequest(new URL('https://cdn.example.org/stream'), {
        headers: { range: 'bytes=0-1024' }
      }),
      true
    );
    assert.strictEqual(
      bridge.isBinaryMediaRequest(new URL('https://www.reddit.com/r/Unexpected/hot.json?limit=25'), {
        headers: {}
      }),
      false
    );
    assert.strictEqual(
      bridge.isBinaryMediaRequest(new URL('https://api.redgifs.com/v2/gifs/search?search_text=hd'), {
        headers: {}
      }),
      false
    );
  });

  it('picks progressive H.264 MP4 with audio first from yt-dlp format lists', () => {
    const sampleYtDlp = {
      id: 'vid99',
      title: 'Cloud Extracted Demo',
      webpage_url: 'https://example.org/watch/99',
      duration: 42,
      extractor_key: 'Generic',
      tags: ['demo', 'hd'],
      formats: [
        { url: 'https://cdn.example.org/v_vp9.webm', ext: 'webm', vcodec: 'vp9', acodec: 'opus', height: 1080 },
        { url: 'https://cdn.example.org/v_720.mp4', ext: 'mp4', vcodec: 'avc1.64001f', acodec: 'mp4a.40.2', height: 720 }
      ]
    };
    const picked = bridge.pickPlayableItemsFromYtDlp(sampleYtDlp, 'https://example.org/watch/99');
    assert.strictEqual(picked.length, 1);
    assert.strictEqual(picked[0].videoUrl, 'https://cdn.example.org/v_720.mp4');
    assert.strictEqual(picked[0].format, 'mp4');
    assert.strictEqual(picked[0].isHd, true);
  });

  it('serves /health (unauthenticated & authenticated) and rejects unauthorized /proxy & /plex/save calls', async () => {
    const srv = bridge.createBridgeServer();
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // Unauthenticated health probe (for Caddy/uptime check)
      const h1 = await fetch(`${base}/health`);
      assert.strictEqual(h1.status, 200);
      const j1 = await h1.json();
      assert.strictEqual(j1.ok, true);
      assert.strictEqual(j1.authenticated, undefined);

      // Wrong key -> 401
      const hBad = await fetch(`${base}/health`, {
        headers: { Authorization: 'Bearer wrong_secret' }
      });
      assert.strictEqual(hBad.status, 401);

      // Valid key -> 200 with authenticated: true
      const hAuth = await fetch(`${base}/health`, {
        headers: { Authorization: 'Bearer rv_unit_test_secret_key_123456' }
      });
      assert.strictEqual(hAuth.status, 200);
      const jAuth = await hAuth.json();
      assert.strictEqual(jAuth.ok, true);
      assert.strictEqual(jAuth.authenticated, true);

      // Unauthorized /proxy -> 401
      const pUnauth = await fetch(`${base}/proxy?url=https://archive.org`);
      assert.strictEqual(pUnauth.status, 401);

      // Authorized /proxy targeting blocked internal IP -> 400 SSRF block
      const pSsrf = await fetch(
        `${base}/proxy?key=rv_unit_test_secret_key_123456&url=${encodeURIComponent('http://127.0.0.1:32400')}`
      );
      assert.strictEqual(pSsrf.status, 400);

      // Authorized /plex/save with blocked internal URL -> 400
      const sSsrf = await fetch(`${base}/plex/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer rv_unit_test_secret_key_123456'
        },
        body: JSON.stringify({ url: 'http://192.168.1.50/clip.mp4', title: 'Internal' })
      });
      assert.strictEqual(sSsrf.status, 400);
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  });
});

describe('ReelVault Frontend Cloud & Plex Integration (app.js)', () => {
  const origFetch = globalThis.fetch;
  const origLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    app.clearCloudBackendConfig();
    app.settings.allowNsfw = false;
  });

  afterEach(() => {
    app.clearCloudBackendConfig();
    globalThis.fetch = origFetch;
    globalThis.localStorage = origLocalStorage;
  });

  it('normalizes Backend HTTPS URLs, strips accidental /health or trailing slashes, and unwraps cloud /proxy URLs', () => {
    assert.strictEqual(
      app.normalizeCloudBackendUrl('85-239-249-225.nip.io/'),
      'https://85-239-249-225.nip.io'
    );
    assert.strictEqual(
      app.normalizeCloudBackendUrl('https://85-239-249-225.nip.io/health'),
      'https://85-239-249-225.nip.io'
    );
    assert.strictEqual(
      app.normalizeCloudBackendUrl('localhost:8787/proxy'),
      'http://localhost:8787'
    );

    assert.strictEqual(
      app.setCloudBackendConfig('85-239-249-225.nip.io', 'rv_my_key_999'),
      true
    );
    assert.strictEqual(app.isCloudBackendConfigured(), true);

    const proxied = app.buildCloudProxyUrl('https://v.redd.it/xyz/CMAF_720.mp4');
    assert.strictEqual(
      proxied,
      'https://85-239-249-225.nip.io/proxy?key=rv_my_key_999&url=https%3A%2F%2Fv.redd.it%2Fxyz%2FCMAF_720.mp4'
    );
    assert.strictEqual(app.unwrapProxyTargetUrl(proxied), 'https://v.redd.it/xyz/CMAF_720.mp4');

    const candidates = app.buildHttpsMediaProxyCandidates('https://v.redd.it/xyz/CMAF_720.mp4', {
      forceProxy: true
    });
    assert.strictEqual(candidates[0], proxied);
  });

  it('routes non-open-API metadata fetches through Private Cloud /proxy first and sends Safe vs 18+ clips to matching Plex libraries', async () => {
    app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');

    const calls = [];
    globalThis.fetch = async (url, opts = {}) => {
      calls.push({ url: String(url), opts });
      if (String(url).includes('/proxy?key=rv_secret_abc')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { children: [] } }),
          text: async () => '{"data":{"children":[]}}'
        };
      }
      if (String(url).endsWith('/plex/save')) {
        const parsedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 202,
          json: async () => ({
            ok: true,
            jobId: 'job123',
            library: parsedBody.isNsfw ? 'ReelVault 18+ Vault' : 'ReelVault Clips',
            sentBody: parsedBody
          })
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const redditRes = await app.fetchWithCorsFallback('https://www.reddit.com/r/Unexpected/hot.json');
    assert.deepStrictEqual(redditRes, { data: { children: [] } });
    assert.ok(calls[0].url.startsWith('https://85-239-249-225.nip.io/proxy?key=rv_secret_abc'));

    // Safe clip -> ReelVault Clips
    const safeSave = await app.sendVideoToPlex({
      title: 'Apollo 11 Launch',
      videoUrl: 'https://85-239-249-225.nip.io/proxy?key=rv_secret_abc&url=https%3A%2F%2Farchive.org%2Fdownload%2Fapollo.mp4',
      sourceName: 'NASA',
      isNsfw: false
    });
    assert.strictEqual(safeSave.ok, true);
    assert.strictEqual(safeSave.library, 'ReelVault Clips');
    assert.strictEqual(safeSave.sentBody.url, 'https://archive.org/download/apollo.mp4');
    assert.strictEqual(safeSave.sentBody.isNsfw, false);

    // 18+ clip -> ReelVault 18+ Vault
    const nsfwSave = await app.sendVideoToPlex({
      title: 'Adult Loop HD',
      videoUrl: 'https://media.redgifs.com/SampleClip.mp4',
      pageUrl: 'https://www.redgifs.com/watch/sampleclip',
      sourceName: 'RedGIFs HD',
      isNsfw: true
    });
    assert.strictEqual(nsfwSave.ok, true);
    assert.strictEqual(nsfwSave.library, 'ReelVault 18+ Vault');
    assert.strictEqual(nsfwSave.sentBody.isNsfw, true);
  });

  it('falls back to Cloud /extract (yt-dlp) when scanUrlForVideos finds no raw <video> links in HTML', async () => {
    app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');

    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/proxy?')) {
        return {
          ok: true,
          status: 200,
          text: async () => '<html><head><title>Dynamic JS Player Page</title></head><body><div id="player"></div></body></html>'
        };
      }
      if (u.startsWith('https://85-239-249-225.nip.io/extract?')) {
        assert.strictEqual(opts.headers?.Authorization, 'Bearer rv_secret_abc');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            items: [
              {
                id: 'cloud-xyz',
                title: 'Extracted Stream 1080p',
                videoUrl: 'https://cdn.example.net/stream/manifest_1080p.mp4?sig=123',
                format: 'mp4',
                duration: 95,
                isHd: true,
                sourceName: 'Vimeo (Cloud)'
              }
            ]
          })
        };
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    const items = await app.scanUrlForVideos('https://example.net/watch/dynamic-clip');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].title, 'Extracted Stream 1080p');
    assert.strictEqual(items[0].format, 'mp4');
    assert.strictEqual(items[0].sourceName, 'Vimeo (Cloud)');
  });
});
