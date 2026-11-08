const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  STORAGE_KEYS,
  settings,
  extractRedditVideosFromListing,
  extractVideoUrlsFromHtml,
  searchFreeTubeSites,
  parseM3u8Manifest,
  downloadAndAssembleM3u8Stream,
  syncAgeGateUI,
  openAgeGateModal,
  closeAgeGateModal,
  setAdultContentEnabled
} = require('../app.js');

describe('18+ Age Verification, HLS .M3U8 Snippet Stitcher & Free Tube Search Tests', () => {
  function setupMockAgeGateEnv() {
    const btnClasses = new Set();
    const modalClasses = new Set(['hidden']);
    const toastClasses = new Set(['hidden']);
    const storage = new Map();

    const headerBtn = {
      id: 'ageGateToggleBtn',
      textContent: '🔞 18+ Off',
      attrs: { 'aria-pressed': 'false' },
      classList: {
        toggle: (cls, force) => {
          const shouldAdd = typeof force === 'boolean' ? force : !btnClasses.has(cls);
          if (shouldAdd) btnClasses.add(cls);
          else btnClasses.delete(cls);
          return shouldAdd;
        },
        contains: (cls) => btnClasses.has(cls)
      },
      setAttribute(name, val) {
        this.attrs[name] = String(val);
      }
    };

    const nsfwCheckbox = {
      id: 'allowNsfwToggle',
      checked: false
    };

    const ageGateModal = {
      id: 'ageGateModal',
      classList: {
        add: (...tokens) => tokens.forEach((t) => modalClasses.add(t)),
        remove: (...tokens) => tokens.forEach((t) => modalClasses.delete(t)),
        contains: (t) => modalClasses.has(t)
      }
    };

    const toastEl = {
      id: 'toast',
      textContent: '',
      classList: {
        add: (...tokens) => tokens.forEach((t) => toastClasses.add(t)),
        remove: (...tokens) => tokens.forEach((t) => toastClasses.delete(t)),
        contains: (t) => toastClasses.has(t)
      }
    };

    globalThis.document = {
      getElementById: (id) => {
        if (id === 'ageGateToggleBtn') return headerBtn;
        if (id === 'allowNsfwToggle') return nsfwCheckbox;
        if (id === 'ageGateModal') return ageGateModal;
        if (id === 'toast') return toastEl;
        return null;
      }
    };

    globalThis.localStorage = {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    };

    return { headerBtn, nsfwCheckbox, ageGateModal, toastEl, storage };
  }

  describe('18+ Age Gate Toggle & Modal Verification', () => {
    const origAllowNsfw = settings.allowNsfw;

    it('should open and close the 18+ verification modal and sync UI state', () => {
      const { ageGateModal, headerBtn, nsfwCheckbox } = setupMockAgeGateEnv();
      settings.allowNsfw = false;

      assert.strictEqual(ageGateModal.classList.contains('hidden'), true);
      openAgeGateModal();
      assert.strictEqual(ageGateModal.classList.contains('hidden'), false);

      closeAgeGateModal();
      assert.strictEqual(ageGateModal.classList.contains('hidden'), true);
      assert.strictEqual(headerBtn.textContent, '🔞 18+ Off');
      assert.strictEqual(nsfwCheckbox.checked, false);
    });

    it('should enable and disable 18+ adult content, sync header button & checkbox, and persist setting', () => {
      const { headerBtn, nsfwCheckbox, toastEl, storage } = setupMockAgeGateEnv();

      setAdultContentEnabled(true);
      assert.strictEqual(settings.allowNsfw, true);
      assert.strictEqual(headerBtn.textContent, '🔞 18+ On');
      assert.strictEqual(headerBtn.classList.contains('active'), true);
      assert.strictEqual(headerBtn.attrs['aria-pressed'], 'true');
      assert.strictEqual(nsfwCheckbox.checked, true);
      assert.ok(toastEl.textContent.includes('18+ Adult Content Enabled'));

      const savedOn = JSON.parse(storage.get(STORAGE_KEYS.SETTINGS));
      assert.strictEqual(savedOn.allowNsfw, true);

      setAdultContentEnabled(false);
      assert.strictEqual(settings.allowNsfw, false);
      assert.strictEqual(headerBtn.textContent, '🔞 18+ Off');
      assert.strictEqual(headerBtn.classList.contains('active'), false);
      assert.strictEqual(headerBtn.attrs['aria-pressed'], 'false');
      assert.strictEqual(nsfwCheckbox.checked, false);
      assert.ok(toastEl.textContent.includes('Disabled'));

      const savedOff = JSON.parse(storage.get(STORAGE_KEYS.SETTINGS));
      assert.strictEqual(savedOff.allowNsfw, false);

      settings.allowNsfw = origAllowNsfw;
      syncAgeGateUI();
    });

    it('should allow over_18 Reddit video posts and url_overridden_by_dest links when allowNsfw is true', () => {
      settings.allowNsfw = true;
      const listing = {
        data: {
          children: [
            {
              data: {
                id: 'adult1',
                over_18: true,
                title: '18+ Direct Stream Clip',
                permalink: '/r/nsfw/comments/adult1',
                url_overridden_by_dest: 'https://media.example.com/adult-clip.mp4'
              }
            }
          ]
        }
      };

      const results = extractRedditVideosFromListing(listing, '18+ Feed');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'rd-adult1');
      assert.strictEqual(results[0].videoUrl, 'https://media.example.com/adult-clip.mp4');

      settings.allowNsfw = origAllowNsfw;
    });
  });

  describe('HLS .M3U8 Manifest Parser & Snippet Stitcher', () => {
    it('should parse Master .m3u8 playlists and select the preferred HD variant stream', () => {
      const masterText = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=650000,RESOLUTION=640x360',
        '360p/index.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=3200000,RESOLUTION=1280x720',
        '720p/index.m3u8',
        '#EXT-X-STREAM-INF:BANDWIDTH=9500000,RESOLUTION=3840x2160',
        '4k/index.m3u8'
      ].join('\n');

      const parsed = parseM3u8Manifest(masterText, 'https://stream.example.org/videos/master.m3u8');
      assert.strictEqual(parsed.type, 'master');
      assert.strictEqual(parsed.variants.length, 3);
      assert.strictEqual(
        parsed.preferredVariantUrl,
        'https://stream.example.org/videos/720p/index.m3u8',
        'Should prefer highest bandwidth <= 6 Mbps for mobile HD playback'
      );
    });

    it('should parse Media .m3u8 playlists with #EXT-X-MAP init header and ordered snippet URLs', () => {
      const mediaText = [
        '#EXTM3U',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MAP:URI="init-header.mp4"',
        '#EXTINF:4.000,',
        'seg-001.m4s?token=abc',
        '#EXTINF:4.000,',
        'seg-002.m4s?token=abc',
        '#EXT-X-ENDLIST'
      ].join('\n');

      const parsed = parseM3u8Manifest(mediaText, 'https://stream.example.org/videos/720p/index.m3u8');
      assert.strictEqual(parsed.type, 'media');
      assert.strictEqual(parsed.initSegmentUrl, 'https://stream.example.org/videos/720p/init-header.mp4');
      assert.deepStrictEqual(parsed.segments, [
        'https://stream.example.org/videos/720p/seg-001.m4s?token=abc',
        'https://stream.example.org/videos/720p/seg-002.m4s?token=abc'
      ]);
    });

    it('should safely handle null, empty, or non-string manifest inputs', () => {
      assert.strictEqual(parseM3u8Manifest(null, 'https://ex.com/a.m3u8').type, 'invalid');
      assert.strictEqual(parseM3u8Manifest('', 'https://ex.com/a.m3u8').type, 'invalid');
      assert.strictEqual(parseM3u8Manifest(12345, 'https://ex.com/a.m3u8').type, 'invalid');
    });

    it('should crawl a Master -> Media .m3u8 playlist and stitch binary snippets in exact sequence', async () => {
      const origFetch = globalThis.fetch;
      const progressUpdates = [];

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.endsWith('master.m3u8')) {
          return {
            ok: true,
            text: async () => '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nsub/playlist.m3u8\n'
          };
        }
        if (u.endsWith('sub/playlist.m3u8')) {
          return {
            ok: true,
            text: async () => '#EXTM3U\n#EXTINF:2.0,\nchunk1.ts\n#EXTINF:2.0,\nchunk2.ts\n'
          };
        }
        if (u.endsWith('chunk1.ts')) {
          return {
            ok: true,
            headers: { get: () => '3' },
            blob: async () => new Blob([new Uint8Array([10, 20, 30])], { type: 'video/mp2t' })
          };
        }
        if (u.endsWith('chunk2.ts')) {
          return {
            ok: true,
            headers: { get: () => '3' },
            blob: async () => new Blob([new Uint8Array([40, 50, 60])], { type: 'video/mp2t' })
          };
        }
        return { ok: false, status: 404 };
      };

      try {
        const result = await downloadAndAssembleM3u8Stream(
          'https://cdn.example.com/hls/master.m3u8',
          (label, pct) => progressUpdates.push({ label, pct })
        );

        assert.strictEqual(result.ext, 'ts');
        assert.strictEqual(result.mime, 'video/mp2t');
        const bytes = new Uint8Array(await result.blob.arrayBuffer());
        assert.deepStrictEqual([...bytes], [10, 20, 30, 40, 50, 60]);
        assert.ok(progressUpdates.length >= 2, 'Should report live stitching progress');
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe('Free Tube Sites HTML/Script Decoder & Search Engine', () => {
    const origAllowNsfw = settings.allowNsfw;

    it('should decode JSON-escaped slashes and unicode escapes inside inline <script> player configs and prioritize full streams over previews', () => {
      const sampleTubeHtml = `
        <html>
          <head><title>Sample Tube Video</title></head>
          <body>
            <script>
              window.playerConfig = {
                "thumb_preview": "https:\\/\\/cdn.tubesite.org\\/previews\\/thumb_preview.mp4",
                "video_url": "https:\\/\\/cdn.tubesite.org\\/videos\\/full_hd_1080p.mp4?sig=abc\\u0026exp=999",
                "hls_url": "https:\\\\u002F\\\\u002Fcdn.tubesite.org\\\\u002Fhls\\\\u002Fstream.m3u8"
              };
            </script>
          </body>
        </html>
      `;

      const extracted = extractVideoUrlsFromHtml(sampleTubeHtml, 'https://tubesite.org/watch/1');
      assert.strictEqual(
        extracted[0],
        'https://cdn.tubesite.org/videos/full_hd_1080p.mp4?sig=abc&exp=999',
        'Full HD stream should be prioritized ahead of thumb_preview.mp4'
      );
      assert.ok(
        extracted.includes('https://cdn.tubesite.org/previews/thumb_preview.mp4'),
        'Preview URL should still be retained at the end as fallback'
      );
    });

    it('should query Dailymotion & 18+ Free Tube APIs when allowNsfw is enabled', async () => {
      const origFetch = globalThis.fetch;
      settings.allowNsfw = true;

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('api.dailymotion.com/videos')) {
          return {
            ok: true,
            json: async () => ({
              list: [
                {
                  id: 'dm123',
                  title: 'Dailymotion Sample Clip',
                  url: 'https://www.dailymotion.com/video/dm123',
                  stream_h264_url: 'https://proxy.dailymotion.com/video/dm123.mp4'
                }
              ]
            })
          };
        }
        if (u.includes('eporner.com/api/v2/video/search')) {
          return {
            ok: true,
            json: async () => ({
              videos: [
                {
                  id: 'ep999',
                  title: 'Eporner API Sample Video',
                  url: 'https://www.eporner.com/video-ep999/',
                  embed: 'https://www.eporner.com/embed/ep999/'
                }
              ]
            })
          };
        }
        if (u.includes('eporner.com/embed/ep999')) {
          return {
            ok: true,
            text: async () => '<script>var src = "https:\\/\\/cdn.eporner.com\\/streams\\/ep999_720p.mp4";</script>'
          };
        }
        if (u.includes('reddit.com/search.json')) {
          return {
            ok: true,
            json: async () => ({ data: { children: [] } })
          };
        }
        return { ok: false, status: 404 };
      };

      try {
        const items = await searchFreeTubeSites('testquery', 4);
        assert.ok(items.some((i) => i.id === 'dm-dm123' && i.videoUrl.endsWith('dm123.mp4')));
        assert.ok(items.some((i) => i.id === 'ep-ep999' && i.videoUrl.endsWith('ep999_720p.mp4')));
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
      }
    });
  });
});
