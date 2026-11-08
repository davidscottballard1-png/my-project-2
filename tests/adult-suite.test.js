const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  DEFAULT_SOURCES,
  ADULT_PRESET_SOURCES,
  FALLBACK_VIDEOS,
  settings,
  extractRedgifsId,
  resolveRedgifsUrlToMp4,
  searchRedgifsVideos,
  filterAndSortTubeResults,
  extractRedditVideosFromListing,
  unlockAdultPresetSources,
  getEffectiveActiveSources,
  setNsfwPin,
  clearNsfwPin,
  verifyNsfwPin,
  scrubNsfwFromActiveSession,
  triggerPanicSafeMode,
  getSavedPlaybackTime,
  savePlaybackState,
  restorePlaybackState,
  handleVisibilityPlaybackChange,
  buildExportFilename,
  setAdultContentEnabled,
  renderSourcesList,
  renderVaultList,
  saveVideoToVaultDB,
  clearVaultDB,
  updatePlayerUI,
  getAppState,
  setAppState
} = require('../app.js');

describe('Full 18+ Feature Suite: Strict Mode, RedGIFs Resolver, Hidden Vault, PIN Lock & Privacy Controls', () => {
  const defaultSettingsSnapshot = { ...settings };

  afterEach(() => {
    Object.assign(settings, defaultSettingsSnapshot);
    setAppState({
      sources: structuredClone(DEFAULT_SOURCES),
      videoQueue: [],
      currentIndex: -1,
      isReelsFullscreen: false,
      lastSearchResults: []
    });
  });

  function setupTestEnv() {
    const elements = new Map();
    function makeEl(id) {
      const classes = new Set();
      const el = {
        id,
        textContent: '',
        innerHTML: '',
        value: '',
        src: '',
        href: '',
        muted: false,
        disabled: false,
        checked: false,
        dataset: {},
        style: {},
        paused: false,
        pause() {
          this.paused = true;
        },
        load() {},
        play: () => Promise.resolve(),
        setAttribute() {},
        classList: {
          add: (...t) => t.forEach((c) => classes.add(c)),
          remove: (...t) => t.forEach((c) => classes.delete(c)),
          toggle: (c, force) => {
            const add = typeof force === 'boolean' ? force : !classes.has(c);
            if (add) classes.add(c);
            else classes.delete(c);
            return add;
          },
          contains: (c) => classes.has(c)
        }
      };
      elements.set(id, el);
      return el;
    }

    [
      'ageGateToggleBtn', 'allowNsfwToggle', 'ageGateModal', 'toast',
      'panicSafeBtn', 'nsfwQuickChipsBar', 'searchNsfwChipsBar', 'loadAdultPresetsBtn',
      'vaultFilterSelect', 'nsfwModeSelect', 'nsfwQuickModeBtn', 'nsfwLockStatusBadge',
      'sourcesList', 'searchResultsList', 'searchResultsCount', 'activeSourceSummary',
      'mainVideo', 'videoTitle', 'videoSourceBadge', 'videoFormatBadge', 'convertNowBtn',
      'queueCounter', 'videoOriginalLink', 'prevVideoBtn', 'saveToPhoneBtn', 'saveToVaultBtn',
      'playerEmpty', 'playerLoading', 'playerLoadingText', 'reelsHudOverlay', 'reelsHudBadge',
      'reelsHudTitle', 'videoStage', 'prebufferBadge', 'vaultList', 'vaultBadge',
      'vaultStorageSummary', 'vaultHiddenNotice'
    ].forEach(makeEl);

    const storage = new Map();
    globalThis.localStorage = {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    };

    globalThis.document = {
      hidden: false,
      visibilityState: 'visible',
      getElementById: (id) => elements.get(id) || null,
      createElement: (tag) => makeEl(tag),
      body: makeEl('body'),
      querySelectorAll: () => []
    };

    return { elements, storage };
  }

  describe('1. Strict 18+ Only Mode & Built-In 18+ Source Presets', () => {
    it('should unlock ADULT_PRESET_SOURCES without duplicating and filter sources by Safe vs Mixed vs Strict 18+ mode', () => {
      setupTestEnv();
      setAppState({ sources: structuredClone(DEFAULT_SOURCES) });

      // Safe mode: only non-NSFW sources returned
      settings.allowNsfw = false;
      settings.nsfwMode = 'safe';
      const added = unlockAdultPresetSources();
      assert.strictEqual(added, ADULT_PRESET_SOURCES.length);
      assert.strictEqual(unlockAdultPresetSources(), 0, 'Should not duplicate preset sources');

      const safeActive = getEffectiveActiveSources();
      assert.ok(safeActive.every((s) => !s.isNsfw), 'Safe mode must exclude all 18+ sources');
      assert.strictEqual(safeActive.length, DEFAULT_SOURCES.length);

      // Strict 18+ mode: only isNsfw sources returned
      settings.allowNsfw = true;
      settings.nsfwMode = 'strict';
      const strictActive = getEffectiveActiveSources();
      assert.ok(strictActive.length >= ADULT_PRESET_SOURCES.length);
      assert.ok(strictActive.every((s) => s.isNsfw === true), 'Strict 18+ mode must only include 18+ sources');

      // Mixed mode: both SFW and 18+ sources returned
      settings.nsfwMode = 'mixed';
      const mixedActive = getEffectiveActiveSources();
      assert.strictEqual(mixedActive.length, DEFAULT_SOURCES.length + ADULT_PRESET_SOURCES.length);
    });

    it('should hide 18+ sources in renderSourcesList when Safe Mode is active and show them when 18+ is On', () => {
      const { elements } = setupTestEnv();
      setAppState({
        sources: [
          { id: 'sfw-1', type: 'keyword', value: 'nature', label: 'Nature Clips', enabled: true, isNsfw: false },
          { id: 'nsfw-1', type: 'subreddit', value: 'nsfw', label: '🔞 r/NSFW', enabled: true, isNsfw: true }
        ]
      });

      settings.allowNsfw = false;
      renderSourcesList();
      assert.ok(elements.get('sourcesList').innerHTML.includes('Nature Clips'));
      assert.ok(!elements.get('sourcesList').innerHTML.includes('r/NSFW'), '18+ source must be hidden in Safe Mode');

      settings.allowNsfw = true;
      renderSourcesList();
      assert.ok(elements.get('sourcesList').innerHTML.includes('r/NSFW'), '18+ source must appear when 18+ is On');
      assert.ok(elements.get('sourcesList').innerHTML.includes('🔞 18+'));
    });

    it('should filter out SFW Reddit posts when nsfwMode is "strict"', () => {
      settings.allowNsfw = true;
      settings.nsfwMode = 'strict';

      const listing = {
        data: {
          children: [
            {
              data: {
                id: 'sfwPost',
                over_18: false,
                title: 'Safe Kitten Clip',
                url_overridden_by_dest: 'https://cdn.example.com/kitten.mp4'
              }
            },
            {
              data: {
                id: 'nsfwPost',
                over_18: true,
                title: 'Strict 18+ Clip',
                url_overridden_by_dest: 'https://cdn.example.com/adult.mp4'
              }
            }
          ]
        }
      };

      const extracted = extractRedditVideosFromListing(listing, 'Strict Test');
      assert.strictEqual(extracted.length, 1);
      assert.strictEqual(extracted[0].id, 'rd-nsfwPost');
      assert.strictEqual(extracted[0].isNsfw, true);
    });
  });

  describe('2. RedGIFs Direct .MP4 Resolver & Tube Duration/HD Filters', () => {
    it('should extract RedGIFs IDs from watch, ifr, detail, and thumbs CDN URLs', () => {
      assert.strictEqual(extractRedgifsId('https://www.redgifs.com/watch/velvetyanimatedfox'), 'velvetyanimatedfox');
      assert.strictEqual(extractRedgifsId('https://redgifs.com/ifr/VelvetyAnimatedFox'), 'velvetyanimatedfox');
      assert.strictEqual(
        extractRedgifsId('https://thumbs4.redgifs.com/VelvetyAnimatedFox-mobile.mp4'),
        'VelvetyAnimatedFox'
      );
      assert.strictEqual(extractRedgifsId('https://example.com/video.mp4'), null);
    });

    it('should resolve RedGIFs watch URLs into direct HD .mp4 streams via RedGIFs API v2', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'temp-guest-token' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/sampleclip')) {
          return {
            ok: true,
            json: async () => ({
              gif: {
                id: 'sampleclip',
                duration: 24,
                tags: ['hd', 'trending'],
                urls: {
                  hd: 'https://thumbs4.redgifs.com/SampleClip.mp4',
                  sd: 'https://thumbs4.redgifs.com/SampleClip-mobile.mp4'
                }
              }
            })
          };
        }
        return { ok: false, status: 404 };
      };

      try {
        const item = await resolveRedgifsUrlToMp4('https://www.redgifs.com/watch/sampleclip');
        assert.ok(item);
        assert.strictEqual(item.id, 'rg-sampleclip');
        assert.strictEqual(item.videoUrl, 'https://thumbs4.redgifs.com/SampleClip.mp4');
        assert.strictEqual(item.isHd, true);
        assert.strictEqual(item.isNsfw, true);
        assert.strictEqual(item.duration, 24);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should resolve external redgifs.com links inside Reddit listings and searchRedgifsVideos', async () => {
      settings.allowNsfw = true;
      settings.nsfwMode = 'mixed';

      const redditListing = {
        data: {
          children: [
            {
              data: {
                id: 'rgpost1',
                over_18: true,
                title: 'RedGIFs Reddit Post',
                url_overridden_by_dest: 'https://www.redgifs.com/watch/brightgoldendog',
                media: {
                  oembed: {
                    thumbnail_url: 'https://thumbs4.redgifs.com/BrightGoldenDog-poster.jpg'
                  }
                }
              }
            }
          ]
        }
      };

      const redditItems = extractRedditVideosFromListing(redditListing, 'r/NSFW_GIF');
      assert.strictEqual(redditItems.length, 1);
      assert.strictEqual(redditItems[0].videoUrl, 'https://thumbs4.redgifs.com/BrightGoldenDog.mp4');
      assert.strictEqual(redditItems[0].isNsfw, true);

      // Test searchRedgifsVideos with duration & HD filters
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/search')) {
          return {
            ok: true,
            json: async () => ({
              gifs: [
                { id: 'rg1', duration: 18, tags: ['Loop'], urls: { hd: 'https://thumbs4.redgifs.com/Rg1.mp4' } }
              ]
            })
          };
        }
        return { ok: false, status: 404 };
      };

      try {
        const found = await searchRedgifsVideos('loop', 3);
        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0].id, 'rg-rg1');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should filter tube results by duration (short/medium/long) and quality (hd)', () => {
      const sampleItems = [
        { id: '1', title: 'Short HD Clip', videoUrl: 'https://ex.com/a_1080p.mp4', duration: 45, isHd: true },
        { id: '2', title: 'Medium SD Clip', videoUrl: 'https://ex.com/b_360p.mp4', duration: 240, isHd: false },
        { id: '3', title: 'Full Length HD Movie', videoUrl: 'https://ex.com/c_720p.mp4', duration: 900, isHd: true }
      ];

      assert.strictEqual(filterAndSortTubeResults(sampleItems, 'short', 'all').length, 1);
      assert.strictEqual(filterAndSortTubeResults(sampleItems, 'medium', 'all')[0].id, '2');
      assert.strictEqual(filterAndSortTubeResults(sampleItems, 'long', 'hd')[0].id, '3');
      assert.strictEqual(filterAndSortTubeResults(sampleItems, 'all', 'hd').length, 2);
    });
  });

  describe('3. Hidden 18+ Vault, 4-Digit PIN Lock & Instant Safe-Mode Scrubbing', () => {
    it('should validate, save, verify, and clear 4-digit PIN lock', () => {
      setupTestEnv();
      assert.strictEqual(setNsfwPin('abc'), false, 'Non-numeric PIN should be rejected');
      assert.strictEqual(setNsfwPin('123'), false, '3-digit PIN should be rejected');
      assert.strictEqual(setNsfwPin('4829'), true, '4-digit PIN should be accepted');
      assert.strictEqual(settings.nsfwPin, '4829');
      assert.strictEqual(verifyNsfwPin('0000'), false);
      assert.strictEqual(verifyNsfwPin('4829'), true);

      clearNsfwPin();
      assert.strictEqual(settings.nsfwPin, '');
      assert.strictEqual(verifyNsfwPin('anything'), true);
    });

    it('should hide 18+ Vault videos when Safe Mode is active and reveal them when 18+ is On', async () => {
      const { elements } = setupTestEnv();
      const records = new Map();
      const store = {
        getAll: () => {
          const req = { result: [...records.values()], onsuccess: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
        put: (rec) => {
          records.set(rec.id, rec);
          const req = { result: rec.id, onsuccess: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
        clear: () => {
          records.clear();
          const req = { onsuccess: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        }
      };
      globalThis.indexedDB = {
        open: () => {
          const req = {
            result: {
              objectStoreNames: { contains: () => true },
              transaction: () => ({ objectStore: () => store })
            },
            onsuccess: null
          };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        }
      };

      // Save 1 safe video and 1 18+ video
      settings.allowNsfw = false;
      await saveVideoToVaultDB({ id: 'v-safe', title: 'Safe Space Clip', videoUrl: 'https://ex.com/s.mp4', savedAt: 100 });
      settings.allowNsfw = true;
      await saveVideoToVaultDB({ id: 'v-adult', title: 'Private 18+ Clip', videoUrl: 'https://ex.com/a.mp4', savedAt: 200 });

      // In 18+ mode: both videos visible
      await renderVaultList();
      assert.strictEqual(elements.get('vaultBadge').textContent, '2');
      assert.ok(elements.get('vaultList').innerHTML.includes('Private 18+ Clip'));
      assert.strictEqual(elements.get('vaultHiddenNotice').classList.contains('hidden'), true);

      // Switch to Safe Mode: 18+ video is hidden and locked notice is shown
      settings.allowNsfw = false;
      await renderVaultList();
      assert.strictEqual(elements.get('vaultBadge').textContent, '1');
      assert.ok(!elements.get('vaultList').innerHTML.includes('Private 18+ Clip'));
      assert.ok(elements.get('vaultList').innerHTML.includes('Safe Space Clip'));
      assert.strictEqual(elements.get('vaultHiddenNotice').classList.contains('hidden'), false);

      await clearVaultDB();
    });

    it('should scrub 18+ videos from active player, queue, and search results when turning 18+ Off', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.allowNsfw = true;

      setAppState({
        videoQueue: [
          { id: 'sfw1', title: 'Safe Clip', videoUrl: 'https://ex.com/sfw.mp4', format: 'mp4', isNsfw: false },
          { id: 'nsfw1', title: 'Adult Clip', videoUrl: 'https://ex.com/nsfw.mp4', format: 'mp4', isNsfw: true }
        ],
        currentIndex: 1,
        lastSearchResults: [
          { id: 'sfw1', title: 'Safe Clip', videoUrl: 'https://ex.com/sfw.mp4', format: 'mp4', isNsfw: false },
          { id: 'nsfw1', title: 'Adult Clip', videoUrl: 'https://ex.com/nsfw.mp4', format: 'mp4', isNsfw: true }
        ]
      });

      setAdultContentEnabled(false);

      const state = getAppState();
      assert.strictEqual(state.videoQueue.length, 1);
      assert.strictEqual(state.videoQueue[0].id, 'sfw1');
      assert.strictEqual(state.currentIndex, 0);
      assert.strictEqual(state.lastSearchResults.length, 1);
      assert.strictEqual(elements.get('mainVideo').paused, true);
    });
  });

  describe('4. iPhone Privacy & Discreet Playback Controls', () => {
    it('should generate neutral discreet filenames when saving 18+ videos and preserve normal slugs for safe videos', () => {
      settings.discreetFilenames = true;
      settings.allowNsfw = false;

      const sfwName = buildExportFilename({ id: '1', title: 'Apollo 11 Launch', isNsfw: false }, 'mp4');
      assert.strictEqual(sfwName, 'apollo-11-launch.mp4');

      const nsfwName = buildExportFilename({ id: 'ep-999', title: 'Explicit Title Here', isNsfw: true }, 'mp4');
      assert.match(nsfwName, /^reelvault-clip-\d{4}\.mp4$/);
      assert.ok(!nsfwName.includes('explicit'));
    });

    it('should automatically mute #mainVideo when playing an 18+ video with autoMuteNsfw enabled', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.allowNsfw = true;
      settings.autoMuteNsfw = true;

      setAppState({
        videoQueue: [
          { id: 'nsfw-mute', title: '18+ Clip', videoUrl: 'https://ex.com/adult.mp4', format: 'mp4', isNsfw: true }
        ],
        currentIndex: 0
      });

      updatePlayerUI();
      assert.strictEqual(elements.get('mainVideo').muted, true);
    });

    it('should save exact playback timestamp when backgrounded and pick up right where you left off when returning', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.allowNsfw = true;
      settings.resumePlayback = true;

      const sampleClip = {
        id: 'resume-clip-1',
        title: 'Resume Test Video',
        videoUrl: 'https://ex.com/resume-test.mp4',
        format: 'mp4',
        isNsfw: true
      };

      setAppState({
        videoQueue: [sampleClip],
        currentIndex: 0
      });
      updatePlayerUI();

      // Simulate user watching up to 47.5 seconds and backgrounding the app
      const mainVideo = elements.get('mainVideo');
      mainVideo.currentTime = 47.5;
      globalThis.document.hidden = true;
      globalThis.document.visibilityState = 'hidden';

      handleVisibilityPlaybackChange();

      // 18+ mode remains active (no auto-lock on background) and timestamp is persisted
      assert.strictEqual(settings.allowNsfw, true);
      assert.strictEqual(getSavedPlaybackTime(sampleClip), 47.5);

      // Simulate fresh app reload / return and restoring where the user left off
      setAppState({ videoQueue: [], currentIndex: -1, playbackPositions: {} });
      mainVideo.src = '';
      mainVideo.currentTime = 0;

      globalThis.document.hidden = false;
      globalThis.document.visibilityState = 'visible';
      const restored = restorePlaybackState();

      assert.strictEqual(restored, true);
      const state = getAppState();
      assert.strictEqual(state.videoQueue.length, 1);
      assert.strictEqual(state.videoQueue[0].id, 'resume-clip-1');
      assert.strictEqual(mainVideo.src, 'https://ex.com/resume-test.mp4');
      assert.strictEqual(mainVideo.currentTime, 47.5);
    });

    it('should immediately drop into Safe Mode, exit Reels fullscreen, and load a harmless NASA clip on triggerPanicSafeMode', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.allowNsfw = true;
      setAppState({
        videoQueue: [{ id: 'nsfw-active', title: 'Adult Video', videoUrl: 'https://ex.com/x.mp4', isNsfw: true }],
        currentIndex: 0,
        isReelsFullscreen: true
      });

      triggerPanicSafeMode();

      const state = getAppState();
      assert.strictEqual(settings.allowNsfw, false);
      assert.strictEqual(state.isReelsFullscreen, false);
      assert.strictEqual(state.videoQueue.length, 1);
      assert.strictEqual(state.videoQueue[0].id, FALLBACK_VIDEOS[0].id);
      assert.strictEqual(elements.get('mainVideo').muted, true);
      assert.ok(elements.get('toast').textContent.includes('Safe Mode Active'));
    });
  });
});
