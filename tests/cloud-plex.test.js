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
    await assert.rejects(() => bridge.assertSafePublicUrl('http://host.docker.internal:32400/identity'));
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

  it('repairs unreachable Docker container ID Plex servers (e.g. c9b3ab10cc47), enables Remote Access, sets HTTPS :443 customConnections, and refreshes plex.tv reachability', async () => {
    const prefsState = new Map([
      ['FriendlyName', { id: 'FriendlyName', type: 'text', value: 'c9b3ab10cc47' }],
      ['acceptedEULA', { id: 'acceptedEULA', type: 'bool', value: false }],
      ['PublishServerOnPlexOnlineKey', { id: 'PublishServerOnPlexOnlineKey', type: 'bool', value: false }],
      ['ManualPortMappingMode', { id: 'ManualPortMappingMode', type: 'bool', value: false }],
      ['ManualPortMappingPort', { id: 'ManualPortMappingPort', type: 'int', value: 0 }],
      ['secureConnections', { id: 'secureConnections', type: 'int', value: 1 }],
      [
        'customConnections',
        {
          id: 'customConnections',
          type: 'text',
          value: 'http://172.18.0.2:32400,https://85-239-249-225.nip.io:32400/'
        }
      ]
    ]);
    let reachabilityRefreshCount = 0;

    const mockPlex = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.searchParams.get('X-Plex-Token') !== 'plex_tok_test') {
        res.writeHead(401);
        return res.end();
      }
      if (req.method === 'GET' && u.pathname === '/:/prefs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            MediaContainer: { Setting: Array.from(prefsState.values()) }
          })
        );
      }
      if (req.method === 'PUT' && u.pathname === '/:/prefs') {
        for (const [k, v] of u.searchParams.entries()) {
          if (k === 'X-Plex-Token') continue;
          const existing = prefsState.get(k);
          if (!existing) {
            res.writeHead(400);
            return res.end(`unknown preference ${k}`);
          }
          existing.value = existing.type === 'bool' ? v === 'true' || v === '1' : existing.type === 'int' ? Number(v) : v;
        }
        res.writeHead(200);
        return res.end();
      }
      if (req.method === 'PUT' && u.pathname === '/myplex/refreshReachability') {
        reachabilityRefreshCount++;
        res.writeHead(200);
        return res.end();
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockPlex.listen(0, '127.0.0.1', resolve));
    const plexUrl = `http://127.0.0.1:${mockPlex.address().port}`;

    try {
      const sync1 = await bridge.ensurePlexRemoteConnectivity('plex_tok_test', {
        plexUrl,
        plexDomain: 'plex-85-239-249-225.nip.io',
        vpsIp: '85.239.249.225'
      });

      assert.strictEqual(sync1.synced, true);
      assert.strictEqual(sync1.friendlyName, 'ReelVault Cloud');
      assert.strictEqual(prefsState.get('FriendlyName').value, 'ReelVault Cloud');
      assert.strictEqual(prefsState.get('acceptedEULA').value, true);
      assert.strictEqual(prefsState.get('PublishServerOnPlexOnlineKey').value, true);
      assert.strictEqual(prefsState.get('ManualPortMappingMode').value, true);
      assert.strictEqual(prefsState.get('ManualPortMappingPort').value, 32400);
      assert.strictEqual(
        prefsState.get('customConnections').value,
        'https://plex-85-239-249-225.nip.io:443,http://85.239.249.225:32400'
      );
      assert.strictEqual(reachabilityRefreshCount, 1);

      // Second run should be idempotent (no unnecessary PUTs) and preserve user-chosen FriendlyName
      prefsState.get('FriendlyName').value = 'My Personal Cloud Vault';
      const sync2 = await bridge.ensurePlexRemoteConnectivity('plex_tok_test', {
        plexUrl,
        plexDomain: 'plex-85-239-249-225.nip.io',
        vpsIp: '85.239.249.225'
      });
      assert.deepStrictEqual(sync2.updated, []);
      assert.strictEqual(prefsState.get('FriendlyName').value, 'My Personal Cloud Vault');
      assert.strictEqual(reachabilityRefreshCount, 1);
    } finally {
      await new Promise((resolve) => mockPlex.close(resolve));
    }
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

  it('forwards X-Upstream-Authorization only to api.redgifs.com, never leaks REELVAULT_API_KEY, honors ?referer=, and detects HTTP 202 bot challenges', () => {
    const rgTarget = new URL('https://api.redgifs.com/v2/gifs/search?search_text=trending');
    const otherTarget = new URL('https://www.reddit.com/r/Unexpected/hot.json');

    // Allows guest Bearer token to api.redgifs.com
    assert.strictEqual(
      bridge.extractSafeUpstreamAuth(
        { headers: { 'x-upstream-authorization': 'Bearer rg_guest_token_xyz123456' } },
        rgTarget
      ),
      'Bearer rg_guest_token_xyz123456'
    );

    // Never forwards to non-RedGIFs hosts
    assert.strictEqual(
      bridge.extractSafeUpstreamAuth(
        { headers: { 'x-upstream-authorization': 'Bearer rg_guest_token_xyz123456' } },
        otherTarget
      ),
      ''
    );

    // Never forwards REELVAULT_API_KEY upstream even if accidentally placed in X-Upstream-Authorization
    assert.strictEqual(
      bridge.extractSafeUpstreamAuth(
        { headers: { 'x-upstream-authorization': 'Bearer rv_unit_test_secret_key_123456' } },
        rgTarget
      ),
      ''
    );

    // Honors validated ?referer= override on /proxy while falling back safely on invalid values
    assert.strictEqual(
      bridge.buildUpstreamReferer(
        new URL('https://cdn.example.net/media/clip.mp4'),
        'https://tube.example.net/watch/42'
      ),
      'https://tube.example.net/watch/42'
    );
    assert.strictEqual(
      bridge.buildUpstreamReferer(new URL('https://cdn.example.net/media/clip.mp4'), 'javascript:alert(1)'),
      'https://cdn.example.net/'
    );

    // Detects DuckDuckGo HTTP 202 anomaly challenges & Cloudflare challenge pages for Residential Proxy escalation
    assert.strictEqual(
      bridge.isBlockedTextPayload(202, '<div class="anomaly-modal">Unfortunately, bots use DuckDuckGo too.</div>'),
      true
    );
    assert.strictEqual(
      bridge.isBlockedTextPayload(200, '<script src="/cdn-cgi/challenge-platform/h/b/orchestrate"></script>'),
      true
    );
    assert.strictEqual(bridge.isBlockedTextPayload(200, '<html><body><video src="a.mp4"></video></body></html>'), false);
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
    app.setAppState({ resetRedgifsToken: true, videoQueue: [], currentIndex: -1, lastSearchResults: [] });
  });

  afterEach(() => {
    app.clearCloudBackendConfig();
    app.settings.allowNsfw = false;
    app.setAppState({ resetRedgifsToken: true, videoQueue: [], currentIndex: -1, lastSearchResults: [] });
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

    const withReferer = app.buildCloudProxyUrl(
      'https://cdn.example.org/clip.mp4',
      'https://watch.example.org/v/10'
    );
    assert.ok(withReferer.includes('&referer=https%3A%2F%2Fwatch.example.org%2Fv%2F10'));

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

  it('extracts the exact video from a pasted Reddit post URL (/comments/<id>) instead of dumping random subreddit hot posts', async () => {
    app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');

    const hitTargets = [];
    globalThis.fetch = async (url) => {
      const u = String(url);
      hitTargets.push(u);
      if (u.includes('/proxy?key=rv_secret_abc') && decodeURIComponent(u).includes('reddit.com/comments/1abc999.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              data: {
                children: [
                  {
                    data: {
                      id: '1abc999',
                      title: 'Exact Pasted Reddit Clip',
                      subreddit: 'Unexpected',
                      permalink: '/r/Unexpected/comments/1abc999/exact_pasted_reddit_clip/',
                      over_18: false,
                      secure_media: {
                        reddit_video: {
                          fallback_url: 'https://v.redd.it/exact999/CMAF_720.mp4?source=fallback',
                          hls_url: 'https://v.redd.it/exact999/HLSPlaylist.m3u8',
                          height: 720,
                          duration: 18
                        }
                      }
                    }
                  }
                ]
              }
            }
          ]
        };
      }
      throw new Error(`Should not hit random subreddit hot feed! Hit: ${u}`);
    };

    const pulled = await app.pullSmartInputToPlayer(
      'https://www.reddit.com/r/Unexpected/comments/1abc999/exact_pasted_reddit_clip/'
    );
    assert.strictEqual(pulled.length, 1);
    assert.strictEqual(pulled[0].title, 'Exact Pasted Reddit Clip');
    assert.ok(pulled[0].videoUrl.includes('v.redd.it/exact999'));
    assert.strictEqual(app.getAppState().videoQueue.length, 1);
    assert.strictEqual(app.getAppState().currentIndex, 0);
  });

  it('routes RedGIFs API v2 calls through Cloud /proxy with X-Upstream-Authorization when guest token is Cloud-minted', async () => {
    app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');
    app.settings.allowNsfw = true;

    let sawUpstreamAuth = null;
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      if (u === 'https://api.redgifs.com/v2/auth/temporary') {
        return { ok: false, status: 403, json: async () => ({ error: 'ISP Blocked' }) };
      }
      if (u.includes('/proxy?key=rv_secret_abc') && decodeURIComponent(u).includes('api.redgifs.com/v2/auth/temporary')) {
        return { ok: true, status: 200, json: async () => ({ token: 'cloud_ip_rg_token_777' }) };
      }
      if (u.includes('/proxy?key=rv_secret_abc') && decodeURIComponent(u).includes('api.redgifs.com/v2/gifs/search')) {
        sawUpstreamAuth = opts.headers?.['X-Upstream-Authorization'] || null;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            gifs: [
              {
                id: 'cloudmatched1',
                duration: 14,
                tags: ['hd', 'verified'],
                urls: { hd: 'https://media.redgifs.com/CloudMatched1.mp4?expires=9999999999&signature=ok' }
              }
            ]
          })
        };
      }
      throw new Error(`Unexpected RedGIFs fetch URL: ${u}`);
    };

    const items = await app.searchRedgifsVideos('trending', 5);
    assert.strictEqual(sawUpstreamAuth, 'Bearer cloud_ip_rg_token_777');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].id, 'rg-cloudmatched1');
  });

  it('prioritizes Private Cloud /proxy (with Referer) in rescueDeadVideoStream and polls Plex jobs until ready', async () => {
    app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');

    const rescueCalls = [];
    globalThis.fetch = async (url) => {
      const u = String(url);
      rescueCalls.push(u);
      if (u === 'https://tube.example.org/watch/clip77') {
        return { ok: false, status: 403, text: async () => 'Blocked' };
      }
      if (u.startsWith('https://85-239-249-225.nip.io/proxy?key=rv_secret_abc')) {
        const proxiedTarget = new URL(u).searchParams.get('url') || '';
        if (proxiedTarget === 'https://tube.example.org/watch/clip77') {
          return {
            ok: true,
            status: 200,
            text: async () =>
              '<!DOCTYPE html><html><head><title>Clip 77</title></head><body><main><p>Dynamic canvas player without inline mp4 source tags.</p></main></body></html>'
          };
        }
        // Large progressive stream (>25 MB Content-Length) rescued via Cloud /proxy!
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h) => {
              if (h.toLowerCase() === 'content-type') return 'video/mp4';
              if (h.toLowerCase() === 'content-length') return String(80 * 1024 * 1024);
              return null;
            }
          },
          body: { cancel: async () => {} }
        };
      }
      if (u === 'https://85-239-249-225.nip.io/plex/jobs') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            jobs: [{ id: 'job_live_1', title: 'Rescued Clip', status: 'ready', library: 'ReelVault Clips' }]
          })
        };
      }
      throw new Error(`Should not hit free public CORS proxies when Cloud /proxy succeeds! Hit: ${u}`);
    };

    const rescued = await app.rescueDeadVideoStream({
      id: 'clip-77',
      title: 'Hotlink Protected MP4',
      videoUrl: 'https://cdn.example.org/protected/movie.mp4',
      pageUrl: 'https://tube.example.org/watch/clip77',
      format: 'mp4'
    });
    assert.ok(rescued?.proxiedStreamUrl?.startsWith('https://85-239-249-225.nip.io/proxy?key=rv_secret_abc'));
    assert.ok(rescued.proxiedStreamUrl.includes('referer=https%3A%2F%2Ftube.example.org%2Fwatch%2Fclip77'));

    const jobDone = await app.pollPlexJobUntilDone('job_live_1', 'ReelVault Clips', {
      intervalMs: 5,
      maxPolls: 3
    });
    assert.strictEqual(jobDone?.status, 'ready');

    // Also verify batch queueing search results into Player
    app.setAppState({
      lastSearchResults: [
        { id: 'sr-1', title: 'Batch 1', videoUrl: 'https://cdn.example.org/1.mp4', format: 'mp4' },
        { id: 'sr-2', title: 'Batch 2', videoUrl: 'https://cdn.example.org/2.mp4', format: 'mp4' }
      ]
    });
    const queuedCount = app.queueSearchResultsToPlayer({ startReels: false });
    assert.strictEqual(queuedCount, 2);
    assert.strictEqual(app.getAppState().videoQueue.length, 2);
  });
});

