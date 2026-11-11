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

  it('enforces strictly 18+ results in executeCloudKeywordSearch(isNsfw=true) with zero YouTube or SFW leaks', async () => {
    let ytSearchCalled = false;
    const seenSearchUrls = [];

    const items = await bridge.executeCloudKeywordSearch(
      'massage',
      { isNsfw: true, limit: 6 },
      {
        assertSafeUrl: async (u) => new URL(u),
        runYtDlpSearch: async () => {
          ytSearchCalled = true;
          return {};
        },
        fetchText: async (url) => {
          seenSearchUrls.push(url);
          if (url.includes('html.duckduckgo.com')) {
            assert.ok(url.includes('kp=-2'), '18+ DuckDuckGo search must use kp=-2');
            assert.ok(decodeURIComponent(url).includes('(porn OR xxx OR nsfw)'), '18+ DuckDuckGo query must scope to adult terms');
            return `
              <a href="https://www.youtube.com/watch?v=sfwMassage1">SFW YouTube</a>
              <a href="https://vimeo.com/99887766">SFW Vimeo</a>
              <a href="https://spatherapyblog.example.org/watch/shoulder-tips">Unlabeled SFW Spa Blog</a>
              <a href="https://indieadult.example.org/watch/sensual-session">RTA Adult Studio</a>
            `;
          }
          if (url.includes('xvideos.com/?k=')) {
            return '<a href="/video.kthdf99/oil_clip_1080p">XV Hit</a>';
          }
          if (url.includes('spankbang.com/s/')) {
            return '<a href="/9abcd/video/deep_studio_hd">SB Hit</a>';
          }
          if (url.includes('xhamster.com/search/')) {
            return '';
          }
          if (url === 'https://www.xvideos.com/video.kthdf99/oil_clip_1080p') {
            return '<html><head><title>XV 18+ Clip</title></head><body><script>html5player.setVideoUrlHigh("https://cdn77-vid.xv-cdn.com/videos/oil_1080p.mp4");</script></body></html>';
          }
          if (url === 'https://spatherapyblog.example.org/watch/shoulder-tips') {
            // Purely safe physical therapy page without adult/RTA markers -> must be rejected!
            return '<html><head><title>Physical Therapy Shoulder Routine</title></head><body><video src="https://spatherapyblog.example.org/media/routine.mp4"></video></body></html>';
          }
          if (url === 'https://indieadult.example.org/watch/sensual-session') {
            return '<html><head><meta name="rating" content="RTA-5042-1996-1400-1577-RTA" /><title>Indie Studio Scene</title></head><body><video src="https://cdn.indieadult.example.org/scene_hd.mp4"></video></body></html>';
          }
          return '';
        },
        runYtDlpUrl: async (url) => {
          if (url === 'https://spankbang.com/9abcd/video/deep_studio_hd') {
            return {
              id: 'sb9abcd',
              title: 'SpankBang HD Scene',
              webpage_url: url,
              age_limit: 18,
              duration: 420,
              extractor_key: 'SpankBang',
              formats: [
                {
                  url: 'https://vdownload.sb-cd.com/9abcd_720p.mp4',
                  ext: 'mp4',
                  vcodec: 'avc1.64001f',
                  acodec: 'mp4a.40.2',
                  height: 720
                }
              ]
            };
          }
          throw new Error('No extractor');
        }
      }
    );

    assert.strictEqual(ytSearchCalled, false, 'ytsearch (YouTube) must NEVER run when 18+ Mode is ON');
    assert.strictEqual(items.length, 3);
    assert.ok(items.every((it) => it.isNsfw === true), 'Every 18+ search result must be marked isNsfw: true');
    assert.ok(
      !items.some((it) => /(?:youtube|vimeo|spatherapyblog)/i.test(`${it.pageUrl} ${it.videoUrl}`)),
      'Zero SFW sites or unlabeled safe blogs may appear in 18+ search'
    );
    assert.ok(items.some((it) => it.videoUrl.includes('xv-cdn.com/videos/oil_1080p.mp4')));
    assert.ok(items.some((it) => it.videoUrl.includes('sb-cd.com/9abcd_720p.mp4')));
    assert.ok(items.some((it) => it.videoUrl.includes('cdn.indieadult.example.org/scene_hd.mp4')));
  });

  it('searches YouTube + safe public web in executeCloudKeywordSearch(isNsfw=false), flags IP-bound streams proxyRequired, and blocks 18+ leaks', async () => {
    const items = await bridge.executeCloudKeywordSearch(
      'synthwave',
      { isNsfw: false, limit: 6 },
      {
        assertSafeUrl: async (u) => new URL(u),
        runYtDlpSearch: async (q) => {
          assert.strictEqual(q, 'synthwave');
          return {
            entries: [
              {
                id: 'yt_safe_1',
                title: 'Neon Synthwave Live Visuals',
                webpage_url: 'https://www.youtube.com/watch?v=yt_safe_1',
                age_limit: 0,
                duration: 195,
                extractor_key: 'Youtube',
                formats: [
                  {
                    url: 'https://rr2---sn-ab5l6nzy.googlevideo.com/videoplayback?expire=1999999999&ip=85.239.249.225&itag=18',
                    ext: 'mp4',
                    vcodec: 'avc1.42001E',
                    acodec: 'mp4a.40.2',
                    height: 360
                  }
                ]
              },
              {
                id: 'yt_adult_blocked',
                title: 'Age Restricted Video',
                webpage_url: 'https://www.youtube.com/watch?v=yt_adult_blocked',
                age_limit: 18,
                duration: 90,
                extractor_key: 'Youtube',
                formats: [
                  {
                    url: 'https://rr4---sn-ab5l6nzy.googlevideo.com/videoplayback?ip=85.239.249.225&itag=18',
                    ext: 'mp4',
                    vcodec: 'avc1.42001E',
                    acodec: 'mp4a.40.2',
                    height: 360
                  }
                ]
              }
            ]
          };
        },
        fetchText: async (url) => {
          if (url.includes('html.duckduckgo.com')) {
            assert.ok(url.includes('kp=1'), 'Safe DuckDuckGo search must use kp=1');
            return `
              <a href="https://vimeo.com/44556677">Vimeo Synthwave Short</a>
              <a href="https://www.xvideos.com/video.bad1/adult_leak">Adult Leak</a>
            `;
          }
          return '';
        },
        runYtDlpUrl: async (url) => {
          if (url === 'https://vimeo.com/44556677') {
            return {
              id: 'vm44556677',
              title: 'Vimeo Synthwave Short',
              webpage_url: url,
              age_limit: 0,
              duration: 110,
              extractor_key: 'Vimeo',
              formats: [
                {
                  url: 'https://vod-progressive.akamaized.net/exp=1999999999/vimeo_synth_720p.mp4',
                  ext: 'mp4',
                  vcodec: 'avc1.64001f',
                  acodec: 'mp4a.40.2',
                  height: 720
                }
              ]
            };
          }
          throw new Error('Unexpected URL');
        }
      }
    );

    assert.strictEqual(items.length, 2);
    const ytItem = items.find((it) => it.id === 'cloud-yt_safe_1');
    const vimeoItem = items.find((it) => it.id === 'cloud-vm44556677');
    assert.ok(ytItem, 'Should include safe YouTube result');
    assert.strictEqual(ytItem.proxyRequired, true, 'googlevideo.com IP-bound stream must set proxyRequired: true');
    assert.ok(vimeoItem, 'Should include public web Vimeo result');
    assert.strictEqual(vimeoItem.proxyRequired, false);
    assert.ok(!items.some((it) => it.id === 'cloud-yt_adult_blocked' || /xvideos/i.test(it.pageUrl)));
  });

  it('validates API Secret Key and ?q= query parameter on GET /search endpoint', async () => {
    const server = bridge.createBridgeServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const unauth = await fetch(`http://127.0.0.1:${port}/search?q=ocean`);
      assert.strictEqual(unauth.status, 401);

      const missingQ = await fetch(`http://127.0.0.1:${port}/search`, {
        headers: { Authorization: 'Bearer rv_unit_test_secret_key_123456' }
      });
      assert.strictEqual(missingQ.status, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects null, array, non-primitive fields, and >64KB payloads on POST /plex/save with HTTP 400 without crashing or ECONNRESET', async () => {
    const server = bridge.createBridgeServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    const headers = {
      Authorization: 'Bearer rv_unit_test_secret_key_123456',
      'Content-Type': 'application/json'
    };

    try {
      for (const badBody of [
        'null',
        '[]',
        '{"url":{"toString":null}}',
        '{"url":"https://1.1.1.1/clip.mp4","title":{"bad":1},"sourceName":["arr"]}'
      ]) {
        const res = await fetch(`${base}/plex/save`, { method: 'POST', headers, body: badBody });
        assert.ok(res.status === 400 || res.status === 202, `Unexpected status ${res.status} for ${badBody}`);
        if (badBody === 'null' || badBody === '[]' || badBody.includes('toString')) {
          assert.strictEqual(res.status, 400);
        }
      }

      // 200 KB oversized payload must return clean HTTP 400 JSON rather than ECONNRESET
      const hugePayload = JSON.stringify({
        url: 'https://example.com/video.mp4',
        title: 'A'.repeat(200 * 1024)
      });
      const hugeRes = await fetch(`${base}/plex/save`, {
        method: 'POST',
        headers,
        body: hugePayload
      });
      assert.strictEqual(hugeRes.status, 400);
      const hugeJson = await hugeRes.json();
      assert.strictEqual(hugeJson.ok, false);
      assert.match(hugeJson.error, /too large/i);

      // Server must remain alive and responsive afterwards
      const alive = await fetch(`${base}/health`);
      assert.strictEqual(alive.status, 200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('aborts extensionless video/* upstream downloads on client disconnect, blocks SSRF redirects before curl fallback, and rejects failed curl (HTTP 000)', async () => {
    const { spawn } = require('node:child_process');
    const net = require('node:net');

    let upstreamChunksSent = 0;
    let upstreamAborted = false;

    const mockUpstream = http.createServer((req, res) => {
      if (req.url === '/ssrf-redirect') {
        res.writeHead(302, { Location: 'http://127.0.0.1:32400/:/prefs' });
        return res.end();
      }
      if (req.url === '/reset-meta') {
        req.socket.destroy();
        return;
      }
      if (req.url === '/dynamic-video-stream') {
        res.writeHead(200, { 'Content-Type': 'video/mp4' });
        const iv = setInterval(() => {
          if (res.destroyed) {
            clearInterval(iv);
            return;
          }
          upstreamChunksSent++;
          res.write(Buffer.alloc(16384, 0x41));
          if (upstreamChunksSent >= 30) {
            clearInterval(iv);
            res.end();
          }
        }, 25);
        req.on('close', () => {
          if (upstreamChunksSent < 30) upstreamAborted = true;
          clearInterval(iv);
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => mockUpstream.listen(0, '127.0.0.1', resolve));
    const upPort = mockUpstream.address().port;

    // Pick a guaranteed-closed port for RESIDENTIAL_PROXY_URL so curl exits non-zero with http_code 000
    const closedProxyPort = await new Promise((resolve) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });

    const bridgePort = await new Promise((resolve) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });

    // Spawn child bridge with custom DNS preload mapping safe-public.example -> 127.0.0.1 only at connect time
    // while dns.promises.lookup returns public 93.184.216.34 so assertSafePublicUrl passes for initial hop
    const preloadCode = `
      const dns = require('node:dns');
      const origLookup = dns.promises.lookup;
      dns.promises.lookup = async (host, opts) => {
        if (host === 'safe-public.example') {
          return opts && opts.all ? [{ address: '93.184.216.34', family: 4 }] : { address: '93.184.216.34', family: 4 };
        }
        return origLookup.call(dns.promises, host, opts);
      };
      const origFetch = globalThis.fetch;
      globalThis.fetch = (input, init) => {
        const u = new URL(String(input));
        if (u.hostname === 'safe-public.example') {
          u.hostname = '127.0.0.1';
          u.port = '${upPort}';
          return origFetch(u.href, init);
        }
        return origFetch(input, init);
      };
    `;
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const tmpPreload = path.join(os.tmpdir(), `rv-bridge-preload-${process.pid}-${Date.now()}.cjs`);
    fs.writeFileSync(tmpPreload, preloadCode);

    const child = spawn(process.execPath, ['-r', tmpPreload, 'server/bridge.js'], {
      env: {
        ...process.env,
        PORT: String(bridgePort),
        REELVAULT_API_KEY: 'rv_child_test_key',
        RESIDENTIAL_PROXY_URL: `http://user:pass@127.0.0.1:${closedProxyPort}`,
        MEDIA_SAFE_DIR: path.join(os.tmpdir(), `rv-safe-${process.pid}`),
        MEDIA_NSFW_DIR: path.join(os.tmpdir(), `rv-nsfw-${process.pid}`)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('bridge startup timeout')), 5000);
      child.stdout.on('data', (b) => {
        if (b.toString().includes('Listening on')) {
          clearTimeout(t);
          resolve();
        }
      });
      child.once('exit', (c) => {
        clearTimeout(t);
        reject(new Error(`bridge exited ${c}`));
      });
    });

    try {
      const base = `http://127.0.0.1:${bridgePort}`;

      // 1. SSRF redirect to 127.0.0.1:32400 must return HTTP 400 (never fall back to curl or return 200)
      const ssrfRedir = await fetch(
        `${base}/proxy?key=rv_child_test_key&url=${encodeURIComponent('http://safe-public.example/ssrf-redirect')}`
      );
      assert.strictEqual(ssrfRedir.status, 400);

      // 2. Upstream TCP reset + failed curl (http_code 000) must return HTTP 502 (never false HTTP 200)
      const failedCurl = await fetch(
        `${base}/proxy?key=rv_child_test_key&url=${encodeURIComponent('http://safe-public.example/reset-meta')}`
      );
      assert.strictEqual(failedCurl.status, 502);

      // 3. Extensionless video/mp4 stream in Path 1 must abort upstream when client disconnects early
      await new Promise((resolve, reject) => {
        const req = http.get(
          `${base}/proxy?key=rv_child_test_key&url=${encodeURIComponent('http://safe-public.example/dynamic-video-stream')}`,
          (res) => {
            assert.strictEqual(res.statusCode, 200);
            res.once('data', () => {
              req.destroy();
              resolve();
            });
          }
        );
        req.on('error', () => resolve());
        setTimeout(() => reject(new Error('stream timeout')), 4000).unref();
      });

      await new Promise((r) => setTimeout(r, 200));
      assert.strictEqual(upstreamAborted, true, 'Upstream stream must abort immediately when client disconnects');
      assert.ok(upstreamChunksSent < 10, `Expected <10 chunks sent after disconnect, got ${upstreamChunksSent}`);
    } finally {
      child.kill('SIGTERM');
      try {
        fs.unlinkSync(tmpPreload);
      } catch {}
      await new Promise((resolve) => mockUpstream.close(resolve));
    }
  });

  it('handles literal % in direct video filenames without URIError and refreshes cloudSearchCache when limit increases', async () => {
    // 1. Literal % in direct adult .mp4 URL
    const pctItems = await bridge.executeCloudKeywordSearch(
      'percentclip',
      { isNsfw: true, limit: 4 },
      {
        assertSafeUrl: async (u) => new URL(u),
        fetchText: async (url) => {
          if (url.includes('html.duckduckgo.com')) {
            return '<a href="https://cdn.spankbang.com/clips/100%_real_nsfw_hd.mp4">Direct Adult MP4</a>';
          }
          return '';
        },
        runYtDlpUrl: async () => ({})
      }
    );
    assert.strictEqual(pctItems.length, 1);
    assert.strictEqual(pctItems[0].title, '100%_real_nsfw_hd.mp4');

    // 2. Small limit=1 query followed by limit=4 must not return truncated 1-item cache
    let searchCalls = 0;
    const mockDeps = {
      assertSafeUrl: async (u) => new URL(u),
      fetchText: async () => '',
      runYtDlpSearch: async (_q, count) => {
        searchCalls++;
        const entries = [];
        for (let i = 1; i <= count; i++) {
          entries.push({
            id: `lim_${i}`,
            title: `Clip ${i}`,
            webpage_url: `https://www.youtube.com/watch?v=lim_${i}`,
            age_limit: 0,
            duration: 30,
            extractor_key: 'Youtube',
            formats: [
              {
                url: `https://rr1---sn.googlevideo.com/videoplayback?id=${i}`,
                ext: 'mp4',
                vcodec: 'avc1.42001E',
                acodec: 'mp4a.40.2',
                height: 360
              }
            ]
          });
        }
        return { entries };
      }
    };

    const uniqueQuery = `cache_limit_regression_${Date.now()}`;
    const smallHit = await bridge.executeCloudKeywordSearch(
      uniqueQuery,
      { isNsfw: false, limit: 1, forceCache: true },
      mockDeps
    );
    assert.strictEqual(smallHit.length, 1);
    assert.strictEqual(searchCalls, 1);

    const largerHit = await bridge.executeCloudKeywordSearch(
      uniqueQuery,
      { isNsfw: false, limit: 4, forceCache: true },
      mockDeps
    );
    assert.strictEqual(largerHit.length, 4, 'limit=4 after limit=1 must fetch full 4 items rather than serving 1-item cache');
    assert.strictEqual(searchCalls, 2);

    const cachedHit = await bridge.executeCloudKeywordSearch(
      uniqueQuery,
      { isNsfw: false, limit: 3, forceCache: true },
      mockDeps
    );
    assert.strictEqual(cachedHit.length, 3);
    assert.strictEqual(searchCalls, 2, 'limit=3 after limit=4 must be served from cache');
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

  it('routes IP-bound YouTube streams via proxiedStreamUrl in Safe Mode and enforces strictly 18+ results across Cloud, Open Web & Reddit when 18+ is ON', async () => {
    app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');

    // 1. Safe Mode: searchCloudVideos(?nsfw=0) wraps proxyRequired IP-bound streams while blocking adult leaks
    app.settings.allowNsfw = false;
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      if (u.startsWith('https://85-239-249-225.nip.io/search?')) {
        assert.ok(u.includes('nsfw=0'));
        assert.strictEqual(opts.headers?.Authorization, 'Bearer rv_secret_abc');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            items: [
              {
                id: 'cloud-yt-1',
                title: 'Safe Public Web Documentary',
                videoUrl: 'https://rr2---sn-ab5l6nzy.googlevideo.com/videoplayback?ip=85.239.249.225&itag=18',
                originalUrl: 'https://www.youtube.com/watch?v=doc1',
                pageUrl: 'https://www.youtube.com/watch?v=doc1',
                format: 'mp4',
                proxyRequired: true,
                sourceName: 'Youtube (Cloud)'
              },
              {
                id: 'cloud-bad-nsfw',
                title: 'Adult Leak',
                videoUrl: 'https://cdn.xvideos.com/leak.mp4',
                pageUrl: 'https://www.xvideos.com/video1',
                format: 'mp4',
                isNsfw: true
              }
            ]
          })
        };
      }
      throw new Error(`Unexpected fetch: ${u}`);
    };

    const safeCloudHits = await app.searchCloudVideos('documentary', 6);
    assert.strictEqual(safeCloudHits.length, 1);
    assert.strictEqual(safeCloudHits[0].originalUrl, 'https://www.youtube.com/watch?v=doc1');
    assert.ok(
      app.getEffectivePlaybackUrl(safeCloudHits[0]).startsWith('https://85-239-249-225.nip.io/proxy?key=rv_secret_abc'),
      'IP-bound googlevideo.com stream must play via Cloud /proxy on iPhone'
    );

    const sampleDdgHtml = `
      <a href="https://www.youtube.com/watch?v=abc123">YouTube Watch</a>
      <a href="https://vimeo.com/776655">Vimeo Watch</a>
      <a href="https://www.xvideos.com/video.999/adult">XVideos Watch</a>
    `;
    const safeCandidatesWithCloud = app.extractCandidateWebPagesFromSearchHtml(sampleDdgHtml);
    assert.ok(safeCandidatesWithCloud.includes('https://www.youtube.com/watch?v=abc123'));
    assert.ok(!safeCandidatesWithCloud.some((u) => u.includes('xvideos.com')));

    // 2. Strict 18+ Mode: rejects YouTube/Vimeo/SFW sites AND rejects over_18 === false Reddit posts
    app.settings.allowNsfw = true;
    const nsfwCandidates = app.extractCandidateWebPagesFromSearchHtml(sampleDdgHtml);
    assert.ok(!nsfwCandidates.some((u) => u.includes('youtube.com') || u.includes('vimeo.com')));
    assert.ok(nsfwCandidates.includes('https://www.xvideos.com/video.999/adult'));

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.startsWith('https://85-239-249-225.nip.io/search?')) {
        assert.ok(u.includes('nsfw=1'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            items: [
              {
                id: 'cloud-sfw-leak',
                title: 'SFW YouTube Leak',
                videoUrl: 'https://rr1---sn.googlevideo.com/videoplayback?itag=18',
                pageUrl: 'https://www.youtube.com/watch?v=sfw1',
                format: 'mp4'
              },
              {
                id: 'cloud-xv-strict',
                title: 'Verified 18+ Scene',
                videoUrl: 'https://cdn77-vid.xv-cdn.com/strict18.mp4',
                pageUrl: 'https://www.xvideos.com/video.strict18/clip',
                format: 'mp4',
                isNsfw: true
              }
            ]
          })
        };
      }
      if (u.includes('reddit.com/search.json') || u.includes('reddit.com/r/') || u.includes('reddit.com/user/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              children: [
                {
                  data: {
                    id: 'sfw_post_1',
                    title: 'Safe Yoga Tutorial',
                    over_18: false,
                    permalink: '/r/yoga/comments/sfw_post_1/',
                    secure_media: {
                      reddit_video: { fallback_url: 'https://v.redd.it/sfwyoga/CMAF_720.mp4', height: 720, duration: 30 }
                    }
                  }
                },
                {
                  data: {
                    id: 'nsfw_post_2',
                    title: '18+ Verified Post',
                    over_18: true,
                    permalink: '/r/nsfw/comments/nsfw_post_2/',
                    secure_media: {
                      reddit_video: { fallback_url: 'https://v.redd.it/nsfw999/CMAF_720.mp4', height: 720, duration: 25 }
                    }
                  }
                }
              ]
            }
          })
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };

    const strictCloudHits = await app.searchCloudVideos('yoga', 6);
    assert.strictEqual(strictCloudHits.length, 1);
    assert.strictEqual(strictCloudHits[0].id, 'cloud-xv-strict');
    assert.strictEqual(strictCloudHits[0].isNsfw, true);

    const strictRedditHits = await app.searchRedditVideosByKeyword('yoga');
    assert.strictEqual(strictRedditHits.length, 1, 'over_18: false Reddit posts must never leak into 18+ keyword search');
    assert.ok(strictRedditHits[0].videoUrl.includes('v.redd.it/nsfw999'));
  });

  it('strips /search suffix in normalizeCloudBackendUrl, unsticks #sendToPlexBtn on mid-poll Disconnect, and blocks adult ?scan= links & mode races in Safe Mode', async () => {
    // 1. /search suffix normalization (v29 endpoint)
    assert.strictEqual(
      app.normalizeCloudBackendUrl('https://85-239-249-225.nip.io/search'),
      'https://85-239-249-225.nip.io'
    );
    assert.strictEqual(
      app.normalizeCloudBackendUrl('http://127.0.0.1:8787/search/'),
      'http://127.0.0.1:8787'
    );

    // 2. Disconnecting Cloud Server mid-poll resolves pollPlexJobUntilDone immediately and resets #sendToPlexBtn
    const origDocument = globalThis.document;
    const origWindow = globalThis.window;
    const mockSendBtn = {
      dataset: {},
      textContent: '🎬 Send Video to My Plex Server',
      disabled: false
    };
    const mockSearchList = { innerHTML: '' };
    const mockScanInput = { value: '' };

    globalThis.document = {
      getElementById: (id) => {
        if (id === 'sendToPlexBtn') return mockSendBtn;
        if (id === 'searchResultsList') return mockSearchList;
        if (id === 'urlScanInput') return mockScanInput;
        return null;
      },
      querySelectorAll: () => []
    };

    try {
      app.setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_secret_abc');
      app.setAppState({
        videoQueue: [{ id: 'v1', title: 'Clip', videoUrl: 'https://cdn.example.org/a.mp4' }],
        currentIndex: 0
      });

      globalThis.fetch = async (url) => {
        if (String(url).endsWith('/plex/jobs')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              jobs: [{ id: 'job_hang_test', status: 'downloading', library: 'ReelVault Clips' }]
            })
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      };

      const pollPromise = app.pollPlexJobUntilDone('job_hang_test', 'ReelVault Clips', {
        intervalMs: 30000,
        maxAttempts: 5
      });

      // Wait briefly for attempt 0 to set dataset.plexPolling = '1' and enter 30s timer
      await new Promise((r) => setTimeout(r, 30));
      assert.strictEqual(mockSendBtn.dataset.plexPolling, '1');
      assert.match(mockSendBtn.textContent, /Downloading Video to Cloud Plex/);

      // Disconnect mid-poll: pollPromise must resolve immediately (<100ms, NOT hang 30s) and reset button
      const t0 = Date.now();
      app.clearCloudBackendConfig();
      const pollResult = await pollPromise;
      const elapsed = Date.now() - t0;

      assert.strictEqual(pollResult, null);
      assert.ok(elapsed < 500, `Expected immediate cancellation on Disconnect, took ${elapsed}ms`);
      assert.strictEqual(mockSendBtn.dataset.plexPolling, undefined);
      assert.strictEqual(mockSendBtn.textContent, '🎬 Send Video to My Plex Server');

      // 3. ?scan= bookmarklet / deep link must block known adult URLs in Safe Mode without scanning
      app.settings.allowNsfw = false;
      let scanFetchCalled = false;
      globalThis.fetch = async () => {
        scanFetchCalled = true;
        return { ok: true, status: 200, text: async () => '' };
      };
      globalThis.window = {
        location: {
          search: '?scan=' + encodeURIComponent('https://www.redgifs.com/watch/testadultclip'),
          origin: 'https://davidscottballard1-png.github.io',
          pathname: '/my-project-2/'
        }
      };

      const handled = app.initBookmarkletAndUrlParams();
      assert.strictEqual(handled, true);
      assert.strictEqual(scanFetchCalled, false, 'Safe Mode must block adult ?scan= URLs before fetching');
      assert.strictEqual(app.getAppState().lastSearchResults.length, 0);
      assert.match(mockSearchList.innerHTML, /Enable 18\+ Mode/);
    } finally {
      globalThis.document = origDocument;
      globalThis.window = origWindow;
    }
  });
});

