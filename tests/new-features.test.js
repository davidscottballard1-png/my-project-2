const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  STORAGE_KEYS,
  DEFAULT_SOURCES,
  ADULT_PRESET_SOURCES,
  settings,
  extractRedditVideosFromListing,
  fetchSubredditVideos,
  searchRedditVideosByKeyword,
  searchRedgifsVideos,
  searchWikimediaVideos,
  extractVideoUrlsFromHtml,
  scanUrlForVideos,
  extractCandidateWebPagesFromSearchHtml,
  searchOpenWebVideos,
  searchFreeTubeSites,
  isPeerTubeSource,
  isPeerTubeExplicitlyEnabled,
  pullFromSource,
  pullRandomVideos,
  runContinuousPullCycle,
  startContinuousBackgroundPuller,
  stopContinuousBackgroundPuller,
  searchInternetArchive,
  handleVideoPlaybackError,
  parseM3u8Manifest,
  downloadAndAssembleM3u8Stream,
  formatVideoTime,
  updateReelsSeekerUI,
  seekVideoToPercent,
  toggleReelsFullscreen,
  animateReelsSlide,
  getEffectiveActiveSources,
  syncQueueAfterSourceChange,
  fetchDirectEpornerVideos,
  upgradeUnsignedRedgifsItems,
  armPlaybackStartupWatchdog,
  clearPlaybackStartupWatchdog,
  rescueDeadVideoStream,
  restorePlaybackState,
  updatePlayerUI,
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
      assert.match(
        css,
        /\.vli-header\s*\{[^}]*flex-direction:\s*column/s,
        '.vli-header should stack vertically so .vli-badges never crushes .vli-title into a 1-character vertical column'
      );
      assert.match(
        css,
        /\.vli-title\s*\{[^}]*width:\s*100%/s,
        '.vli-title should span 100% card width horizontally'
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

    it('should NOT query PeerTube unless a PeerTube source is enabled or #engPeerTube is checked, and should route dedicated presets to their target networks', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origSources = getAppState().sources;

      try {
        settings.allowNsfw = true;
        setAppState({
          sources: [
            {
              id: 'src-nsfw-redgifs',
              type: 'keyword',
              value: 'redgifs',
              label: '🔞 RedGIFs HD Trending',
              enabled: true,
              isNsfw: true
            }
          ]
        });

        // Ensure #engPeerTube is unchecked
        const prevDoc = globalThis.document;
        globalThis.document = {
          getElementById: (id) => (id === 'engPeerTube' ? { checked: false } : null)
        };

        assert.strictEqual(isPeerTubeExplicitlyEnabled(), false, 'PeerTube should be disabled when not selected');

        const queriedUrls = [];
        globalThis.fetch = async (url) => {
          const u = String(url);
          queriedUrls.push(u);

          if (u.includes('sepiasearch.org')) {
            return {
              ok: true,
              json: async () => ({
                data: [
                  {
                    uuid: 'pt-123',
                    name: 'PeerTube Clip',
                    account: { host: 'peertube.example.org' }
                  }
                ]
              })
            };
          }
          if (u.includes('peertube.example.org/api/v1/videos/pt-123')) {
            return {
              ok: true,
              json: async () => ({
                name: 'PeerTube Clip',
                files: [{ fileDownloadUrl: 'https://peertube.example.org/static/pt-123.mp4', size: 1000000 }]
              })
            };
          }
          if (u.includes('api.redgifs.com/v2/auth/temporary')) {
            return { ok: true, json: async () => ({ token: 'tok' }) };
          }
          // Simulate trending returning empty so 'redgifs' preset exercises the fallback to order=best / Reddit
          if (u.includes('api.redgifs.com/v2/gifs/search') && u.includes('order=trending')) {
            return { ok: true, json: async () => ({ gifs: [] }) };
          }
          if (u.includes('api.redgifs.com/v2/gifs/search') && u.includes('order=best')) {
            return {
              ok: true,
              json: async () => ({
                gifs: [
                  {
                    id: 'rgbest1',
                    duration: 14,
                    tags: ['Trending'],
                    urls: { hd: 'https://thumbs4.redgifs.com/RgBest1.mp4' }
                  }
                ]
              })
            };
          }
          if (u.includes('reddit.com/search.json')) {
            return {
              ok: true,
              json: async () => ({
                data: {
                  children: [
                    {
                      data: {
                        id: 'rd1',
                        title: 'Reddit Clip',
                        over_18: true,
                        url_overridden_by_dest: 'https://i.redd.it/reddit_clip.mp4'
                      }
                    }
                  ]
                }
              })
            };
          }
          return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
        };

        // 1. Pulling from RedGIFs preset must ONLY query RedGIFs (no SepiaSearch / PeerTube or unrelated i.redd.it bleed)
        const rgResults = await pullFromSource({
          id: 'src-nsfw-redgifs',
          type: 'keyword',
          value: 'redgifs',
          label: '🔞 RedGIFs HD Trending',
          isNsfw: true
        });
        assert.ok(
          !queriedUrls.some((u) => u.includes('sepiasearch.org')),
          'RedGIFs preset must not query SepiaSearch / PeerTube'
        );
        assert.ok(
          rgResults.some((item) => item.videoUrl === 'https://thumbs4.redgifs.com/RgBest1.mp4'),
          'RedGIFs preset should return RedGIFs HD stream (including order=best fallback for trending)'
        );
        assert.ok(
          !rgResults.some((item) => item.videoUrl === 'https://i.redd.it/reddit_clip.mp4'),
          'Dedicated RedGIFs preset must not bleed non-RedGIFs Reddit clips when isolated'
        );

        // 2. Pulling from general keyword when PeerTube is not enabled must interleave engines without PeerTube
        queriedUrls.length = 0;
        const kwResults = await pullFromSource({
          id: 'custom-kw-1',
          type: 'keyword',
          value: 'amateur clips',
          label: 'Amateur Clips',
          isNsfw: true
        });
        assert.ok(
          !queriedUrls.some((u) => u.includes('sepiasearch.org')),
          'General keyword source must not query PeerTube when PeerTube is not enabled'
        );
        assert.ok(
          kwResults.some((item) => item.videoUrl === 'https://thumbs4.redgifs.com/RgBest1.mp4') &&
            kwResults.some((item) => item.videoUrl === 'https://i.redd.it/reddit_clip.mp4'),
          'General multi-engine keyword source should wait for and interleave multiple engines'
        );

        // 3. Pulling explicitly from a PeerTube source SHOULD query SepiaSearch / PeerTube
        queriedUrls.length = 0;
        const ptResults = await pullFromSource({
          id: 'dir-fed-peertube',
          type: 'keyword',
          value: 'peertube nsfw adult',
          label: 'PeerTube Federated 18+',
          isNsfw: true
        });
        assert.ok(
          queriedUrls.some((u) => u.includes('sepiasearch.org')),
          'Explicit PeerTube source should query SepiaSearch / PeerTube'
        );
        assert.strictEqual(ptResults.length, 1);
        assert.strictEqual(ptResults[0].videoUrl, 'https://peertube.example.org/static/pt-123.mp4');

        globalThis.document = prevDoc;
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        setAppState({ sources: origSources });
      }
    });

    it('should wait until all active sources and engines finish pulling and continuously top up the queue in round-robin order', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origPrebuffer = settings.prebuffer;
      const origState = getAppState();

      try {
        settings.allowNsfw = false;
        settings.prebuffer = true;

        // Configure 3 distinct active subreddit sources to verify all 3 are pulled (not capped at 2)
        setAppState({
          sources: [
            { id: 's1', type: 'subreddit', value: 'subOne', label: 'r/subOne', enabled: true, isNsfw: false },
            { id: 's2', type: 'subreddit', value: 'subTwo', label: 'r/subTwo', enabled: true, isNsfw: false },
            { id: 's3', type: 'subreddit', value: 'subThree', label: 'r/subThree', enabled: true, isNsfw: false }
          ],
          videoQueue: [],
          currentIndex: -1
        });

        const pulledSubs = new Set();
        globalThis.fetch = async (url) => {
          const u = String(url);
          const m = u.match(/reddit\.com\/r\/([^/]+)\//i);
          if (m?.[1]) {
            const sub = m[1];
            pulledSubs.add(sub);
            return {
              ok: true,
              json: async () => ({
                data: {
                  children: [
                    {
                      data: {
                        id: `${sub}-1`,
                        title: `${sub} clip 1`,
                        over_18: false,
                        url_overridden_by_dest: `https://cdn.example.org/${sub}-1.mp4`
                      }
                    },
                    {
                      data: {
                        id: `${sub}-2`,
                        title: `${sub} clip 2`,
                        over_18: false,
                        url_overridden_by_dest: `https://cdn.example.org/${sub}-2.mp4`
                      }
                    }
                  ]
                }
              })
            };
          }
          return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
        };

        await pullRandomVideos(1);
        assert.strictEqual(pulledSubs.size, 3, 'pullRandomVideos should wait for all 3 active sources to pull');

        // Continuous pull cycle should top up the queue from remaining unseen items across active sources
        const added = await runContinuousPullCycle();
        assert.ok(added > 0 || getAppState().videoQueue.length >= 2, 'Continuous puller should append unseen videos to the queue');

        assert.strictEqual(startContinuousBackgroundPuller(), true);
        stopContinuousBackgroundPuller();
      } finally {
        stopContinuousBackgroundPuller();
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.prebuffer = origPrebuffer;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should reliably pull 18+ videos via enabled Free Tube sources when Reddit/RedGIFs block CORS without masquerading fake labels on isolated non-tube fetchers', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origPrebuffer = settings.prebuffer;
      const origState = getAppState();

      settings.allowNsfw = true;
      settings.prebuffer = false;

      // Build 34 active 18+ sources (subreddits, RedGIFs niches, Free Tube, FullTaboo) with PeerTube, Lemmy, and Vintage disabled
      const active34Sources = [];
      for (let i = 1; i <= 30; i++) {
        active34Sources.push({
          id: `dir-sub-test-${i}`,
          type: 'subreddit',
          value: i % 2 === 0 ? 'RealGirls' : 'Amateur',
          label: `r/TestSub${i}`,
          enabled: true,
          isNsfw: true
        });
      }
      active34Sources.push(
        { id: 'src-nsfw-redgifs', type: 'keyword', value: 'redgifs cosplay', label: 'Cosplay 18+', enabled: true, isNsfw: true },
        { id: 'src-nsfw-tube-hd', type: 'keyword', value: 'amateur hd', label: 'Free Tube HD', enabled: true, isNsfw: true },
        { id: 'src-nsfw-romantic', type: 'keyword', value: 'romantic sensual hd', label: 'Romantic HD', enabled: true, isNsfw: true },
        { id: 'src-nsfw-fulltaboo', type: 'url', value: 'https://fulltaboo.tv/', label: 'FullTaboo.tv', enabled: true, isNsfw: true },
        { id: 'dir-fed-lemmy', type: 'keyword', value: 'lemmy fediverse nsfw', label: 'Lemmy 18+', enabled: false, isNsfw: true },
        { id: 'dir-fed-peertube', type: 'keyword', value: 'peertube nsfw adult', label: 'PeerTube 18+', enabled: false, isNsfw: true },
        { id: 'src-nsfw-vintage', type: 'keyword', value: 'vintage erotica', label: 'Vintage 18+ Archive', enabled: false, isNsfw: true }
      );

      setAppState({ sources: active34Sources, videoQueue: [], currentIndex: -1 });

      const calledUrls = [];
      globalThis.fetch = async (url) => {
        const u = String(url);
        calledUrls.push(u);

        // Simulate Eporner JSON API v2 succeeding with native CORS
        if (u.includes('eporner.com/api/v2/video/search')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              videos: [
                {
                  id: 'epDirect101',
                  title: 'Native CORS HD Stream 101',
                  length_sec: 185,
                  hd: true,
                  url: 'https://www.eporner.com/video-epDirect101/',
                  embed: 'https://www.eporner.com/embed/epDirect101/'
                },
                {
                  id: 'epDirect202',
                  title: 'Native CORS HD Stream 202',
                  length_sec: 240,
                  hd: true,
                  url: 'https://www.eporner.com/video-epDirect202/',
                  embed: 'https://www.eporner.com/embed/epDirect202/'
                }
              ]
            })
          };
        }

        // Simulate Eporner embed page returning real player stream for epDirect101 (and 403 for epDirect202)
        if (u.includes('eporner.com/embed/epDirect101')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              '<script>window.EP.video = { "src": "https:\\/\\/cdn.eporner.com\\/streams\\/epDirect101_720p.mp4" };</script>'
          };
        }

        // Simulate Reddit, RedGIFs, FullTaboo, epDirect202, and CORS proxies returning 403/522
        return { ok: false, status: 403, text: async () => 'Forbidden', json: async () => ({}) };
      };

      try {
        // Non-tube fetchers should NOT disguise Eporner videos under fake source badges when blocked
        const subItems = await fetchSubredditVideos('RealGirls');
        assert.strictEqual(subItems.length, 0, 'Subreddit pull must not masquerade Eporner streams as r/RealGirls');

        const rgItems = await searchRedgifsVideos('redgifs cosplay', 4);
        assert.strictEqual(rgItems.length, 0, 'RedGIFs pull must not masquerade Eporner streams as RedGIFs');

        const ftItems = await scanUrlForVideos('https://fulltaboo.tv/', 'FullTaboo.tv', true);
        assert.strictEqual(ftItems.length, 0, 'FullTaboo.tv scan must not masquerade Eporner streams as FullTaboo.tv');

        // Direct check: epDirect202 (403 embed) must be dropped instead of fabricating gvideo.eporner.com
        const directEp = await fetchDirectEpornerVideos('popular hd', 4, 'Free Tube 18+');
        assert.strictEqual(directEp.length, 1, 'Unscrapable embed items must be dropped rather than guessing gvideo.eporner.com');
        assert.strictEqual(directEp[0].videoUrl, 'https://cdn.eporner.com/streams/epDirect101_720p.mp4');

        // Enabled Free Tube sources ('src-nsfw-tube-hd', 'src-nsfw-romantic') still populate videoQueue cleanly
        await pullRandomVideos(1);
        const stateAfter = getAppState();
        assert.strictEqual(stateAfter.videoQueue.length, 1, 'Shuffle Random should populate videoQueue via enabled Free Tube sources');
        assert.strictEqual(stateAfter.videoQueue[0].videoUrl, 'https://cdn.eporner.com/streams/epDirect101_720p.mp4');
        assert.strictEqual(
          stateAfter.videoQueue[0].videoUrl.includes('gvideo.eporner.com'),
          false,
          'Synthetic unplayable gvideo.eporner.com URLs must never be queued'
        );
        assert.ok(
          ['src-nsfw-tube-hd', 'src-nsfw-romantic'].includes(stateAfter.videoQueue[0].originSourceId),
          'Queued Free Tube clip must carry the originSourceId of the enabled Free Tube source'
        );
        assert.strictEqual(
          calledUrls.some((u) => u.includes('sepiasearch.org') || u.includes('lemmy') || u.includes('archive.org')),
          false,
          'Should never call PeerTube, Lemmy, or Archive.org when those sources are disabled'
        );
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.prebuffer = origPrebuffer;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should pull and randomize independently from EVERY single Safe preset source (1-by-1 in isolation) with zero cross-source bleed', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origPrebuffer = settings.prebuffer;
      const origState = getAppState();
      const prevDoc = globalThis.document;

      settings.allowNsfw = false;
      settings.prebuffer = false;
      globalThis.document = {
        getElementById: (id) => (id === 'engPeerTube' ? { checked: false } : null)
      };

      try {
        for (const targetPreset of DEFAULT_SOURCES) {
          const isolatedSources = structuredClone(DEFAULT_SOURCES).map((s) => ({
            ...s,
            enabled: s.id === targetPreset.id
          }));
          setAppState({ sources: isolatedSources, videoQueue: [], currentIndex: -1 });

          const active = getEffectiveActiveSources();
          assert.strictEqual(active.length, 1, `Expected only ${targetPreset.id} active`);
          assert.strictEqual(active[0].id, targetPreset.id);

          const hitUrls = [];
          globalThis.fetch = async (url) => {
            const u = String(url);
            hitUrls.push(u);

            if (u.includes('images-api.nasa.gov/search')) {
              return {
                ok: true,
                json: async () => ({
                  collection: {
                    items: [1, 2, 3, 4].map((n) => ({
                      data: [{ nasa_id: `nasa-${n}`, title: `NASA Clip ${n}` }],
                      href: `https://images-assets.nasa.gov/video/nasa-${n}/collection.json`
                    }))
                  }
                })
              };
            }
            const nasaAssetMatch = u.match(/images-assets\.nasa\.gov\/video\/(nasa-\d+)\/collection\.json/);
            if (nasaAssetMatch) {
              const nid = nasaAssetMatch[1];
              return {
                ok: true,
                json: async () => [`https://images-assets.nasa.gov/video/${nid}/${nid}~mobile.mp4`]
              };
            }
            if (u.includes('archive.org/advancedsearch.php')) {
              return {
                ok: true,
                json: async () => ({
                  response: {
                    docs: [1, 2, 3, 4].map((n) => ({
                      identifier: `ia-${targetPreset.id}-${n}`,
                      title: `Archive Clip ${n}`
                    }))
                  }
                })
              };
            }
            const iaMetaMatch = u.match(/archive\.org\/metadata\/([^/?#]+)/);
            if (iaMetaMatch) {
              const ident = decodeURIComponent(iaMetaMatch[1]);
              return {
                ok: true,
                json: async () => ({
                  files: [{ name: `${ident}.mp4`, size: '5000000', format: 'h.264' }]
                })
              };
            }
            if (u.includes('commons.wikimedia.org/w/api.php')) {
              const pages = {};
              for (let n = 1; n <= 4; n++) {
                pages[String(100 + n)] = {
                  pageid: 100 + n,
                  title: `File:Wiki_${targetPreset.id}_${n}.mp4`,
                  videoinfo: [{ url: `https://upload.wikimedia.org/wiki/${targetPreset.id}-${n}.mp4`, mime: 'video/mp4' }]
                };
              }
              return { ok: true, json: async () => ({ query: { pages } }) };
            }
            if (u.includes('api.dailymotion.com/videos')) {
              return {
                ok: true,
                json: async () => ({
                  list: [1, 2, 3].map((n) => ({
                    id: `dm${n}`,
                    title: `DM ${n}`,
                    stream_h264_url: `https://proxy.dailymotion.com/${targetPreset.id}-${n}.mp4`
                  }))
                })
              };
            }
            const subMatch = u.match(/reddit\.com\/r\/([^/?#]+)\//i);
            if (subMatch) {
              const subName = decodeURIComponent(subMatch[1]);
              return {
                ok: true,
                json: async () => ({
                  data: {
                    children: [1, 2, 3, 4].map((n) => ({
                      data: {
                        id: `${subName}-${n}`,
                        title: `r/${subName} clip ${n}`,
                        subreddit: subName,
                        over_18: false,
                        url_overridden_by_dest: `https://cdn.redditmedia.example/${subName}-${n}.mp4`
                      }
                    }))
                  }
                })
              };
            }
            if (u.includes('reddit.com/search.json')) {
              return { ok: true, json: async () => ({ data: { children: [] } }) };
            }
            return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
          };

          // Pull 3 sequential random videos from this single active Safe source
          await pullRandomVideos(1);
          await pullRandomVideos(1);
          await pullRandomVideos(1);

          const queue = getAppState().videoQueue;
          assert.strictEqual(queue.length, 3, `Single source ${targetPreset.id} should populate 3 videos across 3 pulls`);
          for (const item of queue) {
            assert.strictEqual(
              item.originSourceId,
              targetPreset.id,
              `Every queued item must originate from ${targetPreset.id}`
            );
          }

          const uniqueUrls = new Set(queue.map((q) => q.videoUrl));
          assert.strictEqual(
            uniqueUrls.size,
            3,
            `Repeated pulls on single source ${targetPreset.id} should randomize across distinct clips without repeating`
          );

          // Verify strict network isolation per preset type
          assert.ok(!hitUrls.some((u) => u.includes('sepiasearch.org')), `${targetPreset.id} must never touch PeerTube`);
          assert.ok(!hitUrls.some((u) => u.includes('eporner.com') || u.includes('redgifs.com') || u.includes('fulltaboo.tv')), `${targetPreset.id} must never touch 18+ hosts`);
          if (targetPreset.type === 'subreddit') {
            assert.ok(
              hitUrls.every((u) => u.toLowerCase().includes(`/r/${targetPreset.value.toLowerCase()}/`)),
              `Subreddit source ${targetPreset.id} must ONLY query r/${targetPreset.value}`
            );
          } else if (targetPreset.id === 'src-kw-space') {
            assert.ok(
              hitUrls.every((u) => u.includes('nasa.gov')),
              'NASA Space preset must ONLY query NASA APIs when isolated'
            );
          } else if (targetPreset.id === 'src-kw-vintage') {
            assert.ok(
              hitUrls.every((u) => u.includes('archive.org')),
              'Prelinger & Vintage preset must ONLY query Internet Archive / Prelinger when isolated'
            );
          } else {
            assert.ok(
              !hitUrls.some((u) => u.includes('nasa.gov') || u.includes('lemmy.world') || u.includes('mastodon.social')),
              `General topic preset ${targetPreset.id} must not query unchecked NASA or Fediverse presets`
            );
          }
        }
      } finally {
        globalThis.document = prevDoc;
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.prebuffer = origPrebuffer;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should pull and randomize independently from EVERY single 18+ preset source (all 11 presets + PeerTube & Lemmy, 1-by-1 in isolation) with zero cross-source bleed', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origPrebuffer = settings.prebuffer;
      const origState = getAppState();
      const prevDoc = globalThis.document;

      settings.allowNsfw = true;
      settings.prebuffer = false;
      globalThis.document = {
        getElementById: (id) => (id === 'engPeerTube' ? { checked: false } : null)
      };

      const allAdultToTest = [
        ...structuredClone(ADULT_PRESET_SOURCES),
        { id: 'dir-fed-peertube', type: 'keyword', value: 'peertube nsfw adult', label: 'PeerTube Federated 18+', enabled: true, isNsfw: true },
        { id: 'dir-fed-lemmy', type: 'keyword', value: 'lemmy fediverse nsfw', label: 'Lemmy & Mastodon 18+', enabled: true, isNsfw: true }
      ];

      try {
        for (const targetPreset of allAdultToTest) {
          const isolatedSources = structuredClone(allAdultToTest).map((s) => ({
            ...s,
            enabled: s.id === targetPreset.id
          }));
          setAppState({ sources: isolatedSources, videoQueue: [], currentIndex: -1 });

          const active = getEffectiveActiveSources();
          assert.strictEqual(active.length, 1, `Expected only ${targetPreset.id} active`);
          assert.strictEqual(active[0].id, targetPreset.id);

          const hitUrls = [];
          globalThis.fetch = async (url) => {
            const u = String(url);
            hitUrls.push(u);

            if (u.includes('api.redgifs.com/v2/auth/temporary')) {
              return { ok: true, json: async () => ({ token: 'tok' }) };
            }
            if (u.includes('api.redgifs.com/v2/gifs/search')) {
              return {
                ok: true,
                json: async () => ({
                  gifs: [1, 2, 3, 4, 5].map((n) => ({
                    id: `rg-${targetPreset.id}-${n}`,
                    duration: 20 + n,
                    tags: ['HD'],
                    urls: { hd: `https://thumbs4.redgifs.com/${targetPreset.id}_${n}.mp4` }
                  }))
                })
              };
            }
            const subMatch = u.match(/reddit\.com\/r\/([^/?#]+)\//i);
            if (subMatch) {
              const subName = decodeURIComponent(subMatch[1]);
              return {
                ok: true,
                json: async () => ({
                  data: {
                    children: [1, 2, 3, 4, 5].map((n) => ({
                      data: {
                        id: `${subName}-${n}`,
                        title: `18+ r/${subName} clip ${n}`,
                        subreddit: subName,
                        over_18: true,
                        url_overridden_by_dest: `https://cdn.redditmedia.example/${subName}-${n}.mp4`
                      }
                    }))
                  }
                })
              };
            }
            if (u.includes('eporner.com/api/v2/video/search')) {
              return {
                ok: true,
                json: async () => ({
                  videos: [1, 2, 3, 4, 5].map((n) => ({
                    id: `ep${n}`,
                    title: `Tube Clip ${n}`,
                    length_sec: 180 + n,
                    hd: true,
                    url: `https://www.eporner.com/video-ep${n}/`,
                    embed: `https://www.eporner.com/embed/ep${n}/`
                  }))
                })
              };
            }
            const epEmbedMatch = u.match(/eporner\.com\/embed\/(ep\d+)/);
            if (epEmbedMatch) {
              const eid = epEmbedMatch[1];
              return {
                ok: true,
                text: async () => `<script>var s = "https://cdn.eporner.com/${eid}_720p.mp4";</script>`
              };
            }
            if (u.includes('archive.org/advancedsearch.php')) {
              return {
                ok: true,
                json: async () => ({
                  response: {
                    docs: [1, 2, 3, 4].map((n) => ({
                      identifier: `vintage-18-${n}`,
                      title: `Vintage Film ${n}`
                    }))
                  }
                })
              };
            }
            const iaMetaMatch = u.match(/archive\.org\/metadata\/([^/?#]+)/);
            if (iaMetaMatch) {
              const ident = decodeURIComponent(iaMetaMatch[1]);
              return {
                ok: true,
                json: async () => ({
                  files: [{ name: `${ident}.mp4`, size: '8000000', format: 'h.264' }]
                })
              };
            }
            if (u === 'https://fulltaboo.tv/') {
              // Provide 8 distinct watch slugs so crawling randomizes beyond just the top 3 links
              const links = [1, 2, 3, 4, 5, 6, 7, 8]
                .map((n) => `<a href="https://fulltaboo.tv/full-scene-episode-${n}/">Episode ${n}</a>`)
                .join('\n');
              return { ok: true, text: async () => `<html><body>${links}</body></html>` };
            }
            const ftWatchMatch = u.match(/fulltaboo\.tv\/full-scene-episode-(\d+)\//);
            if (ftWatchMatch) {
              const epNum = ftWatchMatch[1];
              return {
                ok: true,
                text: async () =>
                  `<html><title>Episode ${epNum}</title><body><video src="https://cdn.fulltaboo.example/ep-${epNum}.mp4"></video></body></html>`
              };
            }
            if (u.includes('sepiasearch.org')) {
              return {
                ok: true,
                json: async () => ({
                  data: [1, 2, 3, 4].map((n) => ({
                    uuid: `pt-nsfw-${n}`,
                    name: `PT 18+ ${n}`,
                    nsfw: true,
                    account: { host: 'pt.example.org' }
                  }))
                })
              };
            }
            const ptDetailMatch = u.match(/pt\.example\.org\/api\/v1\/videos\/(pt-nsfw-\d+)/);
            if (ptDetailMatch) {
              const pid = ptDetailMatch[1];
              return {
                ok: true,
                json: async () => ({
                  name: pid,
                  nsfw: true,
                  files: [{ fileDownloadUrl: `https://pt.example.org/static/${pid}.mp4`, size: 4000000 }]
                })
              };
            }
            if (u.includes('lemmynsfw.com') || u.includes('lemmy.world')) {
              const hostTag = u.includes('lemmynsfw.com') ? 'nsfw' : 'world';
              return {
                ok: true,
                json: async () => ({
                  posts: [1, 2, 3, 4].map((n) => ({
                    post: {
                      id: `${hostTag}-${n}`,
                      name: `Lemmy 18+ ${n}`,
                      nsfw: true,
                      url: `https://cdn.lemmy.example/${hostTag}-${n}.mp4`
                    },
                    community: { name: 'adult', nsfw: true }
                  }))
                })
              };
            }
            return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
          };

          await pullRandomVideos(1);
          await pullRandomVideos(1);
          await pullRandomVideos(1);

          const queue = getAppState().videoQueue;
          assert.strictEqual(queue.length, 3, `Single 18+ source ${targetPreset.id} should queue 3 videos across 3 pulls`);
          for (const item of queue) {
            assert.strictEqual(item.originSourceId, targetPreset.id, `Item must carry originSourceId=${targetPreset.id}`);
            assert.strictEqual(item.isNsfw, true, `18+ source ${targetPreset.id} items must be marked isNsfw`);
          }
          assert.strictEqual(
            new Set(queue.map((q) => q.videoUrl)).size,
            3,
            `Single 18+ source ${targetPreset.id} should randomize across distinct videos without immediate repeats`
          );

          // Strict per-source isolation checks
          if (targetPreset.type === 'subreddit') {
            assert.ok(
              hitUrls.every((u) => u.toLowerCase().includes(`/r/${targetPreset.value.toLowerCase()}/`)),
              `18+ subreddit ${targetPreset.id} must ONLY query r/${targetPreset.value}`
            );
          } else if (targetPreset.id === 'src-nsfw-redgifs' || targetPreset.id === 'src-nsfw-cosplay') {
            assert.ok(
              hitUrls.every((u) => u.includes('api.redgifs.com')),
              `${targetPreset.id} must ONLY query RedGIFs when RedGIFs responds`
            );
          } else if (targetPreset.id === 'src-nsfw-tube-hd' || targetPreset.id === 'src-nsfw-romantic') {
            assert.ok(
              !hitUrls.some(
                (u) =>
                  u.includes('fulltaboo.tv') ||
                  u.includes('reddit.com') ||
                  u.includes('redgifs.com') ||
                  u.includes('archive.org') ||
                  u.includes('sepiasearch.org') ||
                  u.includes('lemmy')
              ),
              `Free Tube preset ${targetPreset.id} must not bleed into unchecked FullTaboo, Reddit, RedGIFs, Archive, PeerTube, or Lemmy`
            );
          } else if (targetPreset.id === 'src-nsfw-vintage') {
            assert.ok(
              hitUrls.every((u) => u.includes('archive.org')),
              'Vintage 18+ Archive preset must ONLY query archive.org'
            );
          } else if (targetPreset.id === 'src-nsfw-fulltaboo') {
            assert.ok(
              hitUrls.every((u) => u.includes('fulltaboo.tv')),
              'FullTaboo.tv preset must ONLY crawl fulltaboo.tv'
            );
          } else if (targetPreset.id === 'dir-fed-peertube') {
            assert.ok(
              hitUrls.every((u) => u.includes('sepiasearch.org') || u.includes('pt.example.org')),
              'PeerTube 18+ preset must ONLY query PeerTube'
            );
          } else if (targetPreset.id === 'dir-fed-lemmy') {
            assert.ok(
              hitUrls.every((u) => u.includes('lemmy') || u.includes('mastodon.social')),
              'Lemmy & Mastodon 18+ preset must ONLY query Fediverse endpoints'
            );
          }
        }
      } finally {
        globalThis.document = prevDoc;
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.prebuffer = origPrebuffer;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should immediately purge prebuffered queue items from unchecked sources when narrowing down to 1 active source', () => {
      const origAllowNsfw = settings.allowNsfw;
      const origState = getAppState();

      try {
        settings.allowNsfw = false;
        const s1 = { id: 's1', type: 'subreddit', value: 'Unexpected', label: 'r/Unexpected', enabled: true, isNsfw: false };
        const s2 = { id: 's2', type: 'subreddit', value: 'oddlysatisfying', label: 'r/oddlysatisfying', enabled: true, isNsfw: false };
        const s3 = { id: 's3', type: 'keyword', value: 'nasa space launch', label: 'NASA', enabled: true, isNsfw: false };

        setAppState({
          sources: [s1, s2, s3],
          videoQueue: [
            { id: 'playing-now', videoUrl: 'https://ex.com/now.mp4', originSourceId: 's2' },
            { id: 'queued-s2', videoUrl: 'https://ex.com/s2.mp4', originSourceId: 's2' },
            { id: 'queued-s3', videoUrl: 'https://ex.com/s3.mp4', originSourceId: 's3' },
            { id: 'queued-s1', videoUrl: 'https://ex.com/s1.mp4', originSourceId: 's1' },
            { id: 'queued-vault', videoUrl: 'https://ex.com/vault.mp4', fromVault: true }
          ],
          currentIndex: 0
        });

        // Uncheck s2 and s3 so ONLY s1 remains checked
        s2.enabled = false;
        s3.enabled = false;
        syncQueueAfterSourceChange();

        const remaining = getAppState().videoQueue;
        assert.deepStrictEqual(
          remaining.map((v) => v.id),
          ['playing-now', 'queued-s1', 'queued-vault'],
          'Should preserve active video, active-source upcoming items, and Vault items while purging unchecked-source upcoming items'
        );
      } finally {
        settings.allowNsfw = origAllowNsfw;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should continuously refill and randomize in runContinuousPullCycle when only 1 source is checked (including multireddits)', async () => {
      const origFetch = globalThis.fetch;
      const origAllowNsfw = settings.allowNsfw;
      const origPrebuffer = settings.prebuffer;
      const origState = getAppState();

      try {
        settings.allowNsfw = true;
        settings.prebuffer = true;
        const singleMulti = {
          id: 'dir-fed-multireddit',
          type: 'subreddit',
          value: 'nsfw+NSFW_GIF+RealGirls',
          label: 'Reddit 18+ Mega-Mix',
          enabled: true,
          isNsfw: true
        };
        const disabledOther = {
          id: 'src-nsfw-redgifs',
          type: 'keyword',
          value: 'redgifs',
          label: 'RedGIFs',
          enabled: false,
          isNsfw: true
        };

        setAppState({ sources: [singleMulti, disabledOther], videoQueue: [], currentIndex: -1 });

        const hitUrls = [];
        globalThis.fetch = async (url) => {
          const u = String(url);
          hitUrls.push(u);
          if (u.includes('/r/nsfw+NSFW_GIF+RealGirls/')) {
            return {
              ok: true,
              json: async () => ({
                data: {
                  children: [1, 2, 3, 4, 5].map((n) => ({
                    data: {
                      id: `multi-${n}`,
                      title: `Multi Clip ${n}`,
                      subreddit: 'nsfw',
                      over_18: true,
                      url_overridden_by_dest: `https://cdn.redditmedia.example/multi-${n}.mp4`
                    }
                  }))
                }
              })
            };
          }
          return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
        };

        const added1 = await runContinuousPullCycle();
        assert.strictEqual(added1, 4, 'First continuous background cycle should top up 4 clips from the single active source');

        // Advance to clip index 3 and run another cycle — should recycle unseen/non-playing clips cleanly without stalling
        const midQueue = getAppState().videoQueue;
        setAppState({ videoQueue: midQueue, currentIndex: 3 });
        const added2 = await runContinuousPullCycle();
        assert.ok(added2 >= 1, 'Continuous background puller should keep supplying clips from the single source');

        const finalQueue = getAppState().videoQueue;
        assert.ok(
          finalQueue.every((v) => v.originSourceId === 'dir-fed-multireddit'),
          'Every continuously pulled video must come strictly from the single checked source'
        );
        assert.ok(
          hitUrls.every((u) => u.includes('/r/nsfw+NSFW_GIF+RealGirls/')),
          'Multireddit + separator must be preserved and zero unchecked sources queried'
        );
      } finally {
        globalThis.fetch = origFetch;
        settings.allowNsfw = origAllowNsfw;
        settings.prebuffer = origPrebuffer;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should abort hung streams via armPlaybackStartupWatchdog (even at 00:02 / 00:00 savedTime) without auto-converting native MP4', async () => {
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const origAutoConvert = settings.autoConvert;
      const prevDoc = globalThis.document;

      let fetchCount = 0;
      globalThis.fetch = async () => {
        fetchCount++;
        return { ok: false, status: 504 };
      };

      const mockVideoEl = {
        src: 'https://files.mastodon.example/hung.mp4',
        readyState: 0,
        currentTime: 2.0,
        duration: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        },
        getAttribute(attr) {
          return attr === 'src' ? this.src : null;
        }
      };

      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      try {
        settings.autoConvert = true;
        const hungClip = {
          id: 'hung-1',
          title: 'Hung Stream',
          videoUrl: 'https://files.mastodon.example/hung.mp4',
          format: 'mp4',
          sourceName: 'Test Source'
        };
        const healthyClip = {
          id: 'healthy-2',
          title: 'Working Stream',
          videoUrl: 'https://cdn.example.com/working.mp4',
          format: 'mp4',
          sourceName: 'Test Source'
        };

        setAppState({ videoQueue: [hungClip, healthyClip], currentIndex: 0 });
        mockVideoEl.currentTime = 2.0; // Simulate 00:02 / 00:00 restored savedTime with readyState === 0
        armPlaybackStartupWatchdog(mockVideoEl, hungClip, hungClip.videoUrl, 25);

        await new Promise((r) => setTimeout(r, 70));

        const after = getAppState();
        assert.strictEqual(fetchCount, 0, 'Should NOT waste time auto-converting a hung native .mp4 stream');
        assert.strictEqual(after.deadUrls.has('https://files.mastodon.example/hung.mp4'), true);
        assert.strictEqual(after.videoQueue.length, 1);
        assert.strictEqual(after.videoQueue[0].id, 'healthy-2');
        assert.strictEqual(mockVideoEl.src, 'https://cdn.example.com/working.mp4');
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        settings.autoConvert = origAutoConvert;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should blacklist dead URLs, purge duplicate dead items from queue, skip MP4 auto-convert, and guard re-entrancy in handleVideoPlaybackError', async () => {
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const origAutoConvert = settings.autoConvert;
      const prevDoc = globalThis.document;

      let fetchCalls = 0;
      globalThis.fetch = async () => {
        fetchCalls++;
        return { ok: false, status: 403 };
      };

      const mockVideoEl = {
        src: 'https://cdn.example.com/dead-loop.mp4',
        readyState: 0,
        currentTime: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        }
      };

      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      try {
        settings.autoConvert = true;
        const dead1 = {
          id: 'dead-1',
          title: 'Dead 1',
          videoUrl: 'https://cdn.example.com/dead-loop.mp4',
          format: 'mp4',
          originSourceId: 'src-test'
        };
        const dead2Duplicate = {
          id: 'dead-2',
          title: 'Dead 1 Duplicate',
          videoUrl: 'https://cdn.example.com/dead-loop.mp4',
          format: 'mp4',
          originSourceId: 'src-test'
        };
        const good3 = {
          id: 'good-3',
          title: 'Good 3',
          videoUrl: 'https://cdn.example.com/good-stream.mp4',
          format: 'mp4',
          originSourceId: 'src-test'
        };

        setAppState({ videoQueue: [dead1, dead2Duplicate, good3], currentIndex: 0 });

        // Fire two concurrent error events — second must no-op via isHandlingPlaybackError guard
        const [r1, r2] = await Promise.all([
          handleVideoPlaybackError(),
          handleVideoPlaybackError()
        ]);
        assert.strictEqual(r1, true);
        assert.strictEqual(r2, false, 'Concurrent duplicate error event must be ignored while recovery is in flight');
        assert.strictEqual(fetchCalls, 0, 'Native .mp4 playback error must skip browser auto-convert proxy fetches');

        const after = getAppState();
        assert.strictEqual(after.deadUrls.has('https://cdn.example.com/dead-loop.mp4'), true);
        assert.deepStrictEqual(
          after.videoQueue.map((v) => v.id),
          ['good-3'],
          'Both the failed item and any queued duplicate with the same dead URL must be purged immediately'
        );
        assert.strictEqual(mockVideoEl.src, 'https://cdn.example.com/good-stream.mp4');
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        settings.autoConvert = origAutoConvert;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should upgrade bare unsigned Reddit RedGIFs CDN URLs to signed API streams and drop deleted 404 clips', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, status: 200, json: async () => ({ token: 'temp-rg-token' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/liveclip')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              gif: {
                id: 'liveclip',
                duration: 14,
                tags: ['amateur', 'hd'],
                urls: {
                  hd: 'https://media.redgifs.com/LiveClip.mp4?expires=4102444800&signature=hdSig',
                  sd: 'https://thumbs4.redgifs.com/LiveClip-mobile.mp4?expires=4102444800&signature=sdSig'
                }
              }
            })
          };
        }
        return { ok: false, status: 404, text: async () => 'Not Found', json: async () => ({}) };
      };

      try {
        const rawItems = [
          {
            id: 'rd-1',
            title: 'Unsigned Live RedGIFs',
            videoUrl: 'https://thumbs4.redgifs.com/LiveClip.mp4',
            convertedUrl: 'https://media.redgifs.com/LiveClip.mp4',
            format: 'mp4',
            sourceName: 'r/RealGirls'
          },
          {
            id: 'rd-2',
            title: 'Deleted Unsigned RedGIFs',
            videoUrl: 'https://media.redgifs.com/DeletedClip.mp4',
            format: 'mp4',
            sourceName: 'r/RealGirls'
          },
          {
            id: 'rd-3',
            title: 'Native Reddit Hosted Video',
            videoUrl: 'https://v.redd.it/abc123/DASH_720.mp4',
            format: 'mp4',
            sourceName: 'r/RealGirls'
          }
        ];

        const upgraded = await upgradeUnsignedRedgifsItems(rawItems);
        assert.strictEqual(upgraded.length, 2, 'Deleted 404 RedGIFs item must be dropped instead of queuing an unsigned 403 URL');
        const live = upgraded.find((x) => x.id === 'rd-1');
        const nativeRd = upgraded.find((x) => x.id === 'rd-3');
        assert.ok(live, 'Resolved RedGIFs item should be kept');
        assert.strictEqual(live.videoUrl, 'https://media.redgifs.com/LiveClip.mp4?expires=4102444800&signature=hdSig');
        assert.strictEqual(
          live.convertedUrl,
          'https://thumbs4.redgifs.com/LiveClip-mobile.mp4?expires=4102444800&signature=sdSig',
          'Genuine signed SD stream on thumbs4.redgifs.com must be preserved intact as convertedUrl fallback'
        );
        assert.strictEqual(live.sourceName, 'r/RealGirls', 'Original Reddit source badge must be preserved');
        assert.strictEqual(nativeRd.videoUrl, 'https://v.redd.it/abc123/DASH_720.mp4');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should purge stale Mastodon (#redgifs), expired CDN URLs, unsigned RedGIFs, and synthetic gvideo.eporner.com items in restorePlaybackState', () => {
      const origState = getAppState();
      const origAllowNsfw = settings.allowNsfw;
      const origResume = settings.resumePlayback;
      const prevStorage = globalThis.localStorage;
      const prevDoc = globalThis.document;

      const store = new Map();
      globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
      };
      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: () => null,
        querySelector: () => null
      };

      try {
        settings.allowNsfw = true;
        settings.resumePlayback = true;
        const activeRgSource = {
          id: 'src-nsfw-redgifs',
          type: 'redgifs',
          value: 'trending',
          label: 'RedGIFs HD',
          enabled: true,
          isNsfw: true
        };
        const disabledTubeSource = {
          id: 'src-nsfw-tube-hd',
          type: 'freetube',
          value: 'popular hd',
          label: 'Free Tube 18+',
          enabled: false,
          isNsfw: true
        };
        setAppState({ sources: [activeRgSource, disabledTubeSource], videoQueue: [], currentIndex: -1 });

        const savedPayload = {
          currentIndex: 0,
          currentVideo: {
            id: 'masto-stale',
            videoUrl: 'https://files.mastodon.social/media_attachments/files/stale.mp4',
            sourceName: 'Mastodon (#redgifs)',
            isNsfw: true
          },
          videoQueue: [
            {
              id: 'masto-stale',
              title: 'Stale Mastodon Redgifs',
              videoUrl: 'https://files.mastodon.social/media_attachments/files/stale.mp4',
              sourceName: 'Mastodon (#redgifs)',
              isNsfw: true
            },
            {
              id: 'expired-rg',
              title: 'Expired Signed Stream',
              videoUrl: 'https://media.redgifs.com/OldClip.mp4?expires=1600000000&signature=expired',
              originSourceId: 'src-nsfw-redgifs',
              sourceName: 'RedGIFs HD',
              isNsfw: true
            },
            {
              id: 'bare-unsigned-rg',
              title: 'Bare Unsigned RedGIFs',
              videoUrl: 'https://thumbs4.redgifs.com/BareUnsigned.mp4',
              originSourceId: 'src-nsfw-redgifs',
              sourceName: 'RedGIFs HD',
              isNsfw: true
            },
            {
              id: 'synthetic-ep',
              title: 'Guessed Eporner',
              videoUrl: 'https://gvideo.eporner.com/xyz99/xyz99.mp4',
              originSourceId: 'src-nsfw-tube-hd',
              sourceName: 'Free Tube 18+',
              isNsfw: true
            },
            {
              id: 'fresh-signed-rg',
              title: 'Fresh Signed RedGIFs',
              videoUrl: 'https://media.redgifs.com/FreshClip.mp4?expires=4102444800&signature=fresh',
              originSourceId: 'src-nsfw-redgifs',
              sourceName: 'RedGIFs HD',
              isNsfw: true
            },
            {
              id: 'vault-saved',
              title: 'Offline Vault Video',
              videoUrl: 'https://thumbs4.redgifs.com/VaultSaved.mp4',
              fromVault: true,
              hasOfflineBlob: true,
              sourceName: 'Vault',
              isNsfw: true
            }
          ],
          positions: {}
        };
        store.set(STORAGE_KEYS.PLAYBACK_STATE, JSON.stringify(savedPayload));

        const restored = restorePlaybackState();
        assert.strictEqual(restored, true, 'Should restore remaining valid/Vault items after purging stale entries');
        const restoredIds = getAppState().videoQueue.map((v) => v.id);
        assert.deepStrictEqual(
          restoredIds,
          ['fresh-signed-rg', 'vault-saved'],
          'Stale Mastodon (#redgifs), expired ?expires=, bare unsigned RedGIFs, and synthetic gvideo.eporner.com items must all be purged'
        );
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.localStorage = prevStorage;
        globalThis.document = prevDoc;
        settings.allowNsfw = origAllowNsfw;
        settings.resumePlayback = origResume;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should salvage expired RedGIFs and Tube clips in-place by re-minting fresh signed stream URLs from pageUrl before skipping', async () => {
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevDoc = globalThis.document;

      const mockVideoEl = {
        src: 'https://media.redgifs.com/SalvageClip.mp4?expires=1700000000&signature=expiredSig',
        readyState: 0,
        currentTime: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        }
      };

      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, status: 200, json: async () => ({ token: 'fresh-guest-token' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/salvageclip')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              gif: {
                id: 'salvageclip',
                duration: 18,
                urls: {
                  hd: 'https://media.redgifs.com/SalvageClip.mp4?expires=4102444800&signature=mintedFreshHd',
                  sd: 'https://thumbs4.redgifs.com/SalvageClip-mobile.mp4?expires=4102444800&signature=mintedFreshSd'
                }
              }
            })
          };
        }
        if (u.includes('eporner.com/embed/ep999')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              '<script>window.EP = { src: "https://cdn2.eporner.com/streams/ep999_fresh_720p.mp4?token=newTok" };</script>'
          };
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };

      try {
        const expiredRgClip = {
          id: 'rg-salvageclip',
          title: 'Expired RedGIFs Clip',
          videoUrl: 'https://media.redgifs.com/SalvageClip.mp4?expires=1700000000&signature=expiredSig',
          pageUrl: 'https://www.redgifs.com/watch/salvageclip',
          format: 'mp4',
          sourceName: 'RedGIFs HD'
        };
        const nextClip = {
          id: 'next-clip',
          title: 'Backup Clip',
          videoUrl: 'https://cdn.example.com/backup.mp4',
          format: 'mp4'
        };

        setAppState({ videoQueue: [expiredRgClip, nextClip], currentIndex: 0 });
        const salvaged = await handleVideoPlaybackError();
        assert.strictEqual(salvaged, true);
        assert.strictEqual(
          getAppState().videoQueue[0].id,
          'rg-salvageclip',
          'Exact same video should remain at index 0 instead of being skipped'
        );
        assert.strictEqual(
          mockVideoEl.src,
          'https://media.redgifs.com/SalvageClip.mp4?expires=4102444800&signature=mintedFreshHd',
          'Player src should switch to the newly minted signed HD URL'
        );
        assert.strictEqual(
          getAppState().videoQueue[0].convertedUrl,
          'https://thumbs4.redgifs.com/SalvageClip-mobile.mp4?expires=4102444800&signature=mintedFreshSd'
        );

        // Also verify Tube/Eporner embed re-scrape rescue
        const expiredTubeClip = {
          id: 'ep-ep999',
          title: 'Expired Tube Clip',
          videoUrl: 'https://cdn1.eporner.com/streams/ep999_720p.mp4?token=expiredTok',
          pageUrl: 'https://www.eporner.com/video-ep999/title/',
          format: 'mp4'
        };
        const rescuedTube = await rescueDeadVideoStream(expiredTubeClip);
        assert.ok(rescuedTube, 'Eporner clip should be rescued via embed re-scrape');
        assert.strictEqual(rescuedTube.videoUrl, 'https://cdn2.eporner.com/streams/ep999_fresh_720p.mp4?token=newTok');
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should rescue broken Reddit DASH MP4s via native HLSPlaylist.m3u8 and purged Mastodon caches via home instance API', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('reddit.com/r/Unexpected/comments/xyz123/cool_post.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                data: {
                  children: [
                    {
                      data: {
                        id: 'xyz123',
                        secure_media: {
                          reddit_video: {
                            fallback_url: 'https://v.redd.it/vid99/DASH_720.mp4',
                            hls_url: 'https://v.redd.it/vid99/HLSPlaylist.m3u8?a=173999'
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
        if (u === 'https://ohai.social/api/v1/statuses/987654321') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: '987654321',
              media_attachments: [
                {
                  type: 'video',
                  url: 'https://files.ohai.social/media_attachments/files/origin-video.mp4'
                }
              ]
            })
          };
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };

      try {
        const redditItem = {
          id: 'rd-xyz123',
          title: 'Reddit Clip',
          videoUrl: 'https://v.redd.it/vid99/DASH_720.mp4',
          pageUrl: 'https://www.reddit.com/r/Unexpected/comments/xyz123/cool_post/',
          format: 'mp4'
        };
        const rescuedReddit = await rescueDeadVideoStream(redditItem);
        assert.ok(rescuedReddit, 'Broken Reddit DASH MP4 should be rescued via native HLSPlaylist.m3u8');
        assert.strictEqual(rescuedReddit.videoUrl, 'https://v.redd.it/vid99/HLSPlaylist.m3u8?a=173999');
        assert.strictEqual(rescuedReddit.format, 'm3u8');

        const mastodonItem = {
          id: 'masto-55',
          title: 'Purged Cache Mastodon Clip',
          videoUrl: 'https://files.mastodon.social/cache/media_attachments/purged.mp4',
          pageUrl: 'https://ohai.social/@creator/987654321',
          format: 'mp4'
        };
        const rescuedMasto = await rescueDeadVideoStream(mastodonItem);
        assert.ok(rescuedMasto, 'Purged mastodon.social cache URL should be rescued from home instance status API');
        assert.strictEqual(rescuedMasto.videoUrl, 'https://files.ohai.social/media_attachments/files/origin-video.mp4');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should salvage hotlink-blocked MP4 streams into an in-memory blob: URL via CORS proxy when <video> rejects external Referer', async () => {
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevDoc = globalThis.document;

      const mockVideoEl = {
        src: 'https://hotlink-guarded.example/media/clip77.mp4',
        readyState: 0,
        currentTime: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        }
      };

      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      const fakeMp4Bytes = new Uint8Array(4096).fill(7);
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.startsWith('https://corsproxy.io/?')) {
          return {
            ok: true,
            status: 200,
            headers: {
              get: (h) => {
                if (h.toLowerCase() === 'content-type') return 'video/mp4';
                if (h.toLowerCase() === 'content-length') return String(fakeMp4Bytes.byteLength);
                return null;
              }
            },
            blob: async () => new Blob([fakeMp4Bytes], { type: 'video/mp4' })
          };
        }
        return { ok: false, status: 403, text: async () => 'Hotlink Forbidden', json: async () => ({}) };
      };

      try {
        const hotlinkedClip = {
          id: 'web-hotlink-1',
          title: 'Hotlink Guarded Clip',
          videoUrl: 'https://hotlink-guarded.example/media/clip77.mp4',
          pageUrl: 'https://hotlink-guarded.example/watch/77',
          format: 'mp4'
        };
        const backupClip = {
          id: 'backup-2',
          title: 'Backup',
          videoUrl: 'https://cdn.example.com/backup2.mp4',
          format: 'mp4'
        };

        setAppState({ videoQueue: [hotlinkedClip, backupClip], currentIndex: 0 });
        const recovered = await handleVideoPlaybackError();
        assert.strictEqual(recovered, true);
        assert.strictEqual(getAppState().videoQueue[0].id, 'web-hotlink-1', 'Hotlinked clip should stay active instead of skipping');
        assert.strictEqual(
          mockVideoEl.src.startsWith('blob:'),
          true,
          'Player should switch to an in-memory blob: URL created from proxied video bytes'
        );
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should attempt Live Stream Rescue at most once and immediately skip when a video is genuinely 404 upstream', async () => {
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevDoc = globalThis.document;

      const mockVideoEl = {
        src: 'https://media.redgifs.com/GoneForever.mp4?expires=1700000000&signature=old',
        readyState: 0,
        currentTime: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        }
      };

      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, status: 200, json: async () => ({ token: 'tok' }) };
        }
        // Simulate 410 Gone / 404 Deleted everywhere upstream
        return { ok: false, status: 410, text: async () => 'Gone', json: async () => ({}) };
      };

      try {
        const deletedClip = {
          id: 'rg-goneforever',
          title: 'Deleted Upstream Clip',
          videoUrl: 'https://media.redgifs.com/GoneForever.mp4?expires=1700000000&signature=old',
          pageUrl: 'https://www.redgifs.com/watch/goneforever',
          format: 'mp4'
        };
        const workingNext = {
          id: 'working-next',
          title: 'Working Next Clip',
          videoUrl: 'https://cdn.example.com/working-next.mp4',
          format: 'mp4'
        };

        setAppState({ videoQueue: [deletedClip, workingNext], currentIndex: 0 });
        const skipped = await handleVideoPlaybackError();
        assert.strictEqual(skipped, true);
        assert.strictEqual(deletedClip._streamRescueAttempted, true, 'Should mark rescue attempted once');
        assert.deepStrictEqual(
          getAppState().videoQueue.map((v) => v.id),
          ['working-next'],
          'Genuinely deleted upstream clip must be removed and skipped cleanly after rescue returns null'
        );
        assert.strictEqual(mockVideoEl.src, 'https://cdn.example.com/working-next.mp4');
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should progressively stream >25 MB (500 MB) and chunked-large HTTP-only videos via HTTPS proxy without buffering into RAM', async () => {
      const {
        getEffectivePlaybackUrl,
        unwrapProxyTargetUrl,
        detectVideoFormat
      } = require('../app.js');
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevDoc = globalThis.document;
      const prevWin = globalThis.window;

      let bodyCancelled = false;
      let blobCalled = false;
      let chunkReaderCancelled = false;

      const mockVideoEl = {
        src: 'http://legacy-cinema.example/films/feature_500mb.mp4',
        readyState: 0,
        currentTime: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        }
      };

      globalThis.window = { location: { protocol: 'https:', href: 'https://davidscottballard1-png.github.io/my-project-2/' } };
      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      globalThis.fetch = async (url) => {
        const u = String(url);
        // Simulate strictly HTTP-only host: direct HTTPS port 443 refuses connection
        if (u.startsWith('https://legacy-cinema.example/')) {
          throw new Error('ECONNREFUSED port 443');
        }
        if (u.startsWith('https://corsproxy.io/?')) {
          const decoded = decodeURIComponent(u.slice('https://corsproxy.io/?'.length));
          if (decoded.endsWith('feature_500mb.mp4')) {
            return {
              ok: true,
              status: 200,
              headers: {
                get: (h) => {
                  if (h.toLowerCase() === 'content-type') return 'video/mp4';
                  if (h.toLowerCase() === 'content-length') return String(500 * 1024 * 1024); // 500 MB
                  return null;
                }
              },
              body: {
                cancel: async () => {
                  bodyCancelled = true;
                }
              },
              blob: async () => {
                blobCalled = true;
                throw new Error('Must NOT buffer 500 MB into JS RAM');
              }
            };
          }
          if (decoded.endsWith('chunked_live_100mb.mp4')) {
            let chunksSent = 0;
            const tenMbChunk = new Uint8Array(10 * 1024 * 1024);
            return {
              ok: true,
              status: 200,
              headers: {
                get: (h) => (h.toLowerCase() === 'content-type' ? 'video/mp4' : null) // No Content-Length!
              },
              body: {
                getReader: () => ({
                  read: async () => {
                    chunksSent++;
                    return { done: false, value: tenMbChunk };
                  },
                  cancel: async () => {
                    chunkReaderCancelled = true;
                  }
                })
              }
            };
          }
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };

      try {
        const bigHttpClip = {
          id: 'http-500mb',
          title: '500 MB HTTP-Only Feature Film',
          videoUrl: 'http://legacy-cinema.example/films/feature_500mb.mp4',
          format: 'mp4'
        };
        setAppState({ videoQueue: [bigHttpClip], currentIndex: 0 });

        // Simulate Safari Mixed-Content port-443 autoupgrade timeout
        const recovered = await handleVideoPlaybackError({ reason: 'timeout' });
        assert.strictEqual(recovered, true, '500 MB HTTP-only video should be rescued even after port-443 timeout');
        assert.strictEqual(bodyCancelled, true, 'Fetch body must be cancelled immediately so 0 MB is buffered in JS RAM');
        assert.strictEqual(blobCalled, false, 'res.blob() must never be called on >25 MB streams');
        assert.strictEqual(
          mockVideoEl.src,
          'https://corsproxy.io/?http%3A%2F%2Flegacy-cinema.example%2Ffilms%2Ffeature_500mb.mp4',
          'Player should progressively stream directly from HTTPS proxy URL'
        );
        assert.strictEqual(
          bigHttpClip.videoUrl,
          'http://legacy-cinema.example/films/feature_500mb.mp4',
          'Canonical videoUrl must remain unwrapped for downloads/Vault'
        );
        assert.strictEqual(getEffectivePlaybackUrl(bigHttpClip), mockVideoEl.src);
        assert.strictEqual(unwrapProxyTargetUrl(mockVideoEl.src), bigHttpClip.videoUrl);
        assert.strictEqual(detectVideoFormat(mockVideoEl.src).ext, 'mp4');
        assert.strictEqual(getAppState().deadUrls.has(bigHttpClip.videoUrl), false, 'Rescued URL must not stay blacklisted');

        // Also verify chunked stream (no Content-Length) exceeding 25 MB aborts reader and switches to progressive stream
        const chunkedClip = {
          id: 'http-chunked-100mb',
          title: 'Chunked HTTP Stream',
          videoUrl: 'http://legacy-cinema.example/films/chunked_live_100mb.mp4',
          format: 'mp4'
        };
        const chunkRescued = await rescueDeadVideoStream(chunkedClip);
        assert.ok(chunkRescued?.proxiedStreamUrl, 'Chunked stream >25 MB should switch to progressive HTTPS stream URL');
        assert.strictEqual(chunkReaderCancelled, true, 'Stream reader must cancel as soon as bytes exceed 25 MB cap');
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        globalThis.window = prevWin;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should stream multi-part .m3u8 playlists (including relative & byte-range segments) from strictly http://-only servers via HttpsProxyHlsLoader & ManagedMediaSource', async () => {
      const {
        createHttpsProxyHlsLoaderClass,
        startProxiedHlsPlayback,
        detachActiveHlsPlayer
      } = require('../app.js');
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevWin = globalThis.window;
      const prevHls = globalThis.Hls;

      const requestedUrls = [];
      globalThis.window = { location: { protocol: 'https:', href: 'https://davidscottballard1-png.github.io/my-project-2/' } };

      const samplePlaylist = ['#EXTM3U', '#EXT-X-VERSION:4', '#EXTINF:6.0,', 'seg001.ts', '#EXT-X-ENDLIST'].join('\n');
      const fullSegmentBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

      globalThis.fetch = async (url) => {
        const u = String(url);
        requestedUrls.push(u);
        if (u.startsWith('http://')) {
          throw new Error('Mixed Content blocked by Safari!');
        }
        if (u.startsWith('https://legacy-hls.example/')) {
          throw new Error('Port 443 TLS unsupported on strictly HTTP-only host');
        }
        if (u.includes(encodeURIComponent('http://legacy-hls.example/live/channel.m3u8'))) {
          return {
            ok: true,
            status: 200,
            headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'application/vnd.apple.mpegurl' : null) },
            text: async () => samplePlaylist
          };
        }
        if (u.includes(encodeURIComponent('http://legacy-hls.example/live/seg001.ts'))) {
          return {
            ok: true,
            status: 200,
            headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'video/mp2t' : null) },
            arrayBuffer: async () => fullSegmentBytes.buffer.slice(0)
          };
        }
        return { ok: false, status: 404, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
      };

      let attachedMediaEl = null;
      let loadedSourceUrl = null;
      let destroyedCount = 0;

      class MockHls {
        static isSupported() {
          return true;
        }
        constructor(config) {
          this.config = config;
          this.handlers = {};
        }
        on(evt, fn) {
          this.handlers[evt] = fn;
        }
        loadSource(src) {
          loadedSourceUrl = src;
        }
        attachMedia(el) {
          attachedMediaEl = el;
          if (this.handlers.hlsManifestParsed) {
            this.handlers.hlsManifestParsed();
          }
        }
        destroy() {
          destroyedCount++;
        }
      }
      MockHls.Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' };
      MockHls.ErrorTypes = { MEDIA_ERROR: 'mediaError', NETWORK_ERROR: 'networkError' };
      globalThis.Hls = MockHls;

      try {
        // 1. Verify HttpsProxyHlsLoader preserves upstream HTTP context.url and slices byte-ranges over HTTPS proxy
        const LoaderClass = createHttpsProxyHlsLoaderClass({ forceProxy: false });
        const manifestLoader = new LoaderClass();
        const manifestResult = await new Promise((resolve, reject) => {
          manifestLoader.load(
            { url: 'http://legacy-hls.example/live/channel.m3u8', responseType: 'text' },
            {},
            { onSuccess: (res) => resolve(res), onError: (err) => reject(new Error(err.text)) }
          );
        });
        assert.strictEqual(
          manifestResult.url,
          'http://legacy-hls.example/live/channel.m3u8',
          'Loader must report original upstream URL so relative segment paths resolve against http://legacy-hls.example/live/'
        );
        assert.ok(manifestResult.data.includes('seg001.ts'));

        const segLoader = new LoaderClass();
        const segResult = await new Promise((resolve, reject) => {
          segLoader.load(
            {
              url: 'http://legacy-hls.example/live/seg001.ts',
              responseType: 'arraybuffer',
              rangeStart: 2,
              rangeEnd: 6
            },
            {},
            { onSuccess: (res) => resolve(res), onError: (err) => reject(new Error(err.text)) }
          );
        });
        assert.deepStrictEqual(
          Array.from(new Uint8Array(segResult.data)),
          [30, 40, 50, 60],
          'Byte-range HLS segments must be sliced accurately when proxy returns HTTP 200'
        );
        assert.strictEqual(
          requestedUrls.some((u) => u.startsWith('http://')),
          false,
          'Zero raw http:// requests may be issued from an https: origin'
        );

        // 2. Verify startProxiedHlsPlayback attaches ManagedMediaSource with disableRemotePlayback = true and cleans up
        const mockVideoEl = {
          src: '',
          disableRemotePlayback: false,
          playbackRate: 1,
          dataset: {},
          play: () => Promise.resolve(),
          pause() {}
        };
        const hlsItem = {
          id: 'http-m3u8-live',
          title: 'HTTP-Only Live Stream',
          videoUrl: 'http://legacy-hls.example/live/channel.m3u8',
          format: 'm3u8'
        };
        setAppState({ videoQueue: [hlsItem], currentIndex: 0 });

        const started = await startProxiedHlsPlayback(mockVideoEl, hlsItem, hlsItem.videoUrl, { forceProxy: true });
        assert.strictEqual(started, true);
        assert.strictEqual(loadedSourceUrl, 'http://legacy-hls.example/live/channel.m3u8');
        assert.strictEqual(attachedMediaEl, mockVideoEl);
        assert.strictEqual(
          mockVideoEl.disableRemotePlayback,
          true,
          'disableRemotePlayback must be enabled for iPhone Safari ManagedMediaSource attachment'
        );

        detachActiveHlsPlayer(mockVideoEl);
        assert.strictEqual(destroyedCount, 1);
        assert.strictEqual(mockVideoEl.disableRemotePlayback, false, 'disableRemotePlayback must restore on detach');
      } finally {
        clearPlaybackStartupWatchdog();
        detachActiveHlsPlayer();
        globalThis.fetch = origFetch;
        globalThis.window = prevWin;
        globalThis.Hls = prevHls;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should fallback to stitching HTTP-only multi-part fMP4 .m3u8 segments over HTTPS proxy on pre-iOS 17.1 devices without ManagedMediaSource', async () => {
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevDoc = globalThis.document;
      const prevWin = globalThis.window;
      const prevHls = globalThis.Hls;

      delete globalThis.Hls;
      globalThis.window = { location: { protocol: 'https:', href: 'https://davidscottballard1-png.github.io/my-project-2/' } };

      const mockVideoEl = {
        src: 'http://old-vod.example/hls/stream.m3u8',
        readyState: 0,
        currentTime: 0,
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        load() {},
        pause() {},
        play: () => Promise.resolve(),
        removeAttribute(attr) {
          if (attr === 'src') this.src = '';
        }
      };

      globalThis.document = {
        hidden: false,
        body: { classList: { contains: () => false } },
        getElementById: (id) => (id === 'mainVideo' ? mockVideoEl : null),
        querySelector: () => null
      };

      const fmp4Manifest = [
        '#EXTM3U',
        '#EXT-X-VERSION:7',
        '#EXT-X-MAP:URI="init.mp4"',
        '#EXTINF:4.0,',
        'part1.m4s',
        '#EXTINF:4.0,',
        'part2.m4s',
        '#EXT-X-ENDLIST'
      ].join('\n');

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.startsWith('http://') || u.startsWith('https://old-vod.example/')) {
          throw new Error('HTTP-only server');
        }
        if (u.includes(encodeURIComponent('http://old-vod.example/hls/stream.m3u8'))) {
          return new Response(fmp4Manifest, { status: 200, headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
        }
        if (u.includes(encodeURIComponent('http://old-vod.example/hls/init.mp4'))) {
          return new Response(new Uint8Array(600).fill(1), { status: 200, headers: { 'content-type': 'video/mp4' } });
        }
        if (u.includes(encodeURIComponent('http://old-vod.example/hls/part1.m4s'))) {
          return new Response(new Uint8Array(600).fill(2), { status: 200, headers: { 'content-type': 'video/iso.segment' } });
        }
        if (u.includes(encodeURIComponent('http://old-vod.example/hls/part2.m4s'))) {
          return new Response(new Uint8Array(600).fill(3), { status: 200, headers: { 'content-type': 'video/iso.segment' } });
        }
        return new Response('', { status: 404 });
      };

      try {
        const httpM3u8Clip = {
          id: 'http-fmp4-m3u8',
          title: 'HTTP-Only Multi-Part fMP4 HLS',
          videoUrl: 'http://old-vod.example/hls/stream.m3u8',
          format: 'm3u8'
        };
        setAppState({ videoQueue: [httpM3u8Clip], currentIndex: 0 });

        const recovered = await handleVideoPlaybackError();
        assert.strictEqual(recovered, true, 'Pre-iOS 17.1 device without Hls/MMS should stitch fMP4 .m3u8 over HTTPS proxy');
        assert.strictEqual(
          mockVideoEl.src.startsWith('blob:'),
          true,
          'Stitched fMP4 HLS segments should play via local video/mp4 blob: URL'
        );
      } finally {
        clearPlaybackStartupWatchdog();
        globalThis.fetch = origFetch;
        globalThis.document = prevDoc;
        globalThis.window = prevWin;
        globalThis.Hls = prevHls;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should prevent fast HTTP 200 proxy errors/paywalls from poisoning Promise.any on github.io and extract live Eporner /xhr/video/<id> streams across 34 sources', async () => {
      const {
        isLocalDevOrigin,
        calcEpornerBase36Hash,
        buildHttpsMediaProxyCandidates
      } = require('../app.js');
      const origFetch = globalThis.fetch;
      const origState = getAppState();
      const prevWin = globalThis.window;
      const origAllowNsfw = settings.allowNsfw;

      const hitProxyHosts = [];
      globalThis.window = {
        location: {
          protocol: 'https:',
          hostname: 'davidscottballard1-png.github.io',
          href: 'https://davidscottballard1-png.github.io/my-project-2/'
        }
      };

      const sampleHexHash = '0123456789abcdeffedcba9876543210';
      const expectedBase36Hash = calcEpornerBase36Hash(sampleHexHash);

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.startsWith('https://corsproxy.io/')) {
          hitProxyHosts.push('corsproxy.io');
          return {
            ok: true,
            status: 200,
            text: async () => 'corsproxy.io: Production domains require a paid plan and API key. Free tier is localhost only.',
            json: async () => ({ error: 'Production domains require a paid plan and API key' })
          };
        }
        // Fast rate-limited proxy (42 chars >= 35!) returning HTTP 200 immediately
        if (u.startsWith('https://api.codetabs.com/')) {
          hitProxyHosts.push('codetabs');
          return {
            ok: true,
            status: 200,
            text: async () => 'Too many requests, please try again later.',
            json: async () => ({ error: 'Too many requests, please try again later.' })
          };
        }
        // Fast Cloudflare-challenged proxy returning HTTP 200 immediately
        if (u.startsWith('https://api.allorigins.win/')) {
          hitProxyHosts.push('allorigins');
          return {
            ok: true,
            status: 200,
            text: async () => '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Checking your browser...</body></html>',
            json: async () => ({ message: 'Upstream blocked' })
          };
        }

        // Direct Eporner JSON search API works via native CORS
        if (u.startsWith('https://www.eporner.com/api/v2/video/search/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              videos: [
                {
                  id: 'EpLiveHash77',
                  title: 'Live Eporner XHR Stream 720p',
                  length_sec: 320,
                  hd: true,
                  url: 'https://www.eporner.com/video-EpLiveHash77/live-test/',
                  embed: 'https://www.eporner.com/embed/EpLiveHash77/'
                }
              ]
            })
          };
        }

        // Direct cross-origin fetches to Reddit & Eporner HTML/XHR throw CORS TypeError in Safari
        if (!u.startsWith('https://api.cors.lol/?url=')) {
          throw new TypeError('Load failed (CORS)');
        }

        // Slower healthy proxy (api.cors.lol) resolves 15ms later with real upstream payloads
        hitProxyHosts.push('cors.lol');
        await new Promise((r) => setTimeout(r, 15));
        const target = decodeURIComponent(u.slice('https://api.cors.lol/?url='.length));

        if (target.includes('reddit.com/r/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              kind: 'Listing',
              data: {
                children: [
                  {
                    data: {
                      id: 'rd_prod_1',
                      title: 'Production Reddit 18+ Clip',
                      over_18: true,
                      is_video: true,
                      permalink: '/r/RealGirls/comments/rd_prod_1/clip/',
                      media: {
                        reddit_video: {
                          fallback_url: 'https://v.redd.it/prodclip1/DASH_720.mp4?source=fallback',
                          hls_url: 'https://v.redd.it/prodclip1/HLSPlaylist.m3u8',
                          duration: 18,
                          height: 720
                        }
                      }
                    }
                  }
                ]
              }
            })
          };
        }

        if (target.includes('eporner.com/embed/EpLiveHash77')) {
          // Real Eporner embed HTML has NO direct .mp4 URL, only vid + 32-hex hash
          return {
            ok: true,
            status: 200,
            text: async () =>
              `<html><body><script>EP.video.player.vid = 'EpLiveHash77'; EP.video.player.hash = '${sampleHexHash}';</script></body></html>`
          };
        }

        if (
          target.includes(`eporner.com/xhr/video/EpLiveHash77`) &&
          target.includes(`hash=${encodeURIComponent(expectedBase36Hash)}`)
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              sources: {
                mp4: {
                  '720p HD': { src: 'https://s8.eporner.com/dload/EpLiveHash77/720p.mp4' },
                  '480p': { src: 'https://s8.eporner.com/dload/EpLiveHash77/480p.mp4' }
                },
                hls: {
                  auto: { src: 'https://s8.eporner.com/hls/EpLiveHash77/master.m3u8' }
                }
              }
            })
          };
        }

        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };

      try {
        assert.strictEqual(isLocalDevOrigin(), false, 'github.io must be detected as a production non-localhost origin');
        const mediaCandidates = buildHttpsMediaProxyCandidates('http://cdn.example/clip.mp4', { forceProxy: true });
        assert.ok(
          mediaCandidates[0].startsWith('https://api.cors.lol/?url='),
          'Production media proxy candidates must prioritize api.cors.lol ahead of corsproxy.io'
        );

        settings.allowNsfw = true;

        // 1. Subreddit pull succeeds despite codetabs + allorigins returning fast HTTP 200 errors
        const redditClips = await fetchSubredditVideos('RealGirls');
        assert.strictEqual(redditClips.length, 1, 'Subreddit pull must ignore poisoned fast proxies and return valid Reddit 18+ clips');
        assert.ok(redditClips[0].videoUrl.includes('v.redd.it/prodclip1'));
        assert.strictEqual(
          hitProxyHosts.includes('corsproxy.io'),
          false,
          'fetchWithCorsFallback must never race keyless corsproxy.io on production github.io'
        );

        // 2. Eporner Free Tube pull resolves 32-hex hash -> /xhr/video/<id> -> 720p + 480p MP4s
        const epClips = await fetchDirectEpornerVideos('popular hd', 4, 'Free Tube 18+');
        assert.strictEqual(epClips.length, 1, 'Eporner pull must extract real MP4 streams via embed hash + /xhr/video/<id>');
        assert.strictEqual(epClips[0].videoUrl, 'https://s8.eporner.com/dload/EpLiveHash77/720p.mp4');
        assert.strictEqual(epClips[0].convertedUrl, 'https://s8.eporner.com/dload/EpLiveHash77/480p.mp4');

        // 3. Full 34-source Shuffle Random pull populates videoQueue cleanly instead of "No 18+ videos returned"
        const thirtyFourNsfwSources = Array.from({ length: 34 }, (_, idx) =>
          idx % 2 === 0
            ? {
                id: `src-nsfw-sub-${idx}`,
                label: `r/RealGirls_${idx}`,
                type: 'subreddit',
                value: 'RealGirls',
                enabled: true,
                isNsfw: true
              }
            : {
                id: 'src-nsfw-tube-hd',
                label: 'Free Tube 18+ (HD)',
                type: 'freetube',
                value: 'popular hd',
                enabled: true,
                isNsfw: true
              }
        );
        setAppState({ sources: thirtyFourNsfwSources, videoQueue: [], currentIndex: -1 });
        await pullRandomVideos(2);
        const afterPull = getAppState();
        assert.ok(
          afterPull.videoQueue.length >= 1,
          'Shuffle Random across 34 enabled 18+ sources on github.io must populate videoQueue'
        );
      } finally {
        settings.allowNsfw = origAllowNsfw;
        globalThis.fetch = origFetch;
        globalThis.window = prevWin;
        setAppState({
          sources: origState.sources,
          videoQueue: origState.videoQueue,
          currentIndex: origState.currentIndex
        });
      }
    });

    it('should fall back to fetchWithCorsFallback in getRedgifsTempToken when direct temporary auth returns HTTP 403 without throwing', async () => {
      const { getRedgifsTempToken } = require('../app.js');
      const origFetch = globalThis.fetch;
      const prevWin = globalThis.window;
      const origAllowNsfw = settings.allowNsfw;

      globalThis.window = {
        location: {
          protocol: 'https:',
          hostname: 'davidscottballard1-png.github.io',
          href: 'https://davidscottballard1-png.github.io/my-project-2/'
        }
      };
      setAppState({ resetRedgifsToken: true });
      settings.allowNsfw = true;

      let sawBearerHeader = null;
      globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        // Direct temporary auth returns HTTP 403 (non-throw!)
        if (u === 'https://api.redgifs.com/v2/auth/temporary') {
          return { ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) };
        }
        if (
          u.startsWith('https://api.cors.lol/?url=') &&
          decodeURIComponent(u).includes('api.redgifs.com/v2/auth/temporary')
        ) {
          return { ok: true, status: 200, json: async () => ({ token: 'proxy-minted-rg-token-99' }) };
        }
        if (u.startsWith('https://api.redgifs.com/v2/gifs/search')) {
          sawBearerHeader = init?.headers?.Authorization || null;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              gifs: [
                {
                  id: 'redgifsrecovered1',
                  duration: 14,
                  tags: ['amateur', 'hd'],
                  urls: {
                    hd: 'https://media.redgifs.com/RedgifsRecovered1.mp4?expires=4102444800&signature=ok'
                  }
                }
              ]
            })
          };
        }
        return { ok: false, status: 403, text: async () => 'Blocked', json: async () => ({}) };
      };

      try {
        const tok = await getRedgifsTempToken();
        assert.strictEqual(tok, 'proxy-minted-rg-token-99', 'Must mint guest token via CORS proxy when direct auth returns HTTP 403');
        const clips = await searchRedgifsVideos('amateur', 3);
        assert.strictEqual(sawBearerHeader, 'Bearer proxy-minted-rg-token-99');
        assert.strictEqual(clips.length, 1);
        assert.ok(clips[0].videoUrl.includes('RedgifsRecovered1.mp4'));
      } finally {
        setAppState({ resetRedgifsToken: true });
        settings.allowNsfw = origAllowNsfw;
        globalThis.fetch = origFetch;
        globalThis.window = prevWin;
      }
    });
  });
});



