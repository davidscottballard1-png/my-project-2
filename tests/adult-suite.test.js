const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  DEFAULT_SOURCES,
  ADULT_PRESET_SOURCES,
  ADULT_DIRECTORY_CATALOG,
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
  toggleVaultFavorite,
  toggleCurrentVideoFavorite,
  shuffleVaultToPlayer,
  extractSmartVideoTags,
  buildMoreLikeThisQuery,
  skipVideoTime,
  setPlaybackSpeed,
  findDirectoryEntry,
  toggleDirectorySource,
  enableAllDirectorySources,
  disableAllDirectorySources,
  enableDirectoryCategory,
  toggleAdultDirectory,
  renderAdultDirectory,
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
      'moreLikeThisBtn', 'favoriteCurrentBtn', 'videoTagsBar', 'skipBack10Btn', 'skipFwd15Btn',
      'skipFwd30Btn', 'playbackSpeedSelect', 'adultDirectorySection', 'adultDirectoryBody',
      'adultDirectoryList', 'toggleAdultDirectoryBtn',
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

  describe('5. Expandable 18+ Subreddit & Niche Directory', () => {
    it('should expand/collapse the directory and toggle individual, category, or all 18+ directory sources', () => {
      const { elements } = setupTestEnv();
      settings.allowNsfw = true;
      setAppState({ sources: structuredClone(DEFAULT_SOURCES), isAdultDirectoryExpanded: false });

      assert.ok(ADULT_PRESET_SOURCES.length >= 10);
      assert.strictEqual(ADULT_DIRECTORY_CATALOG.length, 5);
      const totalItems = ADULT_DIRECTORY_CATALOG.reduce((sum, g) => sum + (g.items?.length || 0), 0);
      assert.ok(totalItems >= 30);

      const entry = findDirectoryEntry('dir-sub-realgirls');
      assert.ok(entry);
      assert.strictEqual(entry.value, 'RealGirls');

      // Expand directory
      const expanded = toggleAdultDirectory(true);
      assert.strictEqual(expanded, true);
      assert.strictEqual(elements.get('adultDirectoryBody').classList.contains('hidden'), false);
      assert.ok(elements.get('adultDirectoryList').innerHTML.includes('r/RealGirls'));

      // 1-tap toggle adds and enables the source
      const addedSrc = toggleDirectorySource('dir-sub-realgirls');
      assert.ok(addedSrc);
      assert.strictEqual(addedSrc.enabled, true);
      assert.strictEqual(addedSrc.isNsfw, true);

      // Tapping again disables it
      const toggledOff = toggleDirectorySource('dir-sub-realgirls');
      assert.strictEqual(toggledOff.enabled, false);

      // Enable a single category
      const catCount = enableDirectoryCategory('🎬 RedGIFs HD & Loop Niches');
      assert.strictEqual(catCount, 8);

      // Enable all directory sources at once
      const enabledCount = enableAllDirectorySources();
      assert.ok(enabledCount > 0);
      renderAdultDirectory();
      assert.ok(elements.get('adultDirectoryList').innerHTML.includes('✓ Active'));

      // Filter directory by query
      renderAdultDirectory('Mega-Mix');
      assert.ok(elements.get('adultDirectoryList').innerHTML.includes('Reddit 18+ Mega-Mix'));
      assert.ok(!elements.get('adultDirectoryList').innerHTML.includes('r/RealGirls'));

      // Disable all directory sources
      const disabledCount = disableAllDirectorySources();
      assert.strictEqual(disabledCount, totalItems);
    });
  });

  describe('6. Smarter 18+ Discovery & Vault Playback (Interactive Tags, More Like This, Vault Favorites & Shuffle)', () => {
    it('should extract smart interactive video tags and build "More Like This" queries', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.allowNsfw = true;

      const sampleItem = {
        id: 'rg-smart-1',
        title: 'RedGIFs HD — amateur, romantic, sensual, couple',
        videoUrl: 'https://thumbs4.redgifs.com/Smart1.mp4',
        format: 'mp4',
        tags: ['amateur', 'romantic', 'sensual'],
        sourceName: 'RedGIFs (amateur)',
        isNsfw: true
      };

      const tags = extractSmartVideoTags(sampleItem, 5);
      assert.ok(tags.includes('amateur'));
      assert.ok(tags.includes('romantic'));
      assert.strictEqual(buildMoreLikeThisQuery(sampleItem), 'amateur romantic');

      setAppState({ videoQueue: [sampleItem], currentIndex: 0 });
      updatePlayerUI();

      assert.strictEqual(elements.get('videoTagsBar').classList.contains('hidden'), false);
      assert.ok(elements.get('videoTagsBar').innerHTML.includes('data-tag="amateur"'));
      assert.strictEqual(elements.get('moreLikeThisBtn').disabled, false);
      assert.strictEqual(elements.get('favoriteCurrentBtn').disabled, false);
    });

    it('should toggle Vault favorites (❤️) and shuffle 18+ Vault videos directly into the Player or Reels mode', async () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.allowNsfw = true;

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

      await saveVideoToVaultDB({
        id: 'v-fav-1',
        title: 'Favorite 18+ Clip',
        videoUrl: 'https://ex.com/fav1.mp4',
        isNsfw: true,
        isFavorite: false,
        savedAt: 100
      });
      await saveVideoToVaultDB({
        id: 'v-other-2',
        title: 'Second 18+ Clip',
        videoUrl: 'https://ex.com/other2.mp4',
        isNsfw: true,
        isFavorite: false,
        savedAt: 200
      });

      // Toggle favorite on v-fav-1
      const updated = await toggleVaultFavorite('v-fav-1');
      assert.strictEqual(updated.isFavorite, true);

      // Filter Vault by Favorites Only
      settings.vaultFilter = 'favorites';
      await renderVaultList();
      assert.strictEqual(elements.get('vaultBadge').textContent, '1');
      assert.ok(elements.get('vaultList').innerHTML.includes('Favorite 18+ Clip'));
      assert.ok(!elements.get('vaultList').innerHTML.includes('Second 18+ Clip'));

      // Shuffle Favorites into Fullscreen Reels Mode
      const shuffled = await shuffleVaultToPlayer({ favoritesOnly: true, startReels: true });
      assert.strictEqual(shuffled.length, 1);
      assert.strictEqual(shuffled[0].id, 'v-fav-1');
      assert.strictEqual(getAppState().isReelsFullscreen, true);

      // Toggle favorite on current player video
      const nowFav = await toggleCurrentVideoFavorite();
      assert.strictEqual(nowFav, false);

      await clearVaultDB();
    });
  });

  describe('7. Quick Skip (-10s / +15s / +30s) & Playback Speed Control (0.5x – 2x)', () => {
    it('should skip forward (+15s / +30s) and backward (-10s) with duration clamping and save playback state', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;
      settings.resumePlayback = true;

      const clip = {
        id: 'skip-clip-1',
        title: 'Full Length Tube Clip',
        videoUrl: 'https://ex.com/long.mp4',
        format: 'mp4',
        isNsfw: true
      };
      setAppState({ videoQueue: [clip], currentIndex: 0 });
      updatePlayerUI();

      const mainVideo = elements.get('mainVideo');
      mainVideo.duration = 100;
      mainVideo.currentTime = 20;

      // Skip +15s -> 35s
      assert.strictEqual(skipVideoTime(15), 35);
      assert.strictEqual(mainVideo.currentTime, 35);
      assert.strictEqual(getSavedPlaybackTime(clip), 35);

      // Skip +30s -> 65s
      assert.strictEqual(skipVideoTime(30), 65);
      assert.strictEqual(mainVideo.currentTime, 65);

      // Skip -10s -> 55s
      assert.strictEqual(skipVideoTime(-10), 55);
      assert.strictEqual(mainVideo.currentTime, 55);

      // Clamp at 0s and duration (100s)
      assert.strictEqual(skipVideoTime(-999), 0);
      assert.strictEqual(skipVideoTime(500), 100);
    });

    it('should set playback speed (0.5x – 2x) and preserve speed across video changes', () => {
      const { elements } = setupTestEnv();
      settings.prebuffer = false;

      assert.strictEqual(setPlaybackSpeed(1.5), 1.5);
      assert.strictEqual(settings.playbackSpeed, 1.5);
      assert.strictEqual(elements.get('mainVideo').playbackRate, 1.5);
      assert.strictEqual(elements.get('playbackSpeedSelect').value, '1.5');

      assert.strictEqual(setPlaybackSpeed(0.5), 0.5);
      assert.strictEqual(elements.get('mainVideo').playbackRate, 0.5);

      // Invalid speed falls back to 1x
      assert.strictEqual(setPlaybackSpeed(99), 1);
      assert.strictEqual(elements.get('mainVideo').playbackRate, 1);
    });
  });
});
