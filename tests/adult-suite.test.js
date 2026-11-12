const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  STORAGE_KEYS,
  DEFAULT_SOURCES,
  ADULT_PRESET_SOURCES,
  ADULT_DIRECTORY_CATALOG,
  FALLBACK_VIDEOS,
  settings,
  extractRedgifsId,
  resolveRedgifsUrlToMp4,
  isAudioEssentialQuery,
  fetchDirectEpornerVideos,
  searchRedgifsVideos,
  filterAndSortTubeResults,
  extractRedditVideosFromListing,
  fetchSubredditVideos,
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
  renderSearchResults,
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
  getAllVaultVideos,
  deleteVaultVideoDB,
  clearVaultDB,
  scanUrlForVideos,
  extractCandidateWebPagesFromSearchHtml,
  getVideoRefererUrl,
  isIpBoundEmbedOrCdnUrl,
  buildHttpsMediaProxyCandidates,
  setCloudBackendConfig,
  clearCloudBackendConfig,
  getSourceCacheKey,
  updateHeaderSummary,
  revokeVideoItemBlobUrls,
  updatePlayerUI,
  obtainIphoneReadyVideoBlob,
  saveAndCacheVideoToVault,
  rehydrateQueueOfflineBlobsFromVault,
  searchFediverseVideos,
  loadState,
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
    it('should unlock ADULT_PRESET_SOURCES without duplicating and strictly exclude safe sources when 18+ mode is On (no Mixed Mode)', () => {
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

      // 18+ mode: always strictly 18+ only (safe sources removed, no mixed mode)
      settings.allowNsfw = true;
      const strictActive = getEffectiveActiveSources();
      assert.strictEqual(strictActive.length, ADULT_PRESET_SOURCES.length);
      assert.ok(strictActive.every((s) => s.isNsfw === true), '18+ mode must only include 18+ sources and remove safe sources');
    });

    it('should hide 18+ sources in Safe Mode and remove all safe sources & safe video options when 18+ is On', () => {
      const { elements } = setupTestEnv();
      setAppState({
        sources: [
          { id: 'sfw-1', type: 'keyword', value: 'nature', label: 'Nature Clips', enabled: true, isNsfw: false },
          { id: 'nsfw-1', type: 'subreddit', value: 'nsfw', label: '🔞 r/NSFW', enabled: true, isNsfw: true }
        ],
        videoQueue: [
          { id: 'sfw-q', title: 'Safe Clip', videoUrl: 'https://ex.com/sfw.mp4', format: 'mp4', isNsfw: false }
        ],
        currentIndex: 0
      });

      settings.allowNsfw = false;
      renderSourcesList();
      assert.ok(elements.get('sourcesList').innerHTML.includes('Nature Clips'));
      assert.ok(!elements.get('sourcesList').innerHTML.includes('r/NSFW'), '18+ source must be hidden in Safe Mode');

      setAdultContentEnabled(true);
      assert.strictEqual(settings.nsfwMode, 'strict');
      assert.ok(elements.get('sourcesList').innerHTML.includes('r/NSFW'), '18+ source must appear when 18+ is On');
      assert.ok(!elements.get('sourcesList').innerHTML.includes('Nature Clips'), 'Safe source must be removed when 18+ is On');
      assert.strictEqual(getAppState().videoQueue.length, 0, 'Safe video in queue must be scrubbed when 18+ is turned On');
    });

    it('should filter out SFW Reddit posts whenever 18+ mode is On', () => {
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

      assert.ok(ADULT_PRESET_SOURCES.length >= 13);
      assert.ok(ADULT_PRESET_SOURCES.some((s) => s.id === 'src-nsfw-fulltaboo' && s.value === 'https://fulltaboo.tv/'));
      assert.ok(ADULT_PRESET_SOURCES.some((s) => s.id === 'src-nsfw-asmr-roleplay' && s.value === 'asmr roleplay'));
      assert.ok(ADULT_PRESET_SOURCES.some((s) => s.id === 'src-nsfw-asmr-gfe' && s.value === 'asmr tease'));
      assert.ok(ADULT_DIRECTORY_CATALOG.length >= 6);
      const totalItems = ADULT_DIRECTORY_CATALOG.reduce((sum, g) => sum + (g.items?.length || 0), 0);
      assert.ok(totalItems >= 44);

      const ftEntry = findDirectoryEntry('dir-tube-fulltaboo');
      assert.ok(ftEntry);
      assert.strictEqual(ftEntry.type, 'url');
      assert.strictEqual(ftEntry.value, 'https://fulltaboo.tv/');

      const gfeEntry = findDirectoryEntry('dir-asmr-gfe');
      assert.ok(gfeEntry);
      assert.strictEqual(gfeEntry.value, 'girlfriend roleplay asmr');

      const entry = findDirectoryEntry('dir-sub-realgirls');
      assert.ok(entry);
      assert.strictEqual(entry.value, 'RealGirls');

      // Expand directory
      const expanded = toggleAdultDirectory(true);
      assert.strictEqual(expanded, true);
      assert.strictEqual(elements.get('adultDirectoryBody').classList.contains('hidden'), false);
      assert.ok(elements.get('adultDirectoryList').innerHTML.includes('r/RealGirls'));
      assert.ok(elements.get('adultDirectoryList').innerHTML.includes('FullTaboo.tv'));
      assert.ok(elements.get('adultDirectoryList').innerHTML.includes('Girlfriend Experience (GFE) ASMR'));

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

      const asmrCatCount = enableDirectoryCategory('🎧 18+ ASMR, Roleplay & GFE');
      assert.strictEqual(asmrCatCount, 8);

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

  describe('8. Audit Bug Fixes & Edge-Case Regressions', () => {
    it('should report effective active source count in header summary across Safe and 18+ mode transitions', () => {
      const { elements } = setupTestEnv();
      setAppState({ sources: structuredClone(DEFAULT_SOURCES) });
      settings.allowNsfw = false;
      updateHeaderSummary();
      assert.ok(
        elements.get('activeSourceSummary').textContent.startsWith(`${DEFAULT_SOURCES.length} sources`),
        'Safe mode should show 6 active safe sources'
      );

      setAdultContentEnabled(true);
      const nsfwEffective = getEffectiveActiveSources().length;
      assert.ok(
        elements.get('activeSourceSummary').textContent.startsWith(`${nsfwEffective} sources`),
        '18+ mode should show only effective 18+ sources'
      );

      setAdultContentEnabled(false);
      const safeEffective = getEffectiveActiveSources().length;
      assert.strictEqual(safeEffective, DEFAULT_SOURCES.length);
      assert.ok(
        elements.get('activeSourceSummary').textContent.startsWith(`${safeEffective} sources`),
        'Returning to Safe mode should show 6 active safe sources, not 6 + 11'
      );
    });

    it('should preserve cached offlineBlob and deduplicate by videoUrl when toggling Favorite in Player', async () => {
      setupTestEnv();
      settings.prebuffer = false;

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

      const fakeBlob = new Blob([new Uint8Array(1024 * 512)], { type: 'video/mp4' });
      const clipWithoutId = {
        title: 'Offline Dedup Test',
        videoUrl: 'https://ex.com/offline-dedup.mp4',
        format: 'mp4',
        isNsfw: false
      };

      setAppState({ videoQueue: [clipWithoutId], currentIndex: 0 });
      await saveVideoToVaultDB(clipWithoutId, { blob: fakeBlob, ext: 'mp4', mime: 'video/mp4' });
      assert.ok(clipWithoutId.id, 'saveVideoToVaultDB should sync generated id onto videoItem');

      // Now toggle Favorite in Player without passing offlineData
      await toggleCurrentVideoFavorite();
      const allItems = await getAllVaultVideos();
      assert.strictEqual(allItems.length, 1, 'Should not create duplicate Vault records');
      assert.strictEqual(allItems[0].isFavorite, true);
      assert.strictEqual(allItems[0].hasOfflineBlob, true, 'Should preserve hasOfflineBlob when toggling favorite');
      assert.strictEqual(allItems[0].offlineSize, 1024 * 512, 'Should preserve offlineSize when toggling favorite');
      assert.ok(allItems[0].offlineBlob instanceof Blob, 'Should preserve offlineBlob when toggling favorite');

      await clearVaultDB();
    });

    it('should keep fallback video paused and muted on triggerPanicSafeMode even when autoPlay is enabled', () => {
      const { elements } = setupTestEnv();
      const mainVideo = elements.get('mainVideo');
      mainVideo.play = function () {
        this.paused = false;
        return Promise.resolve();
      };
      settings.autoPlay = true;
      settings.allowNsfw = true;
      setAppState({
        videoQueue: [{ id: 'nsfw-1', title: '18+ Clip', videoUrl: 'https://ex.com/nsfw.mp4', isNsfw: true }],
        currentIndex: 0
      });

      triggerPanicSafeMode();

      assert.strictEqual(mainVideo.muted, true, 'Panic fallback video must be muted');
      assert.strictEqual(mainVideo.paused, true, 'Panic fallback video must remain paused');
    });

    it('should not restore a safe video into 18+ Only Mode on restorePlaybackState', () => {
      setupTestEnv();
      settings.allowNsfw = false;
      settings.resumePlayback = true;
      setAppState({
        videoQueue: [{ id: 'safe-1', title: 'Safe Clip', videoUrl: 'https://ex.com/safe.mp4', isNsfw: false }],
        currentIndex: 0
      });
      savePlaybackState(12);

      // Switch to 18+ mode and attempt restorePlaybackState
      settings.allowNsfw = true;
      setAppState({ videoQueue: [], currentIndex: -1 });
      const restored = restorePlaybackState();
      assert.strictEqual(restored, false, 'Safe video should not be restored when allowNsfw is true');
      assert.strictEqual(getAppState().videoQueue.length, 0);
    });

    it('should revoke object URLs when revokeVideoItemBlobUrls is called on removed queue items', () => {
      const origRevoke = URL.revokeObjectURL;
      const revoked = [];
      URL.revokeObjectURL = (u) => revoked.push(u);
      try {
        const item = {
          id: 'blob-item-1',
          videoUrl: 'https://ex.com/v.mp4',
          convertedBlobUrl: 'blob:https://ex.com/conv-1',
          offlineObjectUrl: 'blob:https://ex.com/off-1'
        };
        revokeVideoItemBlobUrls([item]);
        assert.deepStrictEqual(revoked, ['blob:https://ex.com/conv-1', 'blob:https://ex.com/off-1']);
        assert.strictEqual(item.convertedBlobUrl, undefined);
        assert.strictEqual(item.offlineObjectUrl, undefined);
      } finally {
        URL.revokeObjectURL = origRevoke;
      }
    });

    it('should safely decode malformed percent-encoding and enforce formatMode on direct URLs in scanUrlForVideos', async () => {
      setupTestEnv();
      settings.formatMode = 'all';
      const malformedDirect = await scanUrlForVideos('https://example.com/clip_100%_raw.mp4');
      assert.strictEqual(malformedDirect.length, 1);
      assert.strictEqual(malformedDirect[0].title, 'clip_100%_raw.mp4');

      settings.formatMode = 'mp4';
      const filteredWebm = await scanUrlForVideos('https://example.com/sample.webm');
      assert.strictEqual(filteredWebm.length, 0, 'Direct .webm URL should be filtered when formatMode is mp4');
    });

    it('should include tubeDurationFilter and tubeQualityFilter in getSourceCacheKey', () => {
      setupTestEnv();
      const src = { id: 's1', type: 'keyword', value: 'test', enabled: true, isNsfw: false };
      settings.tubeDurationFilter = 'all';
      settings.tubeQualityFilter = 'all';
      const keyAll = getSourceCacheKey(src);

      settings.tubeDurationFilter = 'long';
      settings.tubeQualityFilter = 'hd';
      const keyLongHd = getSourceCacheKey(src);
      assert.notStrictEqual(keyAll, keyLongHd);
    });

    it('should reset isFavorite on active videoQueue items when deleted or cleared from Vault', async () => {
      setupTestEnv();
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
        delete: (id) => {
          records.delete(id);
          const req = { onsuccess: null };
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

      const item = {
        id: 'vault-del-sync-1',
        title: 'Sync Test',
        videoUrl: 'https://ex.com/sync.mp4',
        isNsfw: false
      };
      setAppState({ videoQueue: [item], currentIndex: 0 });
      await toggleCurrentVideoFavorite();
      assert.strictEqual(getAppState().videoQueue[0].isFavorite, true);

      await deleteVaultVideoDB(item.id);
      assert.strictEqual(getAppState().videoQueue[0].isFavorite, false);
    });

    it('should preserve the active video and timestamp when currentIndex >= 25 in savePlaybackState / restorePlaybackState', () => {
      setupTestEnv();
      settings.allowNsfw = false;
      settings.resumePlayback = true;
      const queue = Array.from({ length: 28 }, (_, i) => ({
        id: `q-item-${i}`,
        title: `Video ${i}`,
        videoUrl: `https://ex.com/v${i}.mp4`,
        isNsfw: false
      }));
      setAppState({ videoQueue: queue, currentIndex: 26 });
      savePlaybackState(37.5);

      setAppState({ videoQueue: [], currentIndex: -1 });
      const restored = restorePlaybackState();
      assert.strictEqual(restored, true);
      const state = getAppState();
      assert.strictEqual(state.videoQueue[state.currentIndex].id, 'q-item-26');
      assert.strictEqual(state.videoQueue[state.currentIndex].resumeTime, 37.5);
    });
  });

  describe('9. Chromium Live-Audit Regressions (Container Extensions, HLS Export, Safe-Mode Vault Filter, Offline Blob Rehydration & Cache Feedback)', () => {
    it('should preserve true container extension (.mkv) instead of mislabeling raw bytes as .mp4 when transcode is unavailable', async () => {
      setupTestEnv();
      const origFetch = globalThis.fetch;
      try {
        const mkvMagic = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88]);
        globalThis.fetch = async () => new Response(mkvMagic, { status: 200 });

        const res = await obtainIphoneReadyVideoBlob(
          {
            id: 'mkv-raw-1',
            title: 'Sample Matroska',
            videoUrl: 'https://ex.com/clip.mkv',
            format: 'mkv'
          },
          true
        );

        assert.strictEqual(res.wasConverted, false);
        assert.strictEqual(res.ext, 'mkv');
        assert.strictEqual(res.mime, 'video/x-matroska');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should export stitched HLS .m3u8 fMP4 and MPEG-TS streams as .mp4 / .ts instead of .m3u8 on fallback', async () => {
      setupTestEnv();
      const origFetch = globalThis.fetch;
      try {
        const segBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
        globalThis.fetch = async (url) => {
          const s = String(url);
          if (s.endsWith('fmp4.m3u8')) {
            return new Response('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2.0,\nseg0.m4s\n', {
              status: 200
            });
          }
          if (s.endsWith('ts.m3u8')) {
            return new Response('#EXTM3U\n#EXTINF:2.0,\nseg0.ts\n', { status: 200 });
          }
          return new Response(segBytes, { status: 200 });
        };

        const fmp4Res = await obtainIphoneReadyVideoBlob(
          {
            id: 'hls-fmp4-1',
            title: 'HLS fMP4',
            videoUrl: 'https://ex.com/fmp4.m3u8',
            format: 'm3u8'
          },
          false
        );
        assert.strictEqual(fmp4Res.ext, 'mp4');
        assert.strictEqual(fmp4Res.mime, 'video/mp4');

        const tsRes = await obtainIphoneReadyVideoBlob(
          {
            id: 'hls-ts-1',
            title: 'HLS TS',
            videoUrl: 'https://ex.com/ts.m3u8',
            format: 'm3u8'
          },
          false
        );
        assert.strictEqual(tsRes.ext, 'ts');
        assert.strictEqual(tsRes.mime, 'video/mp2t');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should reset vaultFilter from nsfw / nsfw_favorites to all when switching to Safe Mode or loading Safe Mode state', async () => {
      const { elements, storage } = setupTestEnv();
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

      settings.allowNsfw = false;
      await saveVideoToVaultDB({
        id: 'safe-vault-card-1',
        title: 'Safe Nature Documentary',
        videoUrl: 'https://ex.com/nature.mp4',
        isNsfw: false
      });

      settings.allowNsfw = true;
      settings.vaultFilter = 'nsfw';
      setAdultContentEnabled(false);

      assert.strictEqual(settings.vaultFilter, 'all');
      await renderVaultList();
      assert.ok(
        elements.get('vaultList').innerHTML.includes('Safe Nature Documentary'),
        'Safe Vault item must remain visible after switching from 18+ mode with nsfw filter active'
      );

      // Also verify loadState normalizes persisted nsfw_favorites when allowNsfw is false
      storage.set(
        'reelvault_settings_v2',
        JSON.stringify({ allowNsfw: false, vaultFilter: 'nsfw_favorites' })
      );
      loadState();
      assert.strictEqual(settings.vaultFilter, 'all');
    });

    it('should rehydrate offlineBlob from IndexedDB Vault on restorePlaybackState without loading dead remote URLs', async () => {
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

      settings.allowNsfw = false;
      settings.resumePlayback = true;
      const cachedBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'video/mp4' });
      const saved = await saveVideoToVaultDB(
        {
          id: 'offline-resume-1',
          title: 'Offline Airplane Clip',
          videoUrl: 'http://127.0.0.1:41999/dead-server.mp4',
          format: 'mp4',
          isNsfw: false
        },
        { blob: cachedBlob, ext: 'mp4', mime: 'video/mp4' }
      );

      setAppState({ videoQueue: [saved], currentIndex: 0 });
      savePlaybackState(12.5);

      // Simulate fresh reload where in-memory queue & mainVideo are empty
      setAppState({ videoQueue: [], currentIndex: -1, playbackPositions: {} });
      const mainVideo = elements.get('mainVideo');
      mainVideo.src = '';

      const restored = restorePlaybackState();
      assert.strictEqual(restored, true);
      // Before IndexedDB settles, mainVideo.src must NOT be set to the dead remote HTTP URL
      assert.notStrictEqual(mainVideo.src, 'http://127.0.0.1:41999/dead-server.mp4');

      await rehydrateQueueOfflineBlobsFromVault();
      const active = getAppState().videoQueue[0];
      assert.ok(active.offlineBlob instanceof Blob, 'offlineBlob should be rehydrated from IndexedDB');
      assert.ok(mainVideo.src.startsWith('blob:'), `Expected blob: URL, got ${mainVideo.src}`);
      assert.strictEqual(mainVideo.currentTime, 12.5);
    });

    it('should keep cache-vault-item button disabled mid-flight and show error toast when offline download fails', async () => {
      const { elements } = setupTestEnv();
      const origFetch = globalThis.fetch;
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

      let shouldFailNow = false;
      const pendingRejects = [];
      globalThis.fetch = () => {
        if (shouldFailNow) {
          return Promise.reject(new Error('HTTP 404'));
        }
        return new Promise((_, reject) => {
          pendingRejects.push(reject);
        });
      };

      try {
        settings.allowNsfw = false;
        const saved = await saveVideoToVaultDB({
          id: 'vault-cache-fail-1',
          title: 'Dead Stream Vault Item',
          videoUrl: 'https://ex.com/404.mp4',
          format: 'mp4',
          isNsfw: false
        });

        const cachePromise = saveAndCacheVideoToVault(saved, true);
        await new Promise((r) => setTimeout(r, 15));

        // Even if renderVaultList() runs mid-flight, button must stay disabled with Caching label
        await renderVaultList();
        const midHtml = elements.get('vaultList').innerHTML;
        assert.ok(midHtml.includes('⏳ Caching...'), 'Button should show ⏳ Caching... while active');
        assert.ok(midHtml.includes('disabled'), 'Button should remain disabled while active');

        shouldFailNow = true;
        for (const fn of pendingRejects) {
          fn(new Error('HTTP 404'));
        }
        await cachePromise;

        assert.ok(
          elements.get('toast').textContent.includes('Could not cache video offline'),
          `Expected failure toast, got: ${elements.get('toast').textContent}`
        );
        const finalHtml = elements.get('vaultList').innerHTML;
        assert.ok(finalHtml.includes('☁️ Cache Offline'), 'Button should reset after failure');
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe('Pass-2 Audit Regressions: Scanned 18+ Privacy Scrub, Preset Source Deletion & Vault Shuffle/Resume', () => {
    it('tags URLs scanned in 18+ Mode (or from known 18+ domains) as isNsfw and purges them when exiting 18+ Mode', async () => {
      const { elements } = setupTestEnv();
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        text: async () =>
          '<html><body><video src="https://cdn-media.example.org/private_clip.mp4"></video></body></html>'
      });

      try {
        setAdultContentEnabled(true);
        const directFound = await scanUrlForVideos(
          'https://cdn-media.example.org/direct_adult_reel.mp4',
          'Scanned Page'
        );
        assert.strictEqual(directFound.length, 1);
        assert.strictEqual(directFound[0].isNsfw, true);

        const pageFound = await scanUrlForVideos(
          'https://cdn-media.example.org/gallery.html',
          'Scanned Page'
        );
        assert.strictEqual(pageFound.length, 1);
        assert.strictEqual(pageFound[0].isNsfw, true);

        renderSearchResults(pageFound);
        setAppState({
          videoQueue: [pageFound[0]],
          currentIndex: 0
        });
        updatePlayerUI();
        savePlaybackState();
        assert.ok(elements.get('mainVideo').src.includes('private_clip.mp4'));
        assert.ok(elements.get('searchResultsList').innerHTML.includes('private_clip'));

        // Turning 18+ Mode OFF must completely scrub player, queue, search results, and saved resume state
        setAdultContentEnabled(false);
        const afterState = getAppState();
        assert.strictEqual(afterState.videoQueue.length, 0);
        assert.strictEqual(afterState.currentIndex, -1);
        assert.strictEqual(afterState.lastSearchResults.length, 0);
        assert.strictEqual(elements.get('mainVideo').src, '');
        assert.ok(!elements.get('searchResultsList').innerHTML.includes('private_clip'));
        assert.strictEqual(globalThis.localStorage.getItem(STORAGE_KEYS.PLAYBACK_STATE), null);

        // Known explicit 18+ domain should also be tagged isNsfw even if scanned while allowNsfw is false
        const domainFound = await scanUrlForVideos(
          'https://www.eporner.com/hd-porn/test_clip.mp4',
          'Scanned Page'
        );
        assert.strictEqual(domainFound[0].isNsfw, true);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('persists deleted 18+ preset sources across mode switches, respects empty 18+ source list, and re-unlocks on explicit preset load', () => {
      setupTestEnv();
      setAdultContentEnabled(true);
      const initialNsfwCount = getAppState().sources.filter((s) => s.isNsfw).length;
      assert.strictEqual(initialNsfwCount, ADULT_PRESET_SOURCES.length);

      // Delete 2 built-in 18+ presets and record in deletedSourceIds
      const removedIds = ADULT_PRESET_SOURCES.slice(0, 2).map((p) => p.id);
      setAppState({
        sources: getAppState().sources.filter((s) => !removedIds.includes(s.id)),
        deletedSourceIds: [...removedIds]
      });

      // Toggle Safe Mode -> 18+ Mode: deleted presets must NOT resurrect
      setAdultContentEnabled(false);
      setAdultContentEnabled(true);
      const afterToggleNsfw = getAppState().sources.filter((s) => s.isNsfw);
      assert.strictEqual(afterToggleNsfw.length, ADULT_PRESET_SOURCES.length - 2);
      for (const id of removedIds) {
        assert.ok(!afterToggleNsfw.some((s) => s.id === id), `Deleted preset ${id} should not resurrect`);
      }

      // Delete ALL 18+ presets: getEffectiveActiveSources() must return [] (0 sources), NOT fallback to all 11
      const allPresetIds = ADULT_PRESET_SOURCES.map((p) => p.id);
      setAppState({
        sources: getAppState().sources.filter((s) => !s.isNsfw),
        deletedSourceIds: allPresetIds
      });
      assert.strictEqual(getEffectiveActiveSources().length, 0);

      // Explicit unlockAdultPresetSources() ("Unlock 18+ Source Pack" button) restores all presets
      const restoredCount = unlockAdultPresetSources();
      assert.strictEqual(restoredCount, ADULT_PRESET_SOURCES.length);
      assert.strictEqual(getEffectiveActiveSources().length, ADULT_PRESET_SOURCES.length);
    });

    it('shuffles visible Vault items under "All Vault Videos" & "Favorites Only" in 18+ Mode and resumes watched Vault items on reload', async () => {
      setupTestEnv();
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

      const savedClip = await saveVideoToVaultDB({
        id: 'vault-general-clip-1',
        title: 'Saved Offline Clip',
        videoUrl: 'https://cdn.example.org/saved_clip.mp4',
        format: 'mp4',
        isNsfw: false,
        favorite: true
      });
      assert.ok(savedClip);

      setAdultContentEnabled(true);
      settings.vaultFilter = 'all';
      await renderVaultList();

      const shuffled = await shuffleVaultToPlayer({ startReels: false });
      assert.strictEqual(shuffled.length, 1, 'Shuffle Vault in "all" mode should include visible Vault items');
      assert.strictEqual(getAppState().videoQueue[0].fromVault, true);

      // "nsfw" filter in Vault must still strictly filter to 18+ items only
      settings.vaultFilter = 'nsfw';
      const nsfwShuffled = await shuffleVaultToPlayer({ startReels: false });
      assert.strictEqual(nsfwShuffled.length, 0, '18+ Only Vault filter should still exclude non-18+ Vault items');

      // Reload resume in 18+ Mode: Vault item (fromVault: true) resumes, whereas regular Safe feed item is still blocked
      settings.vaultFilter = 'all';
      setAppState({
        videoQueue: [
          {
            id: 'vault-general-clip-1',
            title: 'Saved Offline Clip',
            videoUrl: 'https://cdn.example.org/saved_clip.mp4',
            format: 'mp4',
            isNsfw: false,
            fromVault: true
          },
          {
            id: 'regular-safe-feed-1',
            title: 'Regular Safe Feed Item',
            videoUrl: 'https://cdn.example.org/safe_feed.mp4',
            format: 'mp4',
            isNsfw: false
          }
        ],
        currentIndex: 0
      });
      savePlaybackState();

      setAppState({ videoQueue: [], currentIndex: -1 });
      const restored = restorePlaybackState();
      assert.strictEqual(restored, true);
      assert.strictEqual(getAppState().videoQueue.length, 1);
      assert.strictEqual(getAppState().videoQueue[0].id, 'vault-general-clip-1');
    });
  });

  describe('8. 18+ ASMR, Sensual Roleplay, GFE/BFE & Tease Video Sources', () => {
    it('detects audio-essential ASMR/roleplay/GFE/BFE queries accurately without flagging general queries', () => {
      assert.strictEqual(isAudioEssentialQuery('asmr roleplay'), true);
      assert.strictEqual(isAudioEssentialQuery('girlfriend roleplay asmr'), true);
      assert.strictEqual(isAudioEssentialQuery('boyfriend roleplay asmr'), true);
      assert.strictEqual(isAudioEssentialQuery('r/nsfwasmr'), true);
      assert.strictEqual(isAudioEssentialQuery('redgifs asmr tease'), true);
      assert.strictEqual(isAudioEssentialQuery('amateur hd'), false);
      assert.strictEqual(isAudioEssentialQuery('r/RealGirls'), false);
    });

    it('skips silent hasAudio:false RedGIFs loops on ASMR queries and falls back to voiced ASMR clips', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      const hitUrls = [];

      globalThis.fetch = async (url) => {
        const u = String(url);
        hitUrls.push(u);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok-asmr' }) };
        }
        if (u.includes('search_text=asmr%20tease') && u.includes('order=trending')) {
          // Only silent GIF loops in trending
          return {
            ok: true,
            json: async () => ({
              gifs: [
                {
                  id: 'silentloop1',
                  hasAudio: false,
                  duration: 14,
                  tags: ['tease'],
                  urls: { hd: 'https://thumbs4.redgifs.com/SilentLoop1.mp4' }
                }
              ]
            })
          };
        }
        if (u.includes('tags=asmr') && u.includes('search_text=asmr') && u.includes('order=top')) {
          return {
            ok: true,
            json: async () => ({
              gifs: [
                {
                  id: 'voicedasmr1',
                  hasAudio: true,
                  duration: 28,
                  tags: ['asmr', 'roleplay', 'tease'],
                  urls: { hd: 'https://thumbs4.redgifs.com/VoicedAsmr1.mp4' }
                }
              ]
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      try {
        setAppState({ resetRedgifsToken: true });
        const items = await searchRedgifsVideos('redgifs asmr tease', 5);
        assert.strictEqual(items.length, 1);
        assert.strictEqual(items[0].id, 'rg-voicedasmr1');
        assert.ok(!items.some((i) => i.id === 'rg-silentloop1'));
        assert.ok(hitUrls.some((u) => u.includes('tags=asmr%2Ctease') && u.includes('order=trending')));
        assert.ok(hitUrls.some((u) => u.includes('tags=asmr&search_text=asmr&order=top')));
        assert.ok(!hitUrls.some((u) => u.includes('order=best') || u.includes('order=new')));
      } finally {
        setAppState({ resetRedgifsToken: true });
        globalThis.fetch = origFetch;
      }
    });

    it('prefers muxed HLSPlaylist.m3u8 audio streams on Reddit ASMR feeds, skips silent previews on RedGIFs links, and falls back cleanly', async () => {
      setupTestEnv();
      settings.allowNsfw = true;

      // 1. Direct listing extraction on r/nsfwasmr prefers HLSPlaylist.m3u8 over silent DASH MP4, skips silent GIFs, and ignores silent reddit_video_preview on voiced RedGIFs posts
      const sampleListing = {
        data: {
          children: [
            {
              data: {
                id: 'silent_gif_1',
                title: 'Silent visual loop',
                subreddit: 'nsfwasmr',
                over_18: true,
                permalink: '/r/nsfwasmr/comments/silent_gif_1/',
                secure_media: {
                  reddit_video: {
                    fallback_url: 'https://v.redd.it/silent1/DASH_720.mp4',
                    hls_url: 'https://v.redd.it/silent1/HLSPlaylist.m3u8',
                    is_gif: true,
                    has_audio: false,
                    duration: 12,
                    height: 720
                  }
                }
              }
            },
            {
              data: {
                id: 'voiced_roleplay_1',
                title: '[F4M] Soft Spoken Girlfriend Roleplay ASMR',
                subreddit: 'nsfwasmr',
                over_18: true,
                permalink: '/r/nsfwasmr/comments/voiced_roleplay_1/',
                secure_media: {
                  reddit_video: {
                    fallback_url: 'https://v.redd.it/voiced1/DASH_720.mp4?source=fallback',
                    hls_url: 'https://v.redd.it/voiced1/HLSPlaylist.m3u8',
                    is_gif: false,
                    has_audio: true,
                    duration: 95,
                    height: 1080
                  }
                }
              }
            },
            {
              data: {
                id: 'rg_voiced_post_1',
                title: 'Soft Moan ASMR Roleplay',
                subreddit: 'nsfwasmr',
                over_18: true,
                url: 'https://www.redgifs.com/watch/rewardingblissfulthrip',
                url_overridden_by_dest: 'https://www.redgifs.com/watch/rewardingblissfulthrip',
                permalink: '/r/nsfwasmr/comments/rg_voiced_post_1/',
                preview: {
                  reddit_video_preview: {
                    fallback_url: 'https://v.redd.it/silentprev1/CMAF_1080.mp4',
                    hls_url: 'https://v.redd.it/silentprev1/HLSPlaylist.m3u8',
                    is_gif: true,
                    has_audio: false,
                    duration: 38
                  }
                }
              }
            }
          ]
        }
      };

      const extracted = extractRedditVideosFromListing(sampleListing, 'r/nsfwasmr');
      assert.strictEqual(extracted.length, 2);
      assert.strictEqual(extracted[0].id, 'rd-voiced_roleplay_1');
      assert.strictEqual(extracted[0].format, 'm3u8');
      assert.strictEqual(extracted[0].videoUrl, 'https://v.redd.it/voiced1/HLSPlaylist.m3u8');
      assert.strictEqual(extracted[0].convertedUrl, 'https://v.redd.it/voiced1/DASH_720.mp4?source=fallback');
      assert.strictEqual(extracted[1].id, 'rd-rg_voiced_post_1');
      assert.strictEqual(extracted[1].videoUrl, 'https://media.redgifs.com/rewardingblissfulthrip.mp4');

      // 2. fetchSubredditVideos('nsfwasmr') falls back to restrict_sr=on video search when hot/top/new only had external links
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (/reddit\.com\/r\/nsfwasmr\/(hot|top|new)\.json/i.test(u)) {
          return {
            ok: true,
            json: async () => ({
              data: {
                children: [
                  {
                    data: {
                      id: 'ext_text_1',
                      title: 'External text post',
                      subreddit: 'nsfwasmr',
                      over_18: true,
                      url: 'https://www.reddit.com/r/nsfwasmr/comments/ext_text_1/'
                    }
                  }
                ]
              }
            })
          };
        }
        if (u.includes('reddit.com/r/nsfwasmr/search.json') && u.includes('restrict_sr=on')) {
          return {
            ok: true,
            json: async () => ({ data: { children: sampleListing.data.children.slice(0, 2) } })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      try {
        const subVideos = await fetchSubredditVideos('nsfwasmr');
        assert.strictEqual(subVideos.length, 1);
        assert.strictEqual(subVideos[0].id, 'rd-voiced_roleplay_1');
        assert.strictEqual(subVideos[0].videoUrl, 'https://v.redd.it/voiced1/HLSPlaylist.m3u8');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('excludes silent PornOne gallery.vcmdiawe.com/lpp/ hover previews and crawls full-length HD watch pages', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('pornone.com/search?q=asmr')) {
          return {
            ok: true,
            text: async () => `
              <html><title>Search Asmr</title><body>
                <video src="https://gallery.vcmdiawe.com/lpp/5/dd0e92f9/dd0e92f9.20.mp4"></video>
                <a href="https://pornone.com/female/asmr-peaches-sexy-roleplay/277874321/">Watch</a>
              </body></html>`
          };
        }
        if (u.includes('pornone.com/female/asmr-peaches-sexy-roleplay/277874321/')) {
          return {
            ok: true,
            text: async () => `
              <html>
                <head>
                  <title>Asmr Peaches Sexy Roleplay &mdash; PornOne ex vPorn</title>
                  <script type="application/ld+json">{"@type":"VideoObject","duration":"P0DT0H5M29S"}</script>
                </head>
                <body>
                  <video>
                    <source src="https://s1003.pornone.com/vid2/tok/277874321_720x406_500k.mp4?lang=en" type="video/mp4" label="480p" />
                    <source src="https://s3110.pornone.com/vid2/tok/277874321_1920x1080_4000k.mp4?lang=en" type="video/mp4" label="720p" />
                  </video>
                  <video src="https://gallery.vcmdiawe.com/lpp/7/fadd1212/fadd1212.20.mp4"></video>
                </body>
              </html>`
          };
        }
        return { ok: false, status: 404, text: async () => '' };
      };

      try {
        const items = await scanUrlForVideos('https://pornone.com/search?q=asmr', 'PornOne Tube (asmr)', true);
        assert.strictEqual(items.length, 1);
        assert.strictEqual(items[0].title, 'Asmr Peaches Sexy Roleplay');
        assert.strictEqual(items[0].duration, 329);
        assert.strictEqual(items[0].isHd, true);
        assert.strictEqual(items[0].videoUrl, 'https://s3110.pornone.com/vid2/tok/277874321_1920x1080_4000k.mp4?lang=en');
        assert.strictEqual(items[0].convertedUrl, 'https://s1003.pornone.com/vid2/tok/277874321_720x406_500k.mp4?lang=en');
        assert.ok(!items.some((i) => i.videoUrl.includes('vcmdiawe.com')));
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('excludes silent Pornhub 180P/prev_* hover clips & ad banners, skips old.reddit NSFW redirect, and retries Arctic Shift on 422', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      const hitUrls = [];
      let blockRedditCompletely = false;

      globalThis.fetch = async (url) => {
        const u = String(url);
        hitUrls.push(u);
        if (u.includes('pornhub.com/video/search?search=asmr+tease')) {
          return {
            ok: true,
            text: async () => `
              <html><title>Strip Tease Asmr Porn Videos | Pornhub.com</title><body>
                <a href="/video?o=ht">Hottest</a>
                <a href="/video/search?search=other">Search</a>
                <video data-mediabook="https://ew.phncdn.com/c6541/videos/202610/11/65381995/180P_225K_65381995.webm"></video>
                <video src="https://pix-fl.phncdn.com/c6531/videos/202610/11/65447405/original_65447405.mp4"></video>
                <video src="https://cdn.example.net/thumbs/prev_34987065.mp4"></video>
                <video src="https://video-b.flirtify.com/tok/media=hls4/index.m3u8"></video>
                <a href="/view_video.php?viewkey=65381995">ASMR Tease Watch</a>
              </body></html>`
          };
        }
        if (u.includes('pornhub.com/view_video.php?viewkey=65381995')) {
          return {
            ok: true,
            text: async () => `
              <html><head><title>POV Virtual ASMR Roleplay - Pornhub.com</title></head><body>
                <script>var flashvars_65381995 = {"video_duration":"421","mediaDefinitions":[{"videoUrl":"https:\\/\\/ev.phncdn.com\\/videos\\/202610\\/11\\/65381995\\/720P_4000K_65381995.mp4"}]};</script>
              </body></html>`
          };
        }
        if (/reddit\.com\/r\/nsfwasmr\/(hot|top|new)\.json/i.test(u)) {
          if (blockRedditCompletely) {
            return { ok: false, status: 403, json: async () => ({}) };
          }
          return {
            ok: true,
            json: async () => ({
              data: {
                children: [
                  {
                    data: {
                      id: 'sg_only_1',
                      title: '[F4M] Audio Only Post',
                      subreddit: 'nsfwasmr',
                      over_18: true,
                      url: 'https://soundgasm.net/u/demo/audio-only'
                    }
                  }
                ]
              }
            })
          };
        }
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=nsfwasmr&limit=25')) {
          if (blockRedditCompletely) {
            return { ok: false, status: 422, json: async () => ({ error: 'Shard timeout' }) };
          }
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'arch_rg_1',
                  title: '[F4M] Sensual ASMR Roleplay Clip',
                  subreddit: 'nsfwasmr',
                  over_18: true,
                  url: 'https://www.redgifs.com/watch/gainsborobrightasiantrumpetfish',
                  permalink: '/r/nsfwasmr/comments/arch_rg_1/sensual_asmr/'
                }
              ]
            })
          };
        }
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=nsfwasmr&limit=18')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'arch_rg_retry_1',
                  title: 'Soft Moan ASMR Retry Clip',
                  subreddit: 'nsfwasmr',
                  over_18: true,
                  url: 'https://www.redgifs.com/watch/gainsborobrightasiantrumpetfish',
                  permalink: '/r/nsfwasmr/comments/arch_rg_retry_1/soft_moan_asmr/'
                }
              ]
            })
          };
        }
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/gainsborobrightasiantrumpetfish')) {
          return {
            ok: true,
            json: async () => ({
              gif: {
                id: 'gainsborobrightasiantrumpetfish',
                duration: 44.8,
                hasAudio: true,
                urls: { hd: 'https://media.redgifs.com/GainsboroBrightAsiantrumpetfish.mp4' }
              }
            })
          };
        }
        return { ok: false, status: 403, text: async () => '', json: async () => ({}) };
      };

      try {
        const phItems = await scanUrlForVideos(
          'https://www.pornhub.com/video/search?search=asmr+tease',
          'ASMR Tease',
          true
        );
        assert.strictEqual(phItems.length, 1);
        assert.strictEqual(
          phItems[0].videoUrl,
          'https://ev.phncdn.com/videos/202610/11/65381995/720P_4000K_65381995.mp4'
        );
        assert.ok(
          !phItems.some((i) =>
            /ew\.phncdn\.com|pix-fl\.phncdn\.com|flirtify\.com|180P_|prev_\d+\.mp4/i.test(i.videoUrl)
          )
        );

        hitUrls.length = 0;
        const subFallback = await fetchSubredditVideos('nsfwasmr');
        assert.strictEqual(subFallback.length, 1);
        assert.strictEqual(subFallback[0].id, 'rd-arch_rg_1');
        assert.strictEqual(
          subFallback[0].videoUrl,
          'https://media.redgifs.com/GainsboroBrightAsiantrumpetfish.mp4'
        );
        assert.strictEqual(getVideoRefererUrl(subFallback[0]), 'https://www.redgifs.com/');
        assert.ok(
          !hitUrls.some((u) => u.includes('old.reddit.com')),
          'NSFW subreddit fetch must not waste 7s on old.reddit.com /login/?reason=lor2 redirect'
        );

        // Also verify full 403 block on www.reddit.com + transient 422 on Arctic Shift limit=25 retries limit=18
        hitUrls.length = 0;
        blockRedditCompletely = true;
        const retryFallback = await fetchSubredditVideos('nsfwasmr');
        assert.strictEqual(retryFallback.length, 1);
        assert.strictEqual(retryFallback[0].id, 'rd-arch_rg_retry_1');
        assert.ok(hitUrls.some((u) => u.includes('subreddit=nsfwasmr&limit=25')));
        assert.ok(hitUrls.some((u) => u.includes('subreddit=nsfwasmr&limit=18')));
        assert.ok(!hitUrls.some((u) => u.includes('old.reddit.com')));
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('excludes foreign-IP HTTP-474 pornhub.com pages in browser-only open-web search and pins phncdn.com to Cloud /proxy when connected', () => {
      setupTestEnv();
      settings.allowNsfw = true;
      clearCloudBackendConfig();

      const sampleSearchHtml = `
        <html><body>
          <a href="https://www.pornhub.com/view_video.php?viewkey=65381995">Pornhub ASMR</a>
          <a href="https://pornone.com/female/asmr-peaches-sexy-roleplay/277874321/">PornOne ASMR</a>
          <a href="https://www.eporner.com/video-epasmr1/sensual-asmr/">Eporner ASMR</a>
        </body></html>`;

      try {
        // 1. Browser-only mode (no Cloud Bridge): pornhub.com excluded to prevent CORS-proxy foreign-IP HTTP 474 tokens
        const browserOnlyUrls = extractCandidateWebPagesFromSearchHtml(sampleSearchHtml);
        assert.ok(!browserOnlyUrls.some((u) => u.includes('pornhub.com')));
        assert.ok(browserOnlyUrls.some((u) => u.includes('pornone.com/female/asmr-peaches-sexy-roleplay/277874321/')));
        assert.ok(browserOnlyUrls.some((u) => u.includes('eporner.com/video-epasmr1/')));

        // 2. Private Cloud Bridge connected: pornhub.com allowed and ev.phncdn.com pinned strictly to Cloud /proxy
        setCloudBackendConfig('https://bridge.example.com', 'rv_test_secret_key_12345', true);
        const cloudUrls = extractCandidateWebPagesFromSearchHtml(sampleSearchHtml);
        assert.ok(cloudUrls.some((u) => u.includes('pornhub.com/view_video.php?viewkey=65381995')));

        const phStream = 'https://ev.phncdn.com/videos/202610/11/65381995/720P_4000K_65381995.mp4?validfrom=1794511&hash=abc';
        assert.strictEqual(isIpBoundEmbedOrCdnUrl(phStream), true);
        const candidates = buildHttpsMediaProxyCandidates(phStream, { refererUrl: 'https://www.pornhub.com/' });
        assert.strictEqual(candidates.length, 1, 'IP-bound phncdn.com stream must stay pinned solely to Cloud /proxy');
        assert.ok(candidates[0].startsWith('https://bridge.example.com/proxy?'));
      } finally {
        clearCloudBackendConfig();
      }
    });

    it('retains asmr keyword in fetchDirectEpornerVideos fallback candidates for multi-word GFE/BFE ASMR queries', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      const queried = [];

      globalThis.fetch = async (url) => {
        const u = String(url);
        const m = u.match(/query=([^&]+)/);
        if (m) queried.push(decodeURIComponent(m[1]));
        if (u.includes('query=asmr%20girlfriend')) {
          return {
            ok: true,
            json: async () => ({
              videos: [
                {
                  id: 'epasmr1',
                  title: 'Sensual Girlfriend Roleplay ASMR HD',
                  length_sec: 900,
                  hd: true,
                  mp4: 'https://s1.eporner.com/dload/epasmr1/720p.mp4',
                  url: 'https://www.eporner.com/video-epasmr1/'
                }
              ]
            })
          };
        }
        return { ok: true, json: async () => ({ videos: [] }) };
      };

      try {
        const items = await fetchDirectEpornerVideos('girlfriend roleplay asmr', 4, 'GFE ASMR');
        assert.strictEqual(items.length, 1);
        assert.strictEqual(items[0].id, 'ep-epasmr1');
        assert.deepStrictEqual(queried.slice(0, 2), ['girlfriend roleplay asmr', 'asmr girlfriend']);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe('63-Source Standalone Live Audit Regression Guardrails (v43)', () => {
    it('rejects RedGIFs still-image uploads (type === 2 & .jpg URLs) in searchRedgifsVideos and resolveRedgifsUrlToMp4', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      const hitUrls = [];

      globalThis.fetch = async (url) => {
        const u = String(url);
        hitUrls.push(u);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok-img' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/search')) {
          return {
            ok: true,
            json: async () => ({
              gifs: [
                {
                  id: 'fullkookybat',
                  type: 2,
                  tags: ['3D', 'Anime', 'Art'],
                  urls: {
                    hd: 'https://media.redgifs.com/FullKookyBat-large.jpg',
                    sd: 'https://media.redgifs.com/FullKookyBat-mobile.jpg'
                  }
                },
                {
                  id: 'untypedphoto',
                  tags: ['Art'],
                  urls: {
                    hd: 'https://media.redgifs.com/UntypedPhoto-large.jpg'
                  }
                },
                {
                  id: 'real3dloop',
                  type: 1,
                  duration: 16,
                  tags: ['3D', 'Anime', 'Loop'],
                  urls: {
                    hd: 'https://media.redgifs.com/Real3DLoop.mp4',
                    sd: 'https://media.redgifs.com/Real3DLoop-mobile.mp4'
                  }
                }
              ]
            })
          };
        }
        if (u.includes('api.redgifs.com/v2/gifs/fullkookybat')) {
          return {
            ok: true,
            json: async () => ({
              gif: {
                id: 'fullkookybat',
                type: 2,
                urls: { hd: 'https://media.redgifs.com/FullKookyBat-large.jpg' }
              }
            })
          };
        }
        return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
      };

      try {
        setAppState({ resetRedgifsToken: true });
        const searchItems = await searchRedgifsVideos('anime 3d art loop 18+', 6);
        assert.strictEqual(searchItems.length, 1);
        assert.strictEqual(searchItems[0].id, 'rg-real3dloop');
        assert.strictEqual(searchItems[0].videoUrl, 'https://media.redgifs.com/Real3DLoop.mp4');
        assert.ok(hitUrls.some((u) => u.includes('api.redgifs.com/v2/gifs/search') && u.includes('type=g')));

        const resolvedPhoto = await resolveRedgifsUrlToMp4('https://www.redgifs.com/watch/fullkookybat');
        assert.strictEqual(resolvedPhoto, null);
        assert.ok(
          !hitUrls.some((u) => u.includes('/ifr/fullkookybat')),
          'Still-image RedGIFs item must return null immediately without scraping /ifr/ HTML'
        );
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('omits literal search_text=trending on RedGIFs trending feed and queries Title-Case Amateur tag + stripped search_text', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      const hitUrls = [];

      globalThis.fetch = async (url) => {
        const u = String(url);
        hitUrls.push(u);
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok-rg' }) };
        }
        if (u === 'https://api.redgifs.com/v2/gifs/search?type=g&order=trending&count=6') {
          return { ok: true, json: async () => ({ gifs: [] }) };
        }
        if (u.includes('/v2/feeds/trending/popular?page=1&count=6')) {
          return {
            ok: true,
            json: async () => ({
              gifs: [
                {
                  id: 'popclip1',
                  type: 1,
                  duration: 21,
                  tags: ['Popular'],
                  urls: { hd: 'https://media.redgifs.com/PopClip1.mp4' }
                }
              ]
            })
          };
        }
        if (u.includes('tags=Amateur&search_text=amateur&type=g&order=top28')) {
          return {
            ok: true,
            json: async () => ({
              gifs: [
                {
                  id: 'amateurclip1',
                  type: 1,
                  duration: 25,
                  tags: ['Amateur', 'Homemade'],
                  urls: { hd: 'https://media.redgifs.com/AmateurClip1.mp4' }
                }
              ]
            })
          };
        }
        return { ok: true, json: async () => ({ gifs: [] }) };
      };

      try {
        setAppState({ resetRedgifsToken: true });
        const trendingItems = await searchRedgifsVideos('redgifs trending', 6);
        assert.strictEqual(trendingItems.length, 1);
        assert.strictEqual(trendingItems[0].id, 'rg-popclip1');
        assert.ok(!hitUrls.some((u) => u.includes('search_text=trending')));

        hitUrls.length = 0;
        const amateurItems = await searchRedgifsVideos('redgifs amateur hd', 6);
        assert.strictEqual(amateurItems.length, 1);
        assert.strictEqual(amateurItems[0].id, 'rg-amateurclip1');
        assert.ok(!hitUrls.some((u) => u.includes('amateur%20hd')));
        assert.ok(hitUrls.some((u) => u.includes('tags=Amateur&search_text=amateur&type=g&order=top28')));
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('migrates dead r/sensual presets to r/passionx and cursor-paginates photo-heavy & multireddit archives via before=created_utc', async () => {
      setupTestEnv();
      settings.allowNsfw = true;

      // 1. Built-in presets & directory entries use active r/passionx instead of dead r/sensual
      const sensualPreset = ADULT_PRESET_SOURCES.find((s) => s.id === 'src-nsfw-sub-sensual');
      assert.strictEqual(sensualPreset.value, 'passionx');
      assert.strictEqual(findDirectoryEntry('dir-sub-sensual').value, 'passionx');
      assert.strictEqual(
        findDirectoryEntry('dir-fed-multireddit').value,
        'nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+passionx'
      );

      // 2. Saved localStorage sources from earlier builds migrate dead r/sensual -> r/passionx on loadState()
      localStorage.setItem(
        STORAGE_KEYS.SOURCES,
        JSON.stringify([
          {
            id: 'src-nsfw-sub-sensual',
            type: 'subreddit',
            value: 'sensual',
            label: '🔞 r/sensual Romantic',
            enabled: true,
            builtIn: true,
            isNsfw: true
          },
          {
            id: 'dir-fed-multireddit',
            type: 'subreddit',
            value: 'nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual',
            label: 'Reddit 18+ Mega-Mix (6-in-1)',
            enabled: true,
            isNsfw: true
          }
        ])
      );
      loadState();
      const migratedSources = getAppState().sources;
      assert.strictEqual(migratedSources[0].value, 'passionx');
      assert.strictEqual(migratedSources[0].label, '🔞 r/passionx Sensual & Romantic');
      assert.strictEqual(migratedSources[1].value, 'nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+passionx');

      // 3. Photo-heavy subreddit cursor-paginates via before=<created_utc> when page 1 has 20 still photos
      const origFetch = globalThis.fetch;
      const hitUrls = [];
      globalThis.fetch = async (url) => {
        const u = String(url);
        hitUrls.push(u);
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=gonewild&limit=25')) {
          return {
            ok: true,
            json: async () => ({
              data: Array.from({ length: 20 }, (_, idx) => ({
                id: `gw_img_${idx}`,
                title: `Photo Post ${idx}`,
                subreddit: 'gonewild',
                over_18: true,
                created_utc: 1776000500 - idx,
                url: `https://i.redd.it/photo_${idx}.jpg`
              }))
            })
          };
        }
        if (
          u.includes(
            'arctic-shift.photon-reddit.com/api/posts/search?subreddit=gonewild&limit=75&before=1776000481'
          )
        ) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'gw_vid_1',
                  title: 'Gonewild Video Post',
                  subreddit: 'gonewild',
                  over_18: true,
                  created_utc: 1776000400,
                  url: 'https://www.redgifs.com/watch/gonewildverified1',
                  permalink: '/r/gonewild/comments/gw_vid_1/clip/'
                }
              ]
            })
          };
        }
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=emptysub&limit=25')) {
          return { ok: true, json: async () => ({ data: [] }) };
        }
        if (u.includes('api.redgifs.com/v2/auth/temporary')) {
          return { ok: true, json: async () => ({ token: 'tok-gw' }) };
        }
        if (u.includes('api.redgifs.com/v2/gifs/gonewildverified1')) {
          return {
            ok: true,
            json: async () => ({
              gif: {
                id: 'gonewildverified1',
                type: 1,
                duration: 18,
                urls: { hd: 'https://media.redgifs.com/GonewildVerified1.mp4' }
              }
            })
          };
        }
        if (u.includes('reddit.com/r/Unexpected/')) {
          // Simulate old.reddit.com / www.reddit.com returning empty children:[] to datacenter proxy IPs
          return { ok: true, json: async () => ({ data: { children: [] } }) };
        }
        if (u === 'https://v.redd.it/deleted403/CMAF_720.mp4?source=fallback') {
          return {
            ok: false,
            status: 403,
            headers: new Headers({ 'content-type': 'application/xml' })
          };
        }
        if (u === 'https://v.redd.it/unexp1/CMAF_720.mp4?source=fallback') {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'video/mp4' })
          };
        }
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=Unexpected&limit=25')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'unexp_mod_removed',
                  title: 'Removed Rule Violation',
                  subreddit: 'Unexpected',
                  over_18: false,
                  removed_by_category: 'moderator',
                  media: {
                    reddit_video: {
                      fallback_url: 'https://v.redd.it/modrem1/CMAF_720.mp4?source=fallback'
                    }
                  }
                },
                {
                  id: 'unexp_s3_deleted',
                  title: 'Deleted S3 AccessDenied Post',
                  subreddit: 'Unexpected',
                  over_18: false,
                  media: {
                    reddit_video: {
                      fallback_url: 'https://v.redd.it/deleted403/CMAF_720.mp4?source=fallback'
                    }
                  }
                },
                {
                  id: 'unexp_1',
                  title: 'Safe Unexpected Clip',
                  subreddit: 'Unexpected',
                  over_18: false,
                  media: {
                    reddit_video: {
                      fallback_url: 'https://v.redd.it/unexp1/CMAF_720.mp4?source=fallback',
                      duration: 22,
                      height: 720
                    }
                  },
                  permalink: '/r/Unexpected/comments/unexp_1/safe_clip/'
                }
              ]
            })
          };
        }
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=photoflood&limit=25')) {
          return {
            ok: true,
            json: async () => ({
              data: Array.from({ length: 20 }, (_, idx) => ({
                id: `pf_p1_${idx}`,
                title: `Photo Flood P1 ${idx}`,
                subreddit: 'photoflood',
                over_18: true,
                created_utc: 1776000900 - idx,
                url: `https://i.redd.it/pf_p1_${idx}.jpg`
              }))
            })
          };
        }
        if (u.includes('arctic-shift.photon-reddit.com/api/posts/search?subreddit=photoflood&limit=75&before=')) {
          return {
            ok: true,
            json: async () => ({
              data: Array.from({ length: 20 }, (_, idx) => ({
                id: `pf_older_${idx}`,
                title: `Photo Flood Older ${idx}`,
                subreddit: 'photoflood',
                over_18: true,
                created_utc: 1776000700 - idx,
                url: `https://i.redd.it/pf_older_${idx}.jpg`
              }))
            })
          };
        }
        if (
          u.includes(
            'arctic-shift.photon-reddit.com/api/posts/search?subreddit=photoflood&url=https%3A%2F%2Fwww.redgifs.com%2F&limit=5'
          )
        ) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 'pf_rg_1',
                  title: 'Photoflood RedGIFs Gem',
                  subreddit: 'photoflood',
                  over_18: true,
                  created_utc: 1775999000,
                  url: 'https://www.redgifs.com/watch/gonewildverified1',
                  permalink: '/r/photoflood/comments/pf_rg_1/gem/'
                }
              ]
            })
          };
        }
        return { ok: false, status: 403, text: async () => '', json: async () => ({}) };
      };

      try {
        const gwVideos = await fetchSubredditVideos('gonewild');
        assert.strictEqual(gwVideos.length, 1);
        assert.strictEqual(gwVideos[0].videoUrl, 'https://media.redgifs.com/GonewildVerified1.mp4');
        assert.ok(hitUrls.some((u) => u.includes('&limit=75&before=1776000481')));

        const pfVideos = await fetchSubredditVideos('photoflood');
        assert.strictEqual(pfVideos.length, 1);
        assert.strictEqual(pfVideos[0].videoUrl, 'https://media.redgifs.com/GonewildVerified1.mp4');
        assert.strictEqual(pfVideos[0].sourceName, 'r/photoflood');
        assert.ok(
          hitUrls.some((u) =>
            u.includes('subreddit=photoflood&url=https%3A%2F%2Fwww.redgifs.com%2F&limit=5')
          )
        );

        const multiVideos = await fetchSubredditVideos('emptysub+gonewild');
        assert.strictEqual(multiVideos.length, 1);
        assert.strictEqual(multiVideos[0].videoUrl, 'https://media.redgifs.com/GonewildVerified1.mp4');

        // 4. Safe Mode subreddit falls through to Arctic Shift when Reddit returns empty { children: [] }
        settings.allowNsfw = false;
        const safeUnexpected = await fetchSubredditVideos('Unexpected');
        assert.strictEqual(safeUnexpected.length, 1);
        assert.strictEqual(safeUnexpected[0].videoUrl, 'https://v.redd.it/unexp1/CMAF_720.mp4?source=fallback');
        assert.strictEqual(safeUnexpected[0].isNsfw, false);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('enforces strict 18+ sensitive/nsfw filtering, Mastodon max_id pagination, and strips meta-words in searchFediverseVideos', async () => {
      setupTestEnv();
      settings.allowNsfw = true;
      const origFetch = globalThis.fetch;
      const hitUrls = [];

      globalThis.fetch = async (url) => {
        const u = String(url);
        hitUrls.push(u);
        if (u === 'https://mastodon.social/api/v1/timelines/tag/nsfw?limit=40') {
          // Page 1 burst of 20 still-image posts + 1 non-sensitive video -> triggers max_id page 2
          return {
            ok: true,
            json: async () => [
              {
                id: 'masto_sfw_1',
                sensitive: false,
                content: '<p>SFW untagged clip</p>',
                media_attachments: [
                  { id: 'att_sfw', type: 'video', url: 'https://files.mastodon.social/sfw.mp4' }
                ]
              },
              ...Array.from({ length: 20 }, (_, idx) => ({
                id: `masto_img_${1000 - idx}`,
                sensitive: true,
                content: '<p>Still artwork</p>',
                media_attachments: [
                  { id: `att_img_${idx}`, type: 'image', url: `https://files.mastodon.social/art_${idx}.jpg` }
                ]
              }))
            ]
          };
        }
        if (u === 'https://mastodon.social/api/v1/timelines/tag/nsfw?limit=40&max_id=masto_img_981') {
          return {
            ok: true,
            json: async () => [
              {
                id: 'masto_nsfw_1',
                sensitive: true,
                content: '<p>Verified 18+ Mastodon clip</p>',
                media_attachments: [
                  { id: 'att_nsfw', type: 'video', url: 'https://files.mastodon.social/nsfw_valid.mp4' }
                ]
              }
            ]
          };
        }
        if (u.includes('lemmy.world/api/v3/search')) {
          return {
            ok: true,
            json: async () => ({
              posts: [
                {
                  post: {
                    id: 'sfw_ext_post',
                    name: 'Age verification browser extension demo',
                    nsfw: false,
                    url: 'https://furries.club/system/media_attachments/dead_sfw.mp4'
                  },
                  community: { name: 'software', nsfw: false }
                },
                {
                  post: {
                    id: 'nsfw_lemmy_post',
                    name: 'Fediverse 18+ Clip',
                    nsfw: true,
                    url: 'https://cdn.lemmy.example/nsfw_clip.mp4'
                  },
                  community: { name: 'adult', nsfw: true }
                }
              ]
            })
          };
        }
        if (u.includes('lemmynsfw.com/api/v3/search')) {
          return { ok: false, status: 502, text: async () => '<html>502</html>' };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      try {
        const items = await searchFediverseVideos('lemmy fediverse nsfw');
        assert.strictEqual(items.length, 2);
        assert.ok(!items.some((i) => i.videoUrl.includes('furries.club') || i.videoUrl.includes('sfw.mp4')));
        assert.ok(items.some((i) => i.videoUrl === 'https://files.mastodon.social/nsfw_valid.mp4'));
        assert.ok(items.every((i) => i.isNsfw === true));
        assert.ok(
          hitUrls.some((u) => u === 'https://mastodon.social/api/v1/timelines/tag/nsfw?limit=40&max_id=masto_img_981')
        );
        assert.ok(
          hitUrls.some((u) => u.includes('lemmy.world/api/v3/search?q=nsfw&') && u.includes('show_nsfw=true'))
        );
        assert.ok(
          hitUrls.some((u) => u.includes('lemmynsfw.com/api/v3/search?q=nsfw&') && u.includes('show_nsfw=true'))
        );
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('dynamically validates globally unique IDs, valid types, HTTPS URLs, and mode safety across all built-in Safe, Preset, and Directory sources', () => {
      assert.ok(DEFAULT_SOURCES.length >= 6, 'Expected at least 6 Safe default sources');
      assert.ok(ADULT_PRESET_SOURCES.length >= 13, 'Expected at least 13 18+ preset sources');
      assert.ok(ADULT_DIRECTORY_CATALOG.length >= 6, 'Expected at least 6 18+ directory categories');

      const seenIds = new Set();
      const validTypes = new Set(['keyword', 'subreddit', 'url']);

      const assertValidSourceShape = (src, expectedNsfw, suiteName) => {
        assert.ok(src && typeof src === 'object', `${suiteName}: source entry must be an object`);
        assert.ok(typeof src.id === 'string' && src.id.trim().length >= 3, `${suiteName}: missing valid id`);
        assert.ok(!seenIds.has(src.id), `Duplicate built-in source id "${src.id}" in ${suiteName}`);
        seenIds.add(src.id);

        assert.ok(validTypes.has(src.type), `${src.id}: invalid type "${src.type}"`);
        assert.ok(typeof src.value === 'string' && src.value.trim().length > 0, `${src.id}: empty value`);
        assert.ok(typeof src.label === 'string' && src.label.trim().length > 0, `${src.id}: empty label`);

        if (src.type === 'url') {
          const parsed = new URL(src.value);
          assert.strictEqual(parsed.protocol, 'https:', `${src.id}: URL source must use https://`);
        }
        if (src.type === 'subreddit') {
          assert.ok(
            /^[A-Za-z0-9_]+(?:\+[A-Za-z0-9_]+)*$/.test(src.value),
            `${src.id}: invalid subreddit value "${src.value}"`
          );
        }
        if (!expectedNsfw) {
          assert.ok(!src.isNsfw, `Safe source ${src.id} must not be marked isNsfw`);
        }
      };

      for (const s of DEFAULT_SOURCES) {
        assertValidSourceShape(s, false, 'DEFAULT_SOURCES');
      }
      for (const s of ADULT_PRESET_SOURCES) {
        assert.strictEqual(s.isNsfw, true, `18+ preset ${s.id} must explicitly set isNsfw: true`);
        assertValidSourceShape(s, true, 'ADULT_PRESET_SOURCES');
      }
      for (const group of ADULT_DIRECTORY_CATALOG) {
        assert.ok(typeof group.category === 'string' && group.category.trim().length > 0, 'Missing category title');
        assert.ok(Array.isArray(group.items) && group.items.length > 0, `Empty category "${group.category}"`);
        for (const item of group.items) {
          assertValidSourceShape(item, true, `ADULT_DIRECTORY_CATALOG (${group.category})`);
        }
      }
    });
  });
});
