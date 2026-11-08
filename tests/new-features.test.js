const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORAGE_KEYS,
  settings,
  extractRedditVideosFromListing,
  searchRedditVideosByKeyword,
  searchRedgifsVideos,
  searchWikimediaVideos,
  extractVideoUrlsFromHtml,
  extractCandidateWebPagesFromSearchHtml,
  searchOpenWebVideos,
  searchFreeTubeSites,
  searchInternetArchive,
  handleVideoPlaybackError,
  parseM3u8Manifest,
  downloadAndAssembleM3u8Stream,
  formatVideoTime,
  updateReelsSeekerUI,
  seekVideoToPercent,
  toggleReelsFullscreen,
  animateReelsSlide,
  getAppState,
  setAppState,
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

    it('should query Dailymotion in Safe Mode and exclusively 18+ Free Tube APIs when allowNsfw is enabled', async () => {
      const origFetch = globalThis.fetch;

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
        settings.allowNsfw = false;
        const sfwItems = await searchFreeTubeSites('testquery', 4);
        assert.ok(sfwItems.some((i) => i.id === 'dm-dm123' && i.videoUrl.endsWith('dm123.mp4')));
        assert.ok(!sfwItems.some((i) => i.id === 'ep-ep999'));

        settings.allowNsfw = true;
        const nsfwItems = await searchFreeTubeSites('testquery', 4);
        assert.ok(!nsfwItems.some((i) => i.id === 'dm-dm123'), 'Safe Dailymotion clips should be excluded in 18+ Mode');
        assert.ok(nsfwItems.some((i) => i.id === 'ep-ep999' && i.videoUrl.endsWith('ep999_720p.mp4')));
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
      }
    });
  });

  describe('Fullscreen Reels Video Seeker & Non-Overlapping Unblurred UI Layout', () => {
    it('should format video timestamps accurately across seconds, minutes, hours, and edge inputs', () => {
      assert.strictEqual(formatVideoTime(0), '0:00');
      assert.strictEqual(formatVideoTime(9), '0:09');
      assert.strictEqual(formatVideoTime(78.9), '1:18');
      assert.strictEqual(formatVideoTime(272), '4:32');
      assert.strictEqual(formatVideoTime(3665), '1:01:05');
      assert.strictEqual(formatVideoTime(-5), '0:00');
      assert.strictEqual(formatVideoTime(NaN), '0:00');
      assert.strictEqual(formatVideoTime(null), '0:00');
    });

    it('should sync Fullscreen Reels seeker slider, timestamps, and play/mute buttons and seek video by percent', () => {
      const origDoc = globalThis.document;
      const styleProps = {};
      const elements = {
        mainVideo: {
          currentTime: 45,
          duration: 180,
          paused: false,
          muted: true
        },
        reelsSeekSlider: {
          value: '0',
          style: {
            setProperty: (k, v) => {
              styleProps[k] = v;
            }
          }
        },
        reelsCurrentTime: { textContent: '0:00' },
        reelsDuration: { textContent: '0:00' },
        reelsPlayPauseBtn: { textContent: '▶', setAttribute() {} },
        reelsMuteBtn: { textContent: '🔊', setAttribute() {} }
      };

      globalThis.document = {
        getElementById: (id) => elements[id] || null
      };

      try {
        setAppState({
          videoQueue: [{ id: 'v1', title: 'Test Reel', videoUrl: 'https://example.com/v1.mp4' }],
          currentIndex: 0
        });

        updateReelsSeekerUI();
        assert.strictEqual(elements.reelsCurrentTime.textContent, '0:45');
        assert.strictEqual(elements.reelsDuration.textContent, '3:00');
        assert.strictEqual(elements.reelsSeekSlider.value, '25');
        assert.strictEqual(styleProps['--seek-pct'], '25.0%');
        assert.strictEqual(elements.reelsPlayPauseBtn.textContent, '⏸');
        assert.strictEqual(elements.reelsMuteBtn.textContent, '🔇');

        const targetSec = seekVideoToPercent(50);
        assert.strictEqual(targetSec, 90);
        assert.strictEqual(elements.mainVideo.currentTime, 90);
        assert.strictEqual(elements.reelsCurrentTime.textContent, '1:30');
        assert.strictEqual(elements.reelsSeekSlider.value, '50');
        assert.strictEqual(styleProps['--seek-pct'], '50.0%');
      } finally {
        globalThis.document = origDoc;
      }
    });

    it('should ensure top header is not blurred, bottom bar does not cover video, and fullscreen seeker exists in DOM', () => {
      const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
      const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

      assert.ok(html.includes('id="reelsSeekerBar"'), 'index.html should contain #reelsSeekerBar');
      assert.ok(html.includes('id="reelsSeekSlider"'), 'index.html should contain #reelsSeekSlider');
      assert.ok(
        html.includes('name="apple-mobile-web-app-status-bar-style" content="black"'),
        'Status bar style should be black so iOS does not apply translucent blur over top header'
      );
      assert.ok(
        !css.includes('backdrop-filter: blur('),
        'styles.css should not apply backdrop-filter blur to top header, bottom bar, or HUD'
      );
      assert.ok(
        css.includes('.bottom-nav {\n  position: relative;\n  flex-shrink: 0;'),
        '.bottom-nav should be a non-overlapping flex item so it never covers the video'
      );
    });

    it('should fill the screen in phone landscape and scale across iPad portrait and landscape without a 520px width cap', () => {
      const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
      const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));

      assert.strictEqual(manifest.orientation, 'any', 'manifest.json should allow both portrait and landscape orientations');
      assert.ok(html.includes('id="videoControlsPanel"'), 'index.html should contain #videoControlsPanel for split landscape/iPad layout');
      assert.ok(!css.includes('max-width: 520px'), 'styles.css should not cap .app-container or .bottom-nav to 520px');
      assert.ok(css.includes('env(safe-area-inset-left'), 'styles.css should respect horizontal safe-area-inset-left in landscape');
      assert.ok(css.includes('env(safe-area-inset-right'), 'styles.css should respect horizontal safe-area-inset-right in landscape');
      assert.ok(css.includes('@media (orientation: landscape)'), 'styles.css should include phone landscape responsive breakpoint');
      assert.ok(css.includes('@media (min-width: 768px)'), 'styles.css should include iPad/tablet responsive breakpoint');
      assert.ok(
        css.includes('.brand > div {\n  flex: 1 1 0%;\n  min-width: 0;\n  overflow: hidden;\n}'),
        '.brand > div must have min-width: 0 and overflow: hidden so #activeSourceSummary never overlaps #panicSafeBtn'
      );
      assert.ok(
        css.includes('.setting-row > div:first-child {\n  flex: 1 1 0%;\n  min-width: 0;\n}'),
        '.setting-row > div:first-child must have min-width: 0 so setting descriptions never overlap selects/switches'
      );
    });

    it('should completely hide top header and bottom nav in Fullscreen Reels Mode and animate TikTok-style vertical slide transitions', () => {
      const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
      assert.ok(
        css.includes('body.reels-mode-active .app-header') &&
          css.includes('body.reels-mode-active .bottom-nav') &&
          css.includes('display: none !important;'),
        'styles.css should hide .app-header and .bottom-nav with display: none !important when reels-mode-active is set'
      );
      assert.ok(
        css.includes('.video-stage.reels-fullscreen {\n  position: fixed !important;\n  inset: 0 !important;'),
        '.video-stage.reels-fullscreen must use position: fixed !important; inset: 0 !important; to cover the entire screen'
      );

      const origDoc = globalThis.document;
      const makeClassList = (initial = []) => {
        const set = new Set(initial);
        return {
          add: (...c) => c.forEach((x) => set.add(x)),
          remove: (...c) => c.forEach((x) => set.delete(x)),
          toggle: (c, force) => {
            const add = typeof force === 'boolean' ? force : !set.has(c);
            if (add) set.add(c);
            else set.delete(c);
            return add;
          },
          contains: (c) => set.has(c)
        };
      };

      const makeStubEl = () => ({
        textContent: '',
        innerHTML: '',
        value: '',
        href: '',
        src: '',
        disabled: false,
        controls: true,
        muted: true,
        paused: false,
        currentTime: 0,
        duration: 60,
        dataset: {},
        style: { transition: '', transform: '', opacity: '', setProperty() {} },
        classList: makeClassList(),
        load() {},
        play: () => Promise.resolve(),
        pause() {},
        setAttribute() {},
        removeAttribute() {},
        addEventListener() {}
      });

      const elements = {
        videoStage: makeStubEl(),
        reelsHudOverlay: makeStubEl(),
        appHeader: makeStubEl(),
        bottomNav: makeStubEl(),
        appContainer: makeStubEl(),
        mainVideo: makeStubEl()
      };
      elements.reelsHudOverlay.classList.add('hidden');

      globalThis.document = {
        body: { classList: makeClassList(), appendChild() {} },
        createElement: () => makeStubEl(),
        getElementById: (id) => {
          if (!elements[id]) elements[id] = makeStubEl();
          return elements[id];
        },
        querySelector: (sel) => {
          if (sel === '.bottom-nav') return elements.bottomNav;
          if (sel === '.app-container') return elements.appContainer;
          return makeStubEl();
        },
        querySelectorAll: () => []
      };

      try {
        setAppState({
          videoQueue: [
            { id: 'r1', title: 'Reel 1', videoUrl: 'https://example.com/1.mp4', sourceName: 'Test' },
            { id: 'r2', title: 'Reel 2', videoUrl: 'https://example.com/2.mp4', sourceName: 'Test' }
          ],
          currentIndex: 0
        });

        toggleReelsFullscreen(true);
        assert.strictEqual(elements.appHeader.classList.contains('hidden'), true, '#appHeader should have .hidden in Fullscreen Reels Mode');
        assert.strictEqual(elements.bottomNav.classList.contains('hidden'), true, '.bottom-nav should have .hidden in Fullscreen Reels Mode');
        assert.strictEqual(globalThis.document.body.classList.contains('reels-mode-active'), true, 'body should have .reels-mode-active');

        const slidNext = animateReelsSlide('next');
        assert.strictEqual(slidNext, true, 'animateReelsSlide("next") should return true');
        assert.strictEqual(getAppState().currentIndex, 1, 'Queue should advance to index 1');

        const slidPrev = animateReelsSlide('prev');
        assert.strictEqual(slidPrev, true, 'animateReelsSlide("prev") should return true when going back');
        assert.strictEqual(getAppState().currentIndex, 0, 'Queue should return to index 0');

        toggleReelsFullscreen(false);
        assert.strictEqual(elements.appHeader.classList.contains('hidden'), false, '#appHeader should be unhidden when exiting Fullscreen Reels Mode');
        assert.strictEqual(elements.bottomNav.classList.contains('hidden'), false, '.bottom-nav should be unhidden when exiting Fullscreen Reels Mode');
        assert.strictEqual(globalThis.document.body.classList.contains('reels-mode-active'), false, 'body should remove .reels-mode-active');
      } finally {
        globalThis.document = origDoc;
      }
    });

    it('should snap back at the top of the feed on upward pull (prev at index 0) and strip native video controls in Fullscreen Reels Mode', () => {
      const origDoc = globalThis.document;
      const origRaf = globalThis.requestAnimationFrame;
      const removedAttrs = [];
      const setAttrs = [];

      const makeClassList = (initial = []) => {
        const set = new Set(initial);
        return {
          add: (...c) => c.forEach((x) => set.add(x)),
          remove: (...c) => c.forEach((x) => set.delete(x)),
          toggle: (c, force) => {
            const add = typeof force === 'boolean' ? force : !set.has(c);
            if (add) set.add(c);
            else set.delete(c);
            return add;
          },
          contains: (c) => set.has(c)
        };
      };

      const makeStubEl = () => ({
        textContent: '',
        innerHTML: '',
        value: '',
        href: '',
        src: '',
        disabled: false,
        controls: true,
        muted: true,
        paused: false,
        currentTime: 0,
        duration: 60,
        dataset: {},
        style: { transition: '', transform: '', opacity: '', setProperty() {} },
        classList: makeClassList(),
        load() {},
        play: () => Promise.resolve(),
        pause() {},
        setAttribute(k, v) {
          setAttrs.push([k, v]);
        },
        removeAttribute(k) {
          removedAttrs.push(k);
        },
        addEventListener() {}
      });

      const elements = {
        videoStage: makeStubEl(),
        reelsHudOverlay: makeStubEl(),
        appHeader: makeStubEl(),
        bottomNav: makeStubEl(),
        appContainer: makeStubEl(),
        appMain: makeStubEl(),
        mainVideo: makeStubEl(),
        toast: makeStubEl()
      };
      elements.reelsHudOverlay.classList.add('hidden');
      elements.toast.classList.add('hidden');

      // Synchronous requestAnimationFrame so we can verify slide-in transform completion
      let immediateRaf = false;
      globalThis.requestAnimationFrame = (cb) => {
        if (immediateRaf) cb();
        return 1;
      };

      globalThis.document = {
        body: { classList: makeClassList(), appendChild() {} },
        createElement: () => makeStubEl(),
        getElementById: (id) => {
          if (!elements[id]) elements[id] = makeStubEl();
          return elements[id];
        },
        querySelector: (sel) => {
          if (sel === '.bottom-nav') return elements.bottomNav;
          if (sel === '.app-container') return elements.appContainer;
          if (sel === '.app-main') return elements.appMain;
          return makeStubEl();
        },
        querySelectorAll: () => []
      };

      try {
        setAppState({
          videoQueue: [
            { id: 'r1', title: 'Reel 1', videoUrl: 'https://example.com/1.mp4', sourceName: 'Test' },
            { id: 'r2', title: 'Reel 2', videoUrl: 'https://example.com/2.mp4', sourceName: 'Test' }
          ],
          currentIndex: 0
        });

        toggleReelsFullscreen(true);
        assert.strictEqual(elements.mainVideo.controls, false, 'Native video controls should be disabled in Fullscreen Reels Mode');
        assert.ok(removedAttrs.includes('controls'), 'controls attribute should be removed from #mainVideo in Fullscreen Reels Mode');
        assert.strictEqual(elements.appMain.classList.contains('reels-mode-active'), true, '.app-main should have .reels-mode-active');

        // Attempting to swipe down ("prev") at index 0 should snap back and return false
        elements.mainVideo.style.transform = 'translate3d(0, 60px, 0)';
        const prevAtTop = animateReelsSlide('prev');
        assert.strictEqual(prevAtTop, false, 'animateReelsSlide("prev") at index 0 should return false');
        assert.strictEqual(getAppState().currentIndex, 0, 'currentIndex should remain 0 at top of feed');
        assert.strictEqual(elements.mainVideo.style.transform, 'translate3d(0, 0, 0)', '#mainVideo should snap back to 0px');
        assert.ok(elements.toast.textContent.includes('Top of feed'), 'Toast should notify user they are at the top of the feed');

        // Swiping up ("next") with deferred rAF should position video at +82% before sliding in
        immediateRaf = false;
        animateReelsSlide('next');
        assert.strictEqual(elements.mainVideo.style.transform, 'translate3d(0, 82%, 0)', 'Next reel should start at +82% Y offset');
        assert.strictEqual(elements.mainVideo.style.opacity, '0.45', 'Next reel should start at 0.45 opacity');

        // With immediate rAF, slide-in settles at translate3d(0, 0, 0) and opacity 1
        immediateRaf = true;
        animateReelsSlide('prev');
        assert.strictEqual(elements.mainVideo.style.transform, 'translate3d(0, 0, 0)', 'Slide-in should settle at translate3d(0, 0, 0)');
        assert.strictEqual(elements.mainVideo.style.opacity, '1', 'Slide-in should settle at opacity 1');

        toggleReelsFullscreen(false);
        assert.strictEqual(elements.mainVideo.controls, true, 'Native video controls should be restored on exit');
        assert.ok(setAttrs.some(([k]) => k === 'controls'), 'controls attribute should be restored on exit');
      } finally {
        globalThis.document = origDoc;
        globalThis.requestAnimationFrame = origRaf;
      }
    });

    it('should enforce proper CSS media query cascade so phone landscape is not overridden by iPad breakpoint and header text truncates cleanly', () => {
      const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

      const ipadLandscapeIdx = css.indexOf('(min-width: 768px) and (min-height: 581px) and (orientation: landscape)');
      const phoneLandscapeIdx = css.indexOf('@media (orientation: landscape) and (max-height: 580px)');

      assert.ok(ipadLandscapeIdx !== -1, 'iPad landscape media query should require min-height: 581px');
      assert.ok(phoneLandscapeIdx !== -1, 'Phone landscape media query should target max-height: 580px');
      assert.ok(
        phoneLandscapeIdx > ipadLandscapeIdx,
        'Phone landscape media query must appear after iPad media queries so wide phones (e.g. 844x390) are never overridden'
      );

      assert.ok(
        css.includes('.subtitle {\n  display: block;\n  max-width: 100%;\n  font-size: 0.73rem;\n  color: var(--text-muted);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;'),
        'Header .subtitle (#activeSourceSummary) must truncate with ellipsis instead of overlapping action buttons'
      );
      assert.ok(
        css.includes('touch-action: none;'),
        '.video-stage.reels-fullscreen must set touch-action: none for 1:1 vertical swipe tracking'
      );
      assert.ok(
        !css.includes('min-height: 480px;'),
        'iPad Pro media query must not force .video-stage to min-height: 480px which overflows .video-card on shorter viewports'
      );
      assert.ok(
        css.includes('@media (min-width: 768px) and (min-height: 581px) and (max-height: 820px)'),
        'styles.css should include compact vertical spacing for tablet landscape with browser toolbars (581px–820px) so the top search bar is never clipped'
      );
    });

    it('should prefer Archive.org H.264 .ia.mp4 web derivative for iOS playback and skip private/restricted items', async () => {
      const origFetch = globalThis.fetch;
      const origFormatMode = settings.formatMode;
      settings.formatMode = 'all';

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('advancedsearch.php')) {
          return {
            ok: true,
            json: async () => ({
              response: {
                docs: [
                  { identifier: 'restricted-item', title: 'Restricted Video' },
                  { identifier: 'jaybbgirl-red-top', title: 'Red top' }
                ]
              }
            })
          };
        }
        if (u.includes('/metadata/restricted-item')) {
          return {
            ok: true,
            json: async () => ({
              is_dark: true,
              files: [{ name: 'secret.mp4', size: '5000000' }]
            })
          };
        }
        if (u.includes('/metadata/jaybbgirl-red-top')) {
          return {
            ok: true,
            json: async () => ({
              files: [
                { name: 'private-clip.mp4', size: '4000000', private: 'true' },
                { name: 'Red top.mp4', size: '12000000', source: 'original', format: 'MPEG4' },
                { name: 'Red top.ia.mp4', size: '8500000', source: 'derivative', format: 'h.264 IA' }
              ]
            })
          };
        }
        return { ok: false };
      };

      try {
        const items = await searchInternetArchive('Jaybbgirl', 3);
        assert.strictEqual(items.length, 1, 'Should skip dark/restricted item and return the playable item');
        assert.strictEqual(items[0].title, 'Red top');
        assert.strictEqual(
          items[0].videoUrl,
          'https://archive.org/download/jaybbgirl-red-top/Red%20top.ia.mp4',
          'Should select the fast-start H.264 .ia.mp4 derivative as primary videoUrl for iOS Safari'
        );
        assert.strictEqual(
          items[0].convertedUrl,
          'https://archive.org/download/jaybbgirl-red-top/Red%20top.mp4',
          'Should retain the alternate MP4 URL in convertedUrl as fallback'
        );
      } finally {
        globalThis.fetch = origFetch;
        settings.formatMode = origFormatMode;
      }
    });

    it('should automatically recover on playback error by trying convertedUrl first and skipping dead streams to a working video', async () => {
      const origDoc = globalThis.document;
      const origAutoConvert = settings.autoConvert;
      settings.autoConvert = false;

      const makeClassList = (initial = []) => {
        const set = new Set(initial);
        return {
          add: (...c) => c.forEach((x) => set.add(x)),
          remove: (...c) => c.forEach((x) => set.delete(x)),
          toggle: (c, force) => {
            const add = typeof force === 'boolean' ? force : !set.has(c);
            if (add) set.add(c);
            else set.delete(c);
            return add;
          },
          contains: (c) => set.has(c)
        };
      };

      const makeStubEl = () => ({
        textContent: '',
        innerHTML: '',
        value: '',
        href: '',
        src: '',
        disabled: false,
        controls: true,
        muted: true,
        paused: false,
        currentTime: 0,
        duration: 60,
        dataset: {},
        style: { width: '0%', setProperty() {} },
        classList: makeClassList(),
        load() {},
        play: () => Promise.resolve(),
        pause() {},
        setAttribute() {},
        removeAttribute() {},
        addEventListener() {}
      });

      const elements = {
        mainVideo: makeStubEl(),
        toast: makeStubEl()
      };

      globalThis.document = {
        body: { classList: makeClassList(), appendChild() {} },
        createElement: () => makeStubEl(),
        getElementById: (id) => {
          if (!elements[id]) elements[id] = makeStubEl();
          return elements[id];
        },
        querySelector: () => makeStubEl(),
        querySelectorAll: () => []
      };

      try {
        setAppState({
          videoQueue: [
            {
              id: 'broken-1',
              title: 'Red top',
              videoUrl: 'https://archive.org/download/item/raw.mp4',
              convertedUrl: 'https://archive.org/download/item/stream.ia.mp4',
              format: 'mp4',
              sourceName: 'Archive.org (Jaybbgirl)'
            },
            {
              id: 'working-2',
              title: 'Working Clip',
              videoUrl: 'https://example.com/working.mp4',
              format: 'mp4',
              sourceName: 'RedGIFs HD'
            }
          ],
          currentIndex: 0
        });

        elements.mainVideo.src = 'https://archive.org/download/item/raw.mp4';
        elements.mainVideo.dataset.triedConvertedUrl = 'false';

        // 1st error on broken-1 should switch to convertedUrl (.ia.mp4)
        const recoveredViaDeriv = await handleVideoPlaybackError();
        assert.strictEqual(recoveredViaDeriv, true);
        assert.strictEqual(
          elements.mainVideo.src,
          'https://archive.org/download/item/stream.ia.mp4',
          'First error should immediately fall back to convertedUrl'
        );

        // If convertedUrl also fails (2nd error), it should remove broken-1 from queue and load working-2
        const recoveredViaSkip = await handleVideoPlaybackError();
        assert.strictEqual(recoveredViaSkip, true);
        assert.strictEqual(getAppState().videoQueue.length, 1, 'Dead video should be removed from videoQueue');
        assert.strictEqual(getAppState().videoQueue[0].id, 'working-2', 'Next working video should become active');
        assert.strictEqual(elements.mainVideo.src, 'https://example.com/working.mp4');
      } finally {
        globalThis.document = origDoc;
        settings.autoConvert = origAutoConvert;
      }
    });

    it('should find creator/subreddit videos on Reddit even when title search returns empty, and fallback on RedGIFs & Wikimedia', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origFormatMode = settings.formatMode;
      const origDuration = settings.tubeDurationFilter;

      settings.allowNsfw = true;
      settings.formatMode = 'mp4';
      settings.tubeDurationFilter = 'long';

      globalThis.fetch = async (url) => {
        const u = String(url);
        // 1. Reddit global search returns empty, but u/Jaybbgirl/submitted.json has a video post
        if (u.includes('reddit.com/search.json')) {
          return { ok: true, json: async () => ({ data: { children: [] } }) };
        }
        if (u.includes('reddit.com/r/Jaybbgirl/')) {
          return { ok: true, json: async () => ({ data: { children: [] } }) };
        }
        if (u.includes('reddit.com/user/Jaybbgirl/submitted.json')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                children: [
                  {
                    data: {
                      id: 'u1',
                      title: 'Creator Profile Clip',
                      over_18: true,
                      permalink: '/r/u_Jaybbgirl/comments/u1',
                      media_metadata: {
                        g1: { s: { mp4: 'https://i.redd.it/gallery_clip.mp4?a=1&amp;b=2' } }
                      }
                    }
                  }
                ]
              }
            })
          };
        }

        // 2. RedGIFs trending search returns empty, but order=best returns a clip
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/search') && u.includes('order=trending')) {
          return { ok: true, json: async () => ({ gifs: [] }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/search') && u.includes('order=best')) {
          return {
            ok: true,
            json: async () => ({
              gifs: [
                {
                  id: 'nicheclip1',
                  duration: 19,
                  tags: ['Niche', 'Creator'],
                  urls: { hd: 'https://thumbs4.redgifs.com/NicheClip1.mp4' }
                }
              ]
            })
          };
        }
        if (u.includes('api.redgifs.com/v2/users/')) {
          return { ok: true, json: async () => ({ gifs: [] }) };
        }

        // 3. Wikimedia returns a .webm original with a server-transcoded .mp4 derivative while formatMode === 'mp4'
        if (u.includes('commons.wikimedia.org/w/api.php')) {
          return {
            ok: true,
            json: async () => ({
              query: {
                pages: {
                  101: {
                    pageid: 101,
                    title: 'File:Ocean_Wave.webm',
                    videoinfo: [
                      {
                        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Ocean_Wave.webm',
                        derivatives: [
                          {
                            src: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/Ocean_Wave.webm/Ocean_Wave.webm.720p.mp4',
                            type: 'video/mp4'
                          }
                        ]
                      }
                    ]
                  }
                }
              }
            })
          };
        }

        return { ok: false, status: 404 };
      };

      try {
        const redditHits = await searchRedditVideosByKeyword('Jaybbgirl');
        assert.strictEqual(redditHits.length, 1, 'Should pull from u/<handle>/submitted.json when title search is empty');
        assert.strictEqual(redditHits[0].videoUrl, 'https://i.redd.it/gallery_clip.mp4?a=1&b=2');

        const rgHits = await searchRedgifsVideos('Jaybbgirl', 4);
        assert.strictEqual(
          rgHits.length,
          1,
          'Should fall back from order=trending to order=best and not be wiped out by tubeDurationFilter="long"'
        );
        assert.strictEqual(rgHits[0].videoUrl, 'https://thumbs4.redgifs.com/NicheClip1.mp4');

        const wikiHits = await searchWikimediaVideos('ocean', 4);
        assert.strictEqual(
          wikiHits.length,
          1,
          'Should use Wikimedia server-transcoded .mp4 derivative when formatMode is set to mp4'
        );
        assert.ok(wikiHits[0].videoUrl.endsWith('.720p.mp4'));
        assert.strictEqual(wikiHits[0].format, 'mp4');
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.formatMode = origFormatMode;
        settings.tubeDurationFilter = origDuration;
      }
    });

    it('extractCandidateWebPagesFromSearchHtml & searchOpenWebVideos discover and crawl public sites and tube pages across the open web', async () => {
      const sampleSearchHtml = `
        <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent('https://publictube.example.org/videos/12345/sample-clip')}&rut=abc">Sample Tube Page</a>
        <a class="result__a" href="https://cdn.publicvideos.example.com/media/direct-clip.mp4">Direct MP4</a>
        <a class="result__a" href="https://www.youtube.com/watch?v=ignored">Ignored Walled Garden</a>
      `;
      const extracted = extractCandidateWebPagesFromSearchHtml(sampleSearchHtml);
      assert.ok(Array.isArray(extracted));
      assert.ok(
        extracted.includes('https://cdn.publicvideos.example.com/media/direct-clip.mp4'),
        'Should include direct video URLs'
      );
      assert.ok(
        extracted.includes('https://publictube.example.org/videos/12345/sample-clip'),
        'Should decode uddg= redirect URLs and keep public tube watch pages'
      );
      assert.ok(
        !extracted.some((u) => u.includes('youtube.com')),
        'Should filter out non-direct walled gardens'
      );

      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origFormatMode = settings.formatMode;
      try {
        settings.allowNsfw = true;
        settings.formatMode = 'any';

        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('html.duckduckgo.com')) {
            return {
              ok: true,
              status: 200,
              text: async () => sampleSearchHtml,
              json: async () => ({}),
            };
          }
          if (u.includes('publictube.example.org/videos/12345/sample-clip')) {
            return {
              ok: true,
              status: 200,
              text: async () => `
                <html>
                  <head>
                    <title>Discovered Tube Clip - PublicTube</title>
                    <meta property="og:image" content="https://publictube.example.org/thumbs/12345.jpg" />
                  </head>
                  <body>
                    <script>
                      var playerConfig = {
                        "quality_720p": "https://cdn.publictube.example.org/streams/12345_720p.mp4"
                      };
                    </script>
                  </body>
                </html>
              `,
            };
          }
          if (u.includes('reddit.com/search.json')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                data: {
                  children: [
                    {
                      data: {
                        title: 'External Host Clip',
                        subreddit: 'videos',
                        url_overridden_by_dest: 'https://files.catbox.moe/openweb123.mp4',
                        thumbnail: 'https://thumbs.example.org/catbox.jpg',
                      },
                    },
                  ],
                },
              }),
            };
          }
          return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
        };

        const hits = await searchOpenWebVideos('sample clip', 6);
        assert.ok(hits.length >= 2, `Expected at least 2 open-web videos, got ${hits.length}`);
        const urls = hits.map((h) => h.videoUrl);
        assert.ok(
          urls.includes('https://cdn.publicvideos.example.com/media/direct-clip.mp4'),
          'Should include direct video link from search results'
        );
        assert.ok(
          urls.includes('https://cdn.publictube.example.org/streams/12345_720p.mp4'),
          'Should crawl discovered public tube watch page and extract quality_720p stream URL'
        );
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.formatMode = origFormatMode;
      }
    });
  });
});

