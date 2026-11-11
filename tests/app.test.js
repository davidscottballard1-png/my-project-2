const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  STORAGE_KEYS,
  detectVideoFormat,
  normalizeAndAutoRewriteVideoUrl,
  VIDEO_FORMAT_CATALOG,
  VIDEO_EXT_REGEX_PATTERN,
  DEFAULT_SOURCES,
  FALLBACK_VIDEOS,
  settings,
  isFormatAllowedBySettings,
  needsMp4Conversion,
  encodeArchiveFilePath,
  extractRedditVideosFromListing,
  inferVideoPlatform,
  normalizeVideoItem,
  isPeerTubeVideoItem,
  isStaleOrDisallowedRestoredItem,
  getFormatBadgeInfo,
  getEffectivePlaybackUrl,
  escapeHtml,
  obtainIphoneReadyVideoBlob,
  AffinityEngine,
  loadAffinityState,
  resetAffinityState,
  recordAffinitySignal,
  getVideoAffinityScore,
  rankVideosByAffinity,
  reRankUpcomingQueueTail,
  scheduleBackgroundQueuePrebuffer,
  clearStandbyVideoBuffer,
  unlockAppGate,
  lockAppGate,
  triggerPanicSafeMode,
  restorePlaybackState,
  setPlayerLoading,
  updatePlayerUI,
  advanceToNextVideo,
  goToPrevVideo,
  toggleReelsFullscreen,
  switchTab,
  renderSourcesList,
  renderSearchResults,
  renderVaultList,
  saveVideoToVaultDB,
  getAllVaultVideos,
  deleteVaultVideoDB,
  clearVaultDB,
  downloadVideoToIphone,
  loadState,
  saveSources,
  saveSettings,
  initBookmarkletAndUrlParams,
  updateHeaderSummary,
  showToast,
  getAppState,
  setAppState
} = require('../app.js');

describe('ReelVault Unit Tests', () => {
  describe('detectVideoFormat', () => {
    it('should detect uppercase video extensions correctly (.MP4, .WEBM)', () => {
      const mp4Upper = detectVideoFormat('video.MP4');
      assert.strictEqual(mp4Upper.ext, 'mp4');
      assert.strictEqual(mp4Upper.mime, 'video/mp4');

      const webmUpper = detectVideoFormat('clip.WEBM');
      assert.strictEqual(webmUpper.ext, 'webm');
      assert.strictEqual(webmUpper.mime, 'video/webm');

      const mkvUpper = detectVideoFormat('https://example.com/movie.MKV');
      assert.strictEqual(mkvUpper.ext, 'mkv');
      assert.strictEqual(mkvUpper.mime, 'video/x-matroska');

      const movUpper = detectVideoFormat('/storage/sample.MOV');
      assert.strictEqual(movUpper.ext, 'mov');
      assert.strictEqual(movUpper.mime, 'video/quicktime');
    });

    it('should detect video format from URLs with query strings (?token=123)', () => {
      const mp4Query = detectVideoFormat('https://example.com/video.mp4?token=123');
      assert.strictEqual(mp4Query.ext, 'mp4');

      const mp4QueryUpper = detectVideoFormat('https://example.com/video.MP4?token=123');
      assert.strictEqual(mp4QueryUpper.ext, 'mp4');

      const webmQuery = detectVideoFormat('https://cdn.example.org/stream.webm?token=123&quality=hd');
      assert.strictEqual(webmQuery.ext, 'webm');

      const m3u8Query = detectVideoFormat('https://live.example.com/stream.m3u8?auth=token123');
      assert.strictEqual(m3u8Query.ext, 'm3u8');
    });

    it('should detect video format from URLs with hash anchors (#t=10)', () => {
      const mp4Hash = detectVideoFormat('https://example.com/video.mp4#t=10');
      assert.strictEqual(mp4Hash.ext, 'mp4');

      const webmHash = detectVideoFormat('https://example.com/video.webm#t=10,20');
      assert.strictEqual(webmHash.ext, 'webm');

      const bothQueryAndHash = detectVideoFormat('https://example.com/video.mp4?token=123#t=10');
      assert.strictEqual(bothQueryAndHash.ext, 'mp4');

      const hashBeforeQuery = detectVideoFormat('https://example.com/video.webm#t=10?token=123');
      assert.strictEqual(hashBeforeQuery.ext, 'webm');
    });

    it('should gracefully handle null, undefined, empty, and invalid URLs with fallback', () => {
      assert.strictEqual(detectVideoFormat(null).ext, 'mp4');
      assert.strictEqual(detectVideoFormat(undefined).ext, 'mp4');
      assert.strictEqual(detectVideoFormat('').ext, 'mp4');
      assert.strictEqual(detectVideoFormat(12345).ext, 'mp4');
      assert.strictEqual(detectVideoFormat({}).ext, 'mp4');
      assert.strictEqual(detectVideoFormat('https://example.com/not-a-video').ext, 'mp4');
      assert.strictEqual(detectVideoFormat('https://example.com/document.pdf').ext, 'mp4');

      assert.strictEqual(detectVideoFormat(null, 'webm').ext, 'webm');
      assert.strictEqual(detectVideoFormat('invalid-file', 'webm').ext, 'webm');
      assert.strictEqual(detectVideoFormat('not-a-video', 'm3u8').ext, 'm3u8');
    });
  });

  describe('normalizeAndAutoRewriteVideoUrl', () => {
    it('should automatically rewrite .gifv URLs to .mp4', () => {
      const basicGifv = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/example.gifv');
      assert.ok(basicGifv, 'Result should not be null');
      assert.strictEqual(basicGifv.videoUrl, 'https://i.imgur.com/example.mp4');
      assert.strictEqual(basicGifv.convertedUrl, 'https://i.imgur.com/example.mp4');
      assert.strictEqual(basicGifv.originalUrl, 'https://i.imgur.com/example.gifv');
      assert.strictEqual(basicGifv.format, 'gifv');
      assert.strictEqual(basicGifv.isAutoConverted, true);

      const upperGifv = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/example.GIFV');
      assert.strictEqual(upperGifv.videoUrl, 'https://i.imgur.com/example.mp4');
      assert.strictEqual(upperGifv.isAutoConverted, true);

      const gifvQuery = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/example.gifv?token=123');
      assert.strictEqual(gifvQuery.videoUrl, 'https://i.imgur.com/example.mp4?token=123');
      assert.strictEqual(gifvQuery.isAutoConverted, true);

      const gifvHash = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/example.gifv#t=5');
      assert.strictEqual(gifvHash.videoUrl, 'https://i.imgur.com/example.mp4#t=5');
      assert.strictEqual(gifvHash.isAutoConverted, true);
    });

    it('should unescape escaped HTML entities (&amp;)', () => {
      const escapedUrl = 'https://example.com/video.mp4?token=123&amp;expiry=456&amp;user=test';
      const result = normalizeAndAutoRewriteVideoUrl(escapedUrl);
      assert.ok(result, 'Result should not be null');
      assert.strictEqual(result.videoUrl, 'https://example.com/video.mp4?token=123&expiry=456&user=test');
      assert.strictEqual(result.originalUrl, 'https://example.com/video.mp4?token=123&expiry=456&user=test');
      assert.strictEqual(result.format, 'mp4');
      assert.strictEqual(result.isAutoConverted, false);

      const gifvEscaped = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/clip.gifv?sig=abc&amp;expires=789');
      assert.strictEqual(gifvEscaped.videoUrl, 'https://i.imgur.com/clip.mp4?sig=abc&expires=789');
      assert.strictEqual(gifvEscaped.isAutoConverted, true);
    });

    it('should return null for null/invalid rawUrl input', () => {
      assert.strictEqual(normalizeAndAutoRewriteVideoUrl(null), null);
      assert.strictEqual(normalizeAndAutoRewriteVideoUrl(undefined), null);
      assert.strictEqual(normalizeAndAutoRewriteVideoUrl(''), null);
      assert.strictEqual(normalizeAndAutoRewriteVideoUrl(123), null);
    });
  });

  describe('VIDEO_FORMAT_CATALOG', () => {
    const EXPECTED_EXTENSIONS = [
      'mp4', 'mov', 'm4v', '3gp', '3g2', 'm3u8', 'webm', 'ogv', 'ogg',
      'mkv', 'avi', 'mpeg', 'mpg', 'flv', 'f4v', 'wmv', 'ts', 'm2ts', 'gifv'
    ];

    it('should contain all 19 video extensions', () => {
      assert.strictEqual(
        Object.keys(VIDEO_FORMAT_CATALOG).length,
        19,
        'Catalog must contain exactly 19 extensions'
      );

      for (const ext of EXPECTED_EXTENSIONS) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(VIDEO_FORMAT_CATALOG, ext),
          `Catalog should include '${ext}'`
        );
      }
    });

    it('should have valid mime types for all 19 extensions', () => {
      const mimeRegex = /^[a-z0-9\.\+-]+\/[a-z0-9\.\+-]+$/i;

      for (const ext of EXPECTED_EXTENSIONS) {
        const item = VIDEO_FORMAT_CATALOG[ext];
        assert.ok(item, `Entry for '${ext}' should exist`);
        assert.strictEqual(item.ext, ext, `Item ext property should match key '${ext}'`);
        assert.strictEqual(typeof item.mime, 'string', `Mime type for '${ext}' must be a string`);
        assert.ok(item.mime.length > 0, `Mime type for '${ext}' must not be empty`);
        assert.match(item.mime, mimeRegex, `Mime type '${item.mime}' for '${ext}' must be valid format`);
      }

      assert.strictEqual(VIDEO_FORMAT_CATALOG.mp4.mime, 'video/mp4');
      assert.strictEqual(VIDEO_FORMAT_CATALOG.webm.mime, 'video/webm');
      assert.strictEqual(VIDEO_FORMAT_CATALOG.m3u8.mime, 'application/vnd.apple.mpegurl');
      assert.strictEqual(VIDEO_FORMAT_CATALOG.gifv.mime, 'video/mp4');
    });
  });

  describe('needsMp4Conversion', () => {
    it('should return false for iPhone Photos native formats', () => {
      assert.strictEqual(needsMp4Conversion({ format: 'mp4', videoUrl: 'https://ex.com/a.mp4' }), false);
      assert.strictEqual(needsMp4Conversion({ format: 'mov', videoUrl: 'https://ex.com/a.mov' }), false);
      assert.strictEqual(needsMp4Conversion({ format: 'm4v', videoUrl: 'https://ex.com/a.m4v' }), false);
      assert.strictEqual(needsMp4Conversion({ format: 'gifv', videoUrl: 'https://ex.com/a.gifv' }), false);
    });

    it('should return true for formats requiring conversion for Camera Roll saving', () => {
      assert.strictEqual(needsMp4Conversion({ format: 'webm', videoUrl: 'https://ex.com/a.webm' }), true);
      assert.strictEqual(needsMp4Conversion({ format: 'mkv', videoUrl: 'https://ex.com/a.mkv' }), true);
      assert.strictEqual(needsMp4Conversion({ format: 'avi', videoUrl: 'https://ex.com/a.avi' }), true);
      assert.strictEqual(needsMp4Conversion({ format: 'flv', videoUrl: 'https://ex.com/a.flv' }), true);
      assert.strictEqual(needsMp4Conversion({ format: 'ogv', videoUrl: 'https://ex.com/a.ogv' }), true);
    });

    it('should return false if already converted or cached in vault', () => {
      assert.strictEqual(needsMp4Conversion({ format: 'mkv', convertedBlobUrl: 'blob:https://ex.com/123' }), false);
      assert.strictEqual(needsMp4Conversion({ format: 'webm', offlineBlob: new Uint8Array([0, 1, 2]) }), false);
    });

    it('should gracefully handle null/empty video items', () => {
      assert.strictEqual(needsMp4Conversion(null), false);
      assert.strictEqual(needsMp4Conversion(undefined), false);
    });

    it('should detect format from videoUrl if format property is missing', () => {
      assert.strictEqual(needsMp4Conversion({ videoUrl: 'https://ex.com/clip.mkv' }), true);
      assert.strictEqual(needsMp4Conversion({ videoUrl: 'https://ex.com/clip.mp4' }), false);
    });
  });

  describe('isFormatAllowedBySettings', () => {
    const originalMode = settings.formatMode;

    it('should allow all formats when formatMode is "all"', () => {
      settings.formatMode = 'all';
      assert.strictEqual(isFormatAllowedBySettings('mp4'), true);
      assert.strictEqual(isFormatAllowedBySettings('mkv'), true);
      assert.strictEqual(isFormatAllowedBySettings('webm'), true);
      assert.strictEqual(isFormatAllowedBySettings('flv'), true);
      assert.strictEqual(isFormatAllowedBySettings('gifv'), true);
    });

    it('should allow only native formats when formatMode is "native"', () => {
      settings.formatMode = 'native';
      assert.strictEqual(isFormatAllowedBySettings('mp4'), true);
      assert.strictEqual(isFormatAllowedBySettings('mov'), true);
      assert.strictEqual(isFormatAllowedBySettings('webm'), true);
      assert.strictEqual(isFormatAllowedBySettings('m3u8'), true);
      // Non-native formats should be blocked
      assert.strictEqual(isFormatAllowedBySettings('mkv'), false);
      assert.strictEqual(isFormatAllowedBySettings('avi'), false);
      assert.strictEqual(isFormatAllowedBySettings('flv'), false);
    });

    it('should allow only mp4 and gifv when formatMode is "mp4"', () => {
      settings.formatMode = 'mp4';
      assert.strictEqual(isFormatAllowedBySettings('mp4'), true);
      assert.strictEqual(isFormatAllowedBySettings('gifv'), true);
      assert.strictEqual(isFormatAllowedBySettings('mov'), false);
      assert.strictEqual(isFormatAllowedBySettings('webm'), false);
      assert.strictEqual(isFormatAllowedBySettings('mkv'), false);
    });

    it('should handle leading dots and uppercase extensions cleanly', () => {
      settings.formatMode = 'all';
      assert.strictEqual(isFormatAllowedBySettings('.mp4'), true);
      assert.strictEqual(isFormatAllowedBySettings('.MP4'), true);
      assert.strictEqual(isFormatAllowedBySettings('.MKV'), true);
    });

    it('should return false for unsupported or invalid extensions', () => {
      assert.strictEqual(isFormatAllowedBySettings('exe'), false);
      assert.strictEqual(isFormatAllowedBySettings('pdf'), false);
      assert.strictEqual(isFormatAllowedBySettings(''), false);
    });

    // Restore original setting
    settings.formatMode = originalMode;
  });

  describe('encodeArchiveFilePath', () => {
    it('should leave simple file names unchanged', () => {
      assert.strictEqual(encodeArchiveFilePath('Apollo11Launch.mp4'), 'Apollo11Launch.mp4');
    });

    it('should encode spaces and brackets in file names', () => {
      assert.strictEqual(
        encodeArchiveFilePath('Apollo 11 Launch.mp4'),
        'Apollo%2011%20Launch.mp4'
      );
      assert.strictEqual(
        encodeArchiveFilePath('Vintage Clip [HD].webm'),
        'Vintage%20Clip%20%5BHD%5D.webm'
      );
    });

    it('should preserve forward slashes for nested directory paths', () => {
      assert.strictEqual(
        encodeArchiveFilePath('sub directory/video file.mp4'),
        'sub%20directory/video%20file.mp4'
      );
    });

    it('should safely handle null, undefined, and empty string inputs', () => {
      assert.strictEqual(encodeArchiveFilePath(null), '');
      assert.strictEqual(encodeArchiveFilePath(undefined), '');
      assert.strictEqual(encodeArchiveFilePath(''), '');
    });
  });

  describe('extractRedditVideosFromListing', () => {
    const originalNsfw = settings.allowNsfw;
    const originalMode = settings.formatMode;

    it('should extract direct reddit_video fallback URL', () => {
      settings.formatMode = 'all';
      const sample = {
        data: {
          children: [
            {
              data: {
                id: 'post123',
                title: 'Cute Otter Swimming',
                permalink: '/r/otters/comments/post123',
                secure_media: {
                  reddit_video: {
                    fallback_url: 'https://v.redd.it/otter1/DASH_720.mp4'
                  }
                }
              }
            }
          ]
        }
      };

      const extracted = extractRedditVideosFromListing(sample, 'Otters');
      assert.strictEqual(extracted.length, 1);
      assert.strictEqual(extracted[0].id, 'rd-post123');
      assert.strictEqual(extracted[0].title, 'Cute Otter Swimming');
      assert.strictEqual(extracted[0].videoUrl, 'https://v.redd.it/otter1/DASH_720.mp4');
      assert.strictEqual(extracted[0].sourceName, 'Otters');
    });

    it('should extract videos from crosspost_parent_list', () => {
      settings.formatMode = 'all';
      const sample = {
        data: {
          children: [
            {
              data: {
                id: 'cross999',
                title: 'Crossposted Clip',
                crosspost_parent_list: [
                  {
                    secure_media: {
                      reddit_video: {
                        fallback_url: 'https://v.redd.it/parent/DASH_1080.mp4'
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      };

      const extracted = extractRedditVideosFromListing(sample, 'Crosspost');
      assert.strictEqual(extracted.length, 1);
      assert.strictEqual(extracted[0].id, 'rd-cross999');
      assert.strictEqual(extracted[0].videoUrl, 'https://v.redd.it/parent/DASH_1080.mp4');
    });

    it('should filter out NSFW posts when settings.allowNsfw is false', () => {
      settings.allowNsfw = false;
      const sample = {
        data: {
          children: [
            {
              data: {
                id: 'nsfw1',
                over_18: true,
                title: 'NSFW video',
                secure_media: {
                  reddit_video: {
                    fallback_url: 'https://v.redd.it/nsfw/DASH_720.mp4'
                  }
                }
              }
            }
          ]
        }
      };

      const extracted = extractRedditVideosFromListing(sample, 'Reddit');
      assert.strictEqual(extracted.length, 0);
    });

    it('should safely handle empty or malformed API responses without throwing', () => {
      assert.deepStrictEqual(extractRedditVideosFromListing(null, 'Test'), []);
      assert.deepStrictEqual(extractRedditVideosFromListing({}, 'Test'), []);
      assert.deepStrictEqual(extractRedditVideosFromListing({ data: {} }, 'Test'), []);
      assert.deepStrictEqual(extractRedditVideosFromListing({ data: { children: [null, {}, { data: null }] } }, 'Test'), []);
    });

    // Restore settings
    settings.allowNsfw = originalNsfw;
    settings.formatMode = originalMode;
  });

  describe('getEffectivePlaybackUrl', () => {
    const originalAutoConvert = settings.autoConvert;

    it('should return empty string for null/undefined video items', () => {
      assert.strictEqual(getEffectivePlaybackUrl(null), '');
      assert.strictEqual(getEffectivePlaybackUrl(undefined), '');
    });

    it('should prioritize existing offlineObjectUrl', () => {
      const item = {
        offlineObjectUrl: 'blob:https://vault.local/offline-video-1',
        videoUrl: 'https://remote.com/video.mp4'
      };
      assert.strictEqual(getEffectivePlaybackUrl(item), 'blob:https://vault.local/offline-video-1');
    });

    it('should create and store object URL from offlineBlob if present', () => {
      const fakeBlob = new Blob(['sample-video-bytes'], { type: 'video/mp4' });
      const item = {
        offlineBlob: fakeBlob,
        videoUrl: 'https://remote.com/video.mp4'
      };
      const resultUrl = getEffectivePlaybackUrl(item);
      assert.ok(resultUrl.startsWith('blob:'), 'Playback URL should be a blob URL');
      assert.strictEqual(item.offlineObjectUrl, resultUrl);
    });

    it('should prioritize convertedBlobUrl over remote videoUrl', () => {
      const item = {
        convertedBlobUrl: 'blob:https://vault.local/converted-mp4-1',
        videoUrl: 'https://remote.com/video.mkv'
      };
      assert.strictEqual(getEffectivePlaybackUrl(item), 'blob:https://vault.local/converted-mp4-1');
    });

    it('should use convertedUrl for non-native video when autoConvert is enabled', () => {
      settings.autoConvert = true;
      const mkvItem = {
        format: 'mkv',
        videoUrl: 'https://remote.com/clip.mkv',
        convertedUrl: 'https://remote.com/clip-transcoded.mp4'
      };
      assert.strictEqual(getEffectivePlaybackUrl(mkvItem), 'https://remote.com/clip-transcoded.mp4');
    });

    it('should fallback to videoUrl for native formats even if convertedUrl exists', () => {
      settings.autoConvert = true;
      const mp4Item = {
        format: 'mp4',
        videoUrl: 'https://remote.com/direct.mp4',
        convertedUrl: 'https://remote.com/alt.mp4'
      };
      assert.strictEqual(getEffectivePlaybackUrl(mp4Item), 'https://remote.com/direct.mp4');
    });

    settings.autoConvert = originalAutoConvert;
  });

  describe('getFormatBadgeInfo', () => {
    it('should return hidden badge for null/undefined video items', () => {
      assert.deepStrictEqual(getFormatBadgeInfo(null), {
        text: 'MP4',
        className: 'format-badge hidden'
      });
      assert.deepStrictEqual(getFormatBadgeInfo(undefined), {
        text: 'MP4',
        className: 'format-badge hidden'
      });
    });

    it('should return converted badge for gifv and converted items', () => {
      const gifvItem = { format: 'gifv' };
      assert.deepStrictEqual(getFormatBadgeInfo(gifvItem), {
        text: 'GIFV → MP4 ✓',
        className: 'format-badge converted'
      });

      const convItem = { format: 'mkv', convertedBlobUrl: 'blob:test' };
      assert.deepStrictEqual(getFormatBadgeInfo(convItem), {
        text: 'MKV → MP4 ✓',
        className: 'format-badge converted'
      });
    });

    it('should return native badge for iPhone Photos native formats', () => {
      const mp4Item = { format: 'mp4' };
      assert.deepStrictEqual(getFormatBadgeInfo(mp4Item), {
        text: 'MP4 • iPhone Native',
        className: 'format-badge'
      });

      const movItem = { format: 'mov' };
      assert.deepStrictEqual(getFormatBadgeInfo(movItem), {
        text: 'MOV • iPhone Native',
        className: 'format-badge'
      });
    });

    it('should return auto-convert badge for non-native formats', () => {
      const mkvItem = { format: 'mkv' };
      assert.deepStrictEqual(getFormatBadgeInfo(mkvItem), {
        text: 'MKV • Auto-Convert',
        className: 'format-badge convert'
      });

      const aviItem = { format: 'avi' };
      assert.deepStrictEqual(getFormatBadgeInfo(aviItem), {
        text: 'AVI • Auto-Convert',
        className: 'format-badge convert'
      });
    });
  });

  describe('FALLBACK_VIDEOS & DEFAULT_SOURCES Data Integrity', () => {
    it('should have valid DEFAULT_SOURCES with proper IDs and enabled flags', () => {
      assert.ok(Array.isArray(DEFAULT_SOURCES), 'DEFAULT_SOURCES must be an array');
      assert.ok(DEFAULT_SOURCES.length >= 6, 'Should have at least 6 default sources');

      const seenIds = new Set();
      for (const src of DEFAULT_SOURCES) {
        assert.ok(src.id && typeof src.id === 'string', 'Source id must be non-empty string');
        assert.ok(!seenIds.has(src.id), `Duplicate source id: ${src.id}`);
        seenIds.add(src.id);

        assert.ok(['keyword', 'subreddit', 'url'].includes(src.type), `Valid type for ${src.id}`);
        assert.ok(src.value && src.value.trim().length > 0, `Value must be non-empty for ${src.id}`);
        assert.ok(src.label && src.label.trim().length > 0, `Label must be non-empty for ${src.id}`);
        assert.strictEqual(src.enabled, true, `Source ${src.id} should be enabled by default`);
      }
    });

    it('should have valid FALLBACK_VIDEOS with working HTTPS mp4 links', () => {
      assert.ok(Array.isArray(FALLBACK_VIDEOS), 'FALLBACK_VIDEOS must be an array');
      assert.strictEqual(FALLBACK_VIDEOS.length, 5, 'Should have exactly 5 fallback videos');

      const seenIds = new Set();
      for (const fb of FALLBACK_VIDEOS) {
        assert.ok(fb.id && fb.id.startsWith('fb-'), `Fallback id must start with fb-: ${fb.id}`);
        assert.ok(!seenIds.has(fb.id), `Duplicate fallback id: ${fb.id}`);
        seenIds.add(fb.id);

        assert.ok(fb.title && fb.title.length > 0, `Title must exist for ${fb.id}`);
        assert.strictEqual(fb.format, 'mp4', `Format must be mp4 for ${fb.id}`);
        assert.ok(fb.videoUrl.startsWith('https://'), `URL must be https for ${fb.id}`);
        assert.ok(fb.videoUrl.endsWith('.mp4'), `URL must end with .mp4 for ${fb.id}`);
        assert.ok(fb.sourceName && fb.sourceName.length > 0, `Source name must exist for ${fb.id}`);
      }
    });
  });

  describe('Web Scanner Regex & URL Parsing', () => {
    it('should match direct video links across all supported formats', () => {
      const directRegex = new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})([?#].*)?$`, 'i');

      assert.ok(directRegex.test('https://example.com/clip.mp4'));
      assert.ok(directRegex.test('https://example.com/movie.mkv?token=123'));
      assert.ok(directRegex.test('https://example.com/stream.m3u8'));
      assert.ok(directRegex.test('https://example.com/video.WEBM#t=5'));
      assert.ok(directRegex.test('https://example.com/video.mp4?token=123#t=5'));
      assert.ok(directRegex.test('https://example.com/animation.gifv'));

      // Non-video files must not match
      assert.strictEqual(directRegex.test('https://example.com/image.jpg'), false);
      assert.strictEqual(directRegex.test('https://example.com/index.html'), false);
      assert.strictEqual(directRegex.test('https://example.com/doc.pdf'), false);
    });

    it('should extract absolute video URLs from raw HTML with unescaped entities', () => {
      const rawHtml = `
        <html>
          <body>
            <video src="https://media.org/clip1.mp4?res=1080&amp;auth=xyz"></video>
            <p>Direct: <a href="https://mirror.org/archive.mkv">Download</a></p>
          </body>
        </html>
      `;

      const absRegex = new RegExp(
        `https?:\\/\\/[^\\s"'<>\\\\]+\\.(?:${VIDEO_EXT_REGEX_PATTERN})(?:\\?[^\\s"'<>\\\\]*)?`,
        'gi'
      );

      const matches = [];
      let m;
      while ((m = absRegex.exec(rawHtml)) !== null) {
        matches.push(m[0].replace(/&amp;/g, '&'));
      }

      assert.strictEqual(matches.length, 2);
      assert.strictEqual(matches[0], 'https://media.org/clip1.mp4?res=1080&auth=xyz');
      assert.strictEqual(matches[1], 'https://mirror.org/archive.mkv');
    });

    it('should resolve relative video paths against a base page URL', () => {
      const baseUrl = 'https://archive.org/details/historic-reel';
      const relativePath = '/download/historic-reel/reel.webm';

      const resolved = new URL(relativePath, baseUrl).href;
      assert.strictEqual(resolved, 'https://archive.org/download/historic-reel/reel.webm');
    });
  });

  describe('escapeHtml (XSS Security & Sanitization)', () => {
    it('should neutralize script tags and event handler payloads', () => {
      const xssPayload = '<script>alert("xss")</script><img src=x onerror=\'alert(1)\'>';
      const escaped = escapeHtml(xssPayload);
      assert.strictEqual(
        escaped,
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&lt;img src=x onerror=&#39;alert(1)&#39;&gt;'
      );
      assert.ok(!escaped.includes('<script>'));
      assert.ok(!escaped.includes('"'));
      assert.ok(!escaped.includes("'"));
    });

    it('should escape ampersands without double-escaping clean strings', () => {
      assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
      assert.strictEqual(escapeHtml('Normal Video Title 1080p'), 'Normal Video Title 1080p');
    });

    it('should safely handle null, undefined, numbers, and empty strings', () => {
      assert.strictEqual(escapeHtml(null), '');
      assert.strictEqual(escapeHtml(undefined), '');
      assert.strictEqual(escapeHtml(''), '');
      assert.strictEqual(escapeHtml(0), '0');
      assert.strictEqual(escapeHtml(42), '42');
    });
  });

  describe('obtainIphoneReadyVideoBlob (Zero-Network Cache & Conversion Pipeline)', () => {
    it('should immediately return cached offlineBlob from Vault with 0 network calls', async () => {
      const cachedBlob = new Blob(['offline-mp4-data'], { type: 'video/mp4' });
      const progressCalls = [];
      const item = {
        id: 'vault-1',
        offlineBlob: cachedBlob,
        offlineExt: 'mp4',
        offlineMime: 'video/mp4',
        isAutoConverted: true
      };

      const result = await obtainIphoneReadyVideoBlob(item, false, (label, pct) => {
        progressCalls.push({ label, pct });
      });

      assert.strictEqual(result.blob, cachedBlob);
      assert.strictEqual(result.ext, 'mp4');
      assert.strictEqual(result.mime, 'video/mp4');
      assert.strictEqual(result.wasConverted, true);
      assert.strictEqual(progressCalls.length, 1);
      assert.strictEqual(progressCalls[0].pct, 100);
    });

    it('should reuse in-session convertedBlob without re-downloading', async () => {
      const sessionBlob = new Blob(['converted-mp4-data'], { type: 'video/mp4' });
      const item = {
        id: 'session-1',
        format: 'mkv',
        videoUrl: 'https://remote.example.com/movie.mkv',
        convertedBlob: sessionBlob
      };

      const result = await obtainIphoneReadyVideoBlob(item, false);
      assert.strictEqual(result.blob, sessionBlob);
      assert.strictEqual(result.ext, 'mp4');
      assert.strictEqual(result.mime, 'video/mp4');
      assert.strictEqual(result.wasConverted, true);
    });

    it('should reject cleanly when given a null or invalid videoItem', async () => {
      await assert.rejects(
        async () => {
          await obtainIphoneReadyVideoBlob(null);
        },
        /Invalid video item/
      );
    });
  });

  describe('DOM Wiring Verification (app.js <-> index.html)', () => {
    const rootDir = path.resolve(__dirname, '..');
    const appJsCode = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    it('should have a matching id="..." in index.html for every getElementById() in app.js', () => {
      const idMatches = [...appJsCode.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
      const uniqueIds = [...new Set(idMatches)];

      assert.ok(uniqueIds.length >= 70, `Expected at least 70 DOM IDs, found ${uniqueIds.length}`);

      const missingIds = uniqueIds.filter((id) => !indexHtml.includes(`id="${id}"`));
      assert.deepStrictEqual(
        missingIds,
        [],
        `These element IDs referenced in app.js are missing from index.html: ${missingIds.join(', ')}`
      );
    });

    it('should have matching tab view sections for all bottom navigation buttons', () => {
      const navTargets = [...indexHtml.matchAll(/data-target="([^"]+)"/g)].map((m) => m[1]);
      assert.strictEqual(navTargets.length, 4, 'Should have 4 bottom navigation tabs');

      for (const targetId of navTargets) {
        assert.ok(
          indexHtml.includes(`id="${targetId}"`),
          `Bottom nav target #${targetId} must exist as a section in index.html`
        );
      }
    });
  });

  describe('iPhone PWA & Service Worker Asset Verification (sw.js & manifest.json)', () => {
    const rootDir = path.resolve(__dirname, '..');

    it('should have a valid manifest.json with standalone display and existing icon files', () => {
      const manifestRaw = fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw);

      assert.strictEqual(manifest.short_name, 'ReelVault');
      assert.strictEqual(manifest.display, 'standalone');
      assert.ok(manifest.start_url, 'manifest.json must specify start_url');

      const startFile = path.join(rootDir, manifest.start_url.replace(/^\.\//, ''));
      assert.ok(fs.existsSync(startFile), `start_url file must exist: ${startFile}`);

      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must define icons');
      for (const icon of manifest.icons) {
        const iconPath = path.join(rootDir, icon.src.replace(/^\.\//, ''));
        assert.ok(fs.existsSync(iconPath), `PWA icon file must exist: ${iconPath}`);
      }
    });

    it('should verify all APP_SHELL files in sw.js exist on disk for offline caching', () => {
      const swCode = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
      const shellMatch = swCode.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\]/);
      assert.ok(shellMatch, 'sw.js must define APP_SHELL array');

      const assetPaths = [...shellMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
      assert.ok(assetPaths.length >= 6, 'APP_SHELL should list core app files');

      for (const relPath of assetPaths) {
        if (relPath === './') continue;
        const fullPath = path.join(rootDir, relPath.replace(/^\.\//, ''));
        assert.ok(fs.existsSync(fullPath), `Service Worker APP_SHELL asset missing: ${relPath}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 0, `Service Worker APP_SHELL asset is empty: ${relPath}`);
      }
    });

    it('should keep sw.js CACHE_NAME version in 3-way lockstep with index.html styles.css?v= and app.js?v= cache-busters and reject poisoned proxy payloads', () => {
      const swCode = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
      const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
      const swVerMatch = swCode.match(/CACHE_NAME\s*=\s*['"]reelvault-v(\d+)['"]/);
      const cssVerMatch = indexHtml.match(/<link\s+rel=["']stylesheet["']\s+href=["']\.\/styles\.css\?v=(\d+)["']\s*\/?>/);
      const htmlVerMatch = indexHtml.match(/<script\s+src=["']\.\/app\.js\?v=(\d+)["']><\/script>/);

      assert.ok(swVerMatch, 'sw.js must define CACHE_NAME = "reelvault-v<N>"');
      assert.ok(cssVerMatch, 'index.html must include <link rel="stylesheet" href="./styles.css?v=<N>" />');
      assert.ok(htmlVerMatch, 'index.html must include <script src="./app.js?v=<N>"></script>');
      assert.strictEqual(
        swVerMatch[1],
        cssVerMatch[1],
        `sw.js version (v${swVerMatch[1]}) must match index.html styles.css version (v${cssVerMatch[1]}) so Safari invalidates stale CSS`
      );
      assert.strictEqual(
        swVerMatch[1],
        htmlVerMatch[1],
        `sw.js version (v${swVerMatch[1]}) must match index.html app.js version (v${htmlVerMatch[1]}) so Safari invalidates stale JS`
      );

      const { isInvalidCorsProxyPayload } = require('../app.js');
      assert.strictEqual(
        isInvalidCorsProxyPayload('Too many requests, please try again later.', true, 'https://www.reddit.com/r/nsfw.json'),
        true
      );
      assert.strictEqual(
        isInvalidCorsProxyPayload(
          'corsproxy.io: Production domains require a paid plan and API key.',
          true,
          'https://www.eporner.com/embed/abc/'
        ),
        true
      );
      assert.strictEqual(
        isInvalidCorsProxyPayload(
          '<html><head><title>Just a moment...</title></head><body></body></html>',
          true,
          'https://fulltaboo.tv/'
        ),
        true
      );
      assert.strictEqual(
        isInvalidCorsProxyPayload({ error: 'Paid plan required' }, false, 'https://www.reddit.com/r/RealGirls/hot.json'),
        true
      );
      assert.strictEqual(
        isInvalidCorsProxyPayload({ status: 'blocked' }, false, 'https://www.eporner.com/api/v2/video/search/?query=hd'),
        true
      );
      assert.strictEqual(
        isInvalidCorsProxyPayload({ message: 'Forbidden' }, false, 'https://api.redgifs.com/v2/auth/temporary'),
        true
      );
    });
  });

  // Helper to create a fast in-memory DOM environment for UI tests
  function createMockDom() {
    const elements = new Map();

    function makeElement(id = '', initialClasses = []) {
      const classes = new Set(initialClasses);
      const el = {
        id,
        textContent: '',
        innerHTML: '',
        disabled: false,
        href: '',
        src: '',
        muted: false,
        playsInline: false,
        preload: '',
        style: {},
        dataset: {},
        classList: {
          add: (...tokens) => tokens.forEach((t) => classes.add(t)),
          remove: (...tokens) => tokens.forEach((t) => classes.delete(t)),
          toggle: (token, force) => {
            const shouldAdd = typeof force === 'boolean' ? force : !classes.has(token);
            if (shouldAdd) classes.add(token);
            else classes.delete(token);
            return shouldAdd;
          },
          contains: (token) => classes.has(token)
        },
        set className(val) {
          classes.clear();
          String(val || '')
            .split(/\s+/)
            .filter(Boolean)
            .forEach((c) => classes.add(c));
        },
        get className() {
          return [...classes].join(' ');
        },
        value: '',
        download: '',
        target: '',
        rel: '',
        load: () => {},
        play: () => Promise.resolve(),
        click: () => {},
        remove: () => {},
        select: () => {},
        addEventListener: () => {},
        appendChild: () => {}
      };
      if (id) elements.set(id, el);
      return el;
    }

    // Pre-create core ReelVault DOM nodes
    [
      'mainVideo', 'videoTitle', 'videoSourceBadge', 'videoFormatBadge',
      'convertNowBtn', 'queueCounter', 'videoOriginalLink', 'prevVideoBtn',
      'saveToPhoneBtn', 'saveToVaultBtn', 'playerEmpty', 'playerLoading',
      'playerLoadingText', 'reelsHudOverlay', 'reelsHudBadge', 'reelsHudTitle',
      'videoStage', 'prebufferBadge', 'sourcesList', 'searchResultsCount',
      'searchResultsList', 'activeSourceSummary', 'toast',
      'vaultList', 'vaultBadge', 'vaultStorageSummary',
      'downloadStatusBox', 'downloadStatusText', 'downloadStatusPercent', 'downloadProgressBar',
      'bookmarkletCodeInput', 'copyBookmarkletBtn', 'urlScanInput'
    ].forEach((id) => makeElement(id));

    const tabViews = [
      makeElement('view-discover', ['tab-view', 'active']),
      makeElement('view-search', ['tab-view']),
      makeElement('view-sources', ['tab-view']),
      makeElement('view-vault', ['tab-view'])
    ];

    const navTabs = ['view-discover', 'view-search', 'view-sources', 'view-vault'].map((target, idx) => {
      const btn = makeElement('', idx === 0 ? ['nav-tab', 'active'] : ['nav-tab']);
      btn.dataset.target = target;
      return btn;
    });

    globalThis.document = {
      getElementById: (id) => elements.get(id) || null,
      createElement: (tag) => makeElement(tag),
      body: makeElement('body'),
      querySelectorAll: (selector) => {
        if (selector === '.tab-view') return tabViews;
        if (selector === '.nav-tab') return navTabs;
        return [];
      }
    };

    return { elements, tabViews, navTabs };
  }

  describe('UI: Player Controls & Queue Navigation (updatePlayerUI, advanceToNextVideo, goToPrevVideo)', () => {
    it('should disable action buttons and show "0 in queue" when queue is empty', () => {
      const { elements } = createMockDom();
      settings.prebuffer = false;
      setAppState({ videoQueue: [], currentIndex: -1 });

      updatePlayerUI();

      assert.strictEqual(elements.get('queueCounter').textContent, '0 in queue');
      assert.strictEqual(elements.get('prevVideoBtn').disabled, true);
      assert.strictEqual(elements.get('saveToPhoneBtn').disabled, true);
      assert.strictEqual(elements.get('saveToVaultBtn').disabled, true);
      assert.strictEqual(elements.get('videoFormatBadge').classList.contains('hidden'), true);
      assert.strictEqual(elements.get('convertNowBtn').classList.contains('hidden'), true);
    });

    it('should enable buttons, hide empty state, and keep Convert button hidden for native .mp4', () => {
      const { elements } = createMockDom();
      settings.prebuffer = false;
      setAppState({
        videoQueue: [
          {
            id: 'v1',
            title: 'Apollo 11 Launch',
            videoUrl: 'https://archive.org/download/Apollo11.mp4',
            format: 'mp4',
            sourceName: 'NASA Archive',
            pageUrl: 'https://archive.org/details/Apollo11'
          }
        ],
        currentIndex: 0
      });

      updatePlayerUI();

      assert.strictEqual(elements.get('queueCounter').textContent, 'Video 1 of 1');
      assert.strictEqual(elements.get('videoTitle').textContent, 'Apollo 11 Launch');
      assert.strictEqual(elements.get('videoSourceBadge').textContent, 'NASA Archive');
      assert.strictEqual(elements.get('videoFormatBadge').textContent, 'MP4 • iPhone Native');
      assert.strictEqual(elements.get('saveToPhoneBtn').disabled, false);
      assert.strictEqual(elements.get('saveToVaultBtn').disabled, false);
      assert.strictEqual(elements.get('prevVideoBtn').disabled, true);
      assert.strictEqual(elements.get('convertNowBtn').classList.contains('hidden'), true);
      assert.strictEqual(elements.get('videoOriginalLink').href, 'https://archive.org/details/Apollo11');
      assert.strictEqual(elements.get('videoOriginalLink').classList.contains('hidden'), false);
    });

    it('should unhide Convert button with format label when a non-native .mkv video is active', () => {
      const { elements } = createMockDom();
      settings.prebuffer = false;
      setAppState({
        videoQueue: [
          {
            id: 'v2',
            title: 'Retro MKV Clip',
            videoUrl: 'https://example.com/retro.mkv',
            format: 'mkv',
            sourceName: 'Archive'
          }
        ],
        currentIndex: 0
      });

      updatePlayerUI();

      const convertBtn = elements.get('convertNowBtn');
      assert.strictEqual(convertBtn.classList.contains('hidden'), false);
      assert.strictEqual(convertBtn.textContent, '🔄 Convert .MKV to .MP4');
    });

    it('should navigate forward and backward through the queue and toggle Prev button state', () => {
      const { elements } = createMockDom();
      settings.prebuffer = false;
      setAppState({
        videoQueue: [
          { id: 'v1', title: 'Clip One', videoUrl: 'https://ex.com/1.mp4', format: 'mp4', sourceName: 'Feed' },
          { id: 'v2', title: 'Clip Two', videoUrl: 'https://ex.com/2.mp4', format: 'mp4', sourceName: 'Feed' }
        ],
        currentIndex: 0
      });

      updatePlayerUI();
      assert.strictEqual(elements.get('queueCounter').textContent, 'Video 1 of 2');
      assert.strictEqual(elements.get('prevVideoBtn').disabled, true);

      // Advance to Video 2
      advanceToNextVideo();
      assert.strictEqual(getAppState().currentIndex, 1);
      assert.strictEqual(elements.get('queueCounter').textContent, 'Video 2 of 2');
      assert.strictEqual(elements.get('videoTitle').textContent, 'Clip Two');
      assert.strictEqual(elements.get('prevVideoBtn').disabled, false);

      // Go back to Video 1
      goToPrevVideo();
      assert.strictEqual(getAppState().currentIndex, 0);
      assert.strictEqual(elements.get('queueCounter').textContent, 'Video 1 of 2');
      assert.strictEqual(elements.get('videoTitle').textContent, 'Clip One');
      assert.strictEqual(elements.get('prevVideoBtn').disabled, true);
    });
  });

  describe('UI: Tab Navigation & Fullscreen Reels HUD (switchTab, toggleReelsFullscreen)', () => {
    it('should activate matching tab section and bottom nav button when switching tabs', () => {
      const { tabViews, navTabs } = createMockDom();

      switchTab('view-search');
      assert.strictEqual(tabViews[0].classList.contains('active'), false);
      assert.strictEqual(tabViews[1].classList.contains('active'), true);
      assert.strictEqual(navTabs[0].classList.contains('active'), false);
      assert.strictEqual(navTabs[1].classList.contains('active'), true);

      switchTab('view-vault');
      assert.strictEqual(tabViews[1].classList.contains('active'), false);
      assert.strictEqual(tabViews[3].classList.contains('active'), true);
      assert.strictEqual(navTabs[3].classList.contains('active'), true);
    });

    it('should enter and exit Fullscreen Reels Mode and update HUD overlay', () => {
      const { elements } = createMockDom();
      settings.prebuffer = false;
      setAppState({
        videoQueue: [
          { id: 'v1', title: 'Vertical Reel Clip', videoUrl: 'https://ex.com/reel.mp4', format: 'mp4', sourceName: 'Reels' }
        ],
        currentIndex: 0,
        isReelsFullscreen: false
      });

      toggleReelsFullscreen(true);
      assert.strictEqual(getAppState().isReelsFullscreen, true);
      assert.strictEqual(elements.get('videoStage').classList.contains('reels-fullscreen'), true);
      assert.strictEqual(elements.get('reelsHudOverlay').classList.contains('hidden'), false);
      assert.strictEqual(elements.get('reelsHudTitle').textContent, 'Vertical Reel Clip');
      assert.ok(elements.get('reelsHudBadge').textContent.includes('Reels'));

      toggleReelsFullscreen(false);
      assert.strictEqual(getAppState().isReelsFullscreen, false);
      assert.strictEqual(elements.get('videoStage').classList.contains('reels-fullscreen'), false);
      assert.strictEqual(elements.get('reelsHudOverlay').classList.contains('hidden'), true);
    });
  });

  describe('UI: Dynamic List Rendering (renderSourcesList, renderSearchResults)', () => {
    it('should render empty state and pluralized counts in search results list', () => {
      const { elements } = createMockDom();

      renderSearchResults([]);
      assert.strictEqual(elements.get('searchResultsCount').textContent, '0 videos');
      assert.ok(elements.get('searchResultsList').innerHTML.includes('No matching videos found'));

      renderSearchResults([
        { id: 's1', title: 'Single <script>Result</script>', videoUrl: 'https://ex.com/1.mp4', format: 'mp4', sourceName: 'NASA' }
      ]);
      assert.strictEqual(elements.get('searchResultsCount').textContent, '1 video');
      const html1 = elements.get('searchResultsList').innerHTML;
      assert.ok(html1.includes('&lt;script&gt;Result&lt;/script&gt;'), 'Search result title must be XSS-escaped');
      assert.ok(html1.includes('data-action="play-search-item"'));
      assert.ok(html1.includes('data-action="download-search-item"'));
      assert.ok(html1.includes('data-action="vault-search-item"'));

      renderSearchResults([
        { id: 's1', title: 'Clip A', videoUrl: 'https://ex.com/1.mp4', format: 'mp4', sourceName: 'NASA' },
        { id: 's2', title: 'Clip B', videoUrl: 'https://ex.com/2.webm', format: 'webm', sourceName: 'Wikimedia' }
      ]);
      assert.strictEqual(elements.get('searchResultsCount').textContent, '2 videos');
    });

    it('should render sources list with type badges, checked states, and XSS escaping', () => {
      const { elements } = createMockDom();

      setAppState({ sources: [] });
      renderSourcesList();
      assert.ok(elements.get('sourcesList').innerHTML.includes('No sources configured'));

      setAppState({
        sources: [
          { id: 'src-1', type: 'keyword', value: 'synthwave', label: 'Synthwave <img onerror=alert(1)>', enabled: true },
          { id: 'src-2', type: 'subreddit', value: 'oddlysatisfying', label: 'r/oddlysatisfying', enabled: false }
        ]
      });
      renderSourcesList();
      const html = elements.get('sourcesList').innerHTML;
      assert.ok(html.includes('🔍 Keyword'));
      assert.ok(html.includes('👽 Subreddit'));
      assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'), 'Custom source label must be XSS-escaped');
      assert.ok(html.includes('data-id="src-1" checked'));
    });
  });

  describe('UI: Status Overlays, Header Summary & Toast (setPlayerLoading, updateHeaderSummary, showToast)', () => {
    it('should toggle player loading overlay and update status message', () => {
      const { elements } = createMockDom();

      setPlayerLoading(true, 'Scanning webpage for videos...');
      assert.strictEqual(elements.get('playerLoading').classList.contains('hidden'), false);
      assert.strictEqual(elements.get('playerEmpty').classList.contains('hidden'), true);
      assert.strictEqual(elements.get('playerLoadingText').textContent, 'Scanning webpage for videos...');

      setPlayerLoading(false);
      assert.strictEqual(elements.get('playerLoading').classList.contains('hidden'), true);
    });

    it('should update header summary with active source count and format mode', () => {
      const { elements } = createMockDom();
      const origMode = settings.formatMode;

      setAppState({
        sources: [{ id: '1', enabled: true }, { id: '2', enabled: false }]
      });
      settings.formatMode = 'mp4';
      updateHeaderSummary();
      assert.strictEqual(elements.get('activeSourceSummary').textContent, '1 source • .mp4 only');

      setAppState({
        sources: [{ id: '1', enabled: true }, { id: '2', enabled: true }, { id: '3', enabled: true }]
      });
      settings.formatMode = 'all';
      updateHeaderSummary();
      assert.strictEqual(elements.get('activeSourceSummary').textContent, '3 sources • All formats + Auto-Convert');

      settings.formatMode = origMode;
    });

    it('should display toast notification with message and remove hidden class', () => {
      const { elements } = createMockDom();
      elements.get('toast').classList.add('hidden');

      showToast('Saved to Offline Vault!');
      assert.strictEqual(elements.get('toast').textContent, 'Saved to Offline Vault!');
      assert.strictEqual(elements.get('toast').classList.contains('hidden'), false);
    });
  });

  describe('UI & IndexedDB: Offline Vault Rendering & Storage Summary (renderVaultList, saveVideoToVaultDB, deleteVaultVideoDB, clearVaultDB)', () => {
    function setupMockIndexedDB() {
      const records = new Map();
      const store = {
        getAll: () => {
          const req = { result: [...records.values()], onsuccess: null, onerror: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
        put: (record) => {
          records.set(record.id, record);
          const req = { result: record.id, onsuccess: null, onerror: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
        delete: (id) => {
          records.delete(id);
          const req = { onsuccess: null, onerror: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        },
        clear: () => {
          records.clear();
          const req = { onsuccess: null, onerror: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        }
      };

      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => store,
        transaction: () => ({
          objectStore: () => store
        })
      };

      globalThis.indexedDB = {
        open: () => {
          const req = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
          queueMicrotask(() => req.onsuccess?.());
          return req;
        }
      };

      return records;
    }

    it('should render empty state, hide #vaultBadge, and show "0 videos saved" when Vault is empty', async () => {
      const { elements } = createMockDom();
      setupMockIndexedDB();

      await renderVaultList();

      assert.strictEqual(elements.get('vaultBadge').classList.contains('hidden'), true);
      assert.strictEqual(elements.get('vaultStorageSummary').textContent, '0 videos saved');
      assert.ok(elements.get('vaultList').innerHTML.includes('No videos saved in your Vault yet'));
    });

    it('should calculate cached MB, update #vaultBadge, and render offline vs link-only Vault cards', async () => {
      const { elements } = createMockDom();
      setupMockIndexedDB();

      // 1. Save a 5.0 MB offline-cached video
      const fiveMbBlob = new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'video/mp4' });
      await saveVideoToVaultDB(
        {
          id: 'vault-cached-1',
          title: 'Cached Space Launch <script>',
          videoUrl: 'https://example.com/launch.mp4',
          format: 'mp4',
          sourceName: 'NASA',
          savedAt: 2000
        },
        { blob: fiveMbBlob, ext: 'mp4', mime: 'video/mp4' }
      );

      // 2. Save a link-only video
      await saveVideoToVaultDB({
        id: 'vault-link-2',
        title: 'Link Only Clip',
        videoUrl: 'https://example.com/clip.webm',
        format: 'webm',
        sourceName: 'Wikimedia',
        savedAt: 1000
      });

      const allItems = await getAllVaultVideos();
      assert.strictEqual(allItems.length, 2);
      assert.strictEqual(allItems[0].id, 'vault-cached-1', 'Newest item should be sorted first');

      await renderVaultList();

      assert.strictEqual(elements.get('vaultBadge').classList.contains('hidden'), false);
      assert.strictEqual(elements.get('vaultBadge').textContent, '2');
      assert.strictEqual(elements.get('vaultStorageSummary').textContent, '2 saved • 5.0 MB cached offline');

      const html = elements.get('vaultList').innerHTML;
      assert.ok(html.includes('&lt;script&gt;'), 'Vault item title must be XSS-escaped');
      assert.ok(html.includes('✅ Offline 5.0 MB'), 'Cached item should show offline size badge');
      assert.ok(html.includes('▶ Watch (Offline)'), 'Cached item should show Watch (Offline) label');
      assert.ok(html.includes('☁️ Cache Offline'), 'Link-only item should show Cache Offline button');

      // Delete one item and verify count updates
      await deleteVaultVideoDB('vault-link-2');
      await renderVaultList();
      assert.strictEqual(elements.get('vaultBadge').textContent, '1');

      // Clear Vault and verify empty state returns
      await clearVaultDB();
      await renderVaultList();
      assert.strictEqual(elements.get('vaultBadge').classList.contains('hidden'), true);
      assert.strictEqual(elements.get('vaultStorageSummary').textContent, '0 videos saved');
    });
  });

  describe('UI: iPhone Share Sheet & Download Flow (downloadVideoToIphone)', () => {
    it('should sanitize filename slug and invoke iOS navigator.share with a valid File object', async () => {
      const { elements } = createMockDom();
      let sharedPayload = null;

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          canShare: () => true,
          share: async (data) => {
            sharedPayload = data;
          }
        },
        configurable: true,
        writable: true
      });

      const item = {
        id: 'dl-1',
        title: 'Apollo 11: Launch & Landing! (1969)',
        videoUrl: 'https://archive.org/download/apollo.mp4',
        offlineBlob: new Blob(['mp4-bytes'], { type: 'video/mp4' }),
        offlineExt: 'mp4',
        offlineMime: 'video/mp4'
      };

      await downloadVideoToIphone(item);

      assert.ok(sharedPayload, 'navigator.share should have been called');
      assert.strictEqual(sharedPayload.files.length, 1);
      assert.strictEqual(sharedPayload.files[0].name, 'apollo-11-launch-landing-1969.mp4');
      assert.strictEqual(sharedPayload.files[0].type, 'video/mp4');
      assert.strictEqual(elements.get('downloadStatusPercent').textContent, '100%');
      assert.strictEqual(elements.get('saveToPhoneBtn').disabled, false);
      assert.ok(elements.get('toast').textContent.includes('Save Video'));
    });

    it('should gracefully handle user cancelling the iOS Share Sheet (AbortError)', async () => {
      const { elements } = createMockDom();

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          canShare: () => true,
          share: async () => {
            const abortErr = new Error('User cancelled share');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
        },
        configurable: true,
        writable: true
      });

      const item = {
        id: 'dl-2',
        title: 'Cancel Test Video',
        offlineBlob: new Blob(['mp4-bytes'], { type: 'video/mp4' })
      };

      await downloadVideoToIphone(item);

      assert.strictEqual(elements.get('toast').textContent, 'Share menu closed');
      assert.strictEqual(elements.get('saveToPhoneBtn').disabled, false);
    });
  });

  describe('State Persistence & Corruption Recovery (loadState, saveSources, saveSettings)', () => {
    function setupMockLocalStorage(initial = {}) {
      const store = new Map(Object.entries(initial));
      globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
      };
      return store;
    }

    it('should recover cleanly from corrupted JSON in localStorage and fallback to DEFAULT_SOURCES', () => {
      createMockDom();
      setupMockLocalStorage({
        [STORAGE_KEYS.SOURCES]: '{corrupted-json-data',
        [STORAGE_KEYS.SETTINGS]: '{bad-settings-json'
      });

      assert.doesNotThrow(() => {
        loadState();
      });

      const state = getAppState();
      assert.strictEqual(state.sources.length, DEFAULT_SOURCES.length);
      assert.strictEqual(state.sources[0].id, DEFAULT_SOURCES[0].id);
    });

    it('should persist custom sources and settings to localStorage and refresh header summary', () => {
      const { elements } = createMockDom();
      const store = setupMockLocalStorage();
      const origMode = settings.formatMode;

      setAppState({
        sources: [
          { id: 'custom-1', type: 'keyword', value: 'cyberpunk', label: 'Cyberpunk', enabled: true }
        ]
      });
      settings.formatMode = 'native';

      saveSources();
      saveSettings();

      const savedSources = JSON.parse(store.get(STORAGE_KEYS.SOURCES));
      const savedSettings = JSON.parse(store.get(STORAGE_KEYS.SETTINGS));

      assert.strictEqual(savedSources.length, 1);
      assert.strictEqual(savedSources[0].value, 'cyberpunk');
      assert.strictEqual(savedSettings.formatMode, 'native');
      assert.strictEqual(elements.get('activeSourceSummary').textContent, '1 source • iPhone native formats');

      settings.formatMode = origMode;
    });
  });

  describe('Safari Bookmarklet & Deep-Link Parameters (initBookmarkletAndUrlParams)', () => {
    it('should generate Safari bookmarklet code and auto-scan when ?scan= parameter is present', async () => {
      const { elements, tabViews } = createMockDom();

      globalThis.window = {
        location: {
          origin: 'https://davidscottballard1-png.github.io',
          pathname: '/my-project-2/',
          search: '?scan=https%3A%2F%2Fexample.com%2Fsample-clip.mp4'
        }
      };

      initBookmarkletAndUrlParams();

      const bookmarkletVal = elements.get('bookmarkletCodeInput').value;
      assert.ok(bookmarkletVal.startsWith('javascript:(function(){'));
      assert.ok(bookmarkletVal.includes('https://davidscottballard1-png.github.io/my-project-2/?scan='));

      // Verify ?scan= switched to Search tab and populated the URL input
      assert.strictEqual(tabViews[1].classList.contains('active'), true, 'Search tab should be activated');
      assert.strictEqual(elements.get('urlScanInput').value, 'https://example.com/sample-clip.mp4');

      // Wait a microtask tick for scanUrlForVideos promise resolution on direct .mp4 URL
      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(elements.get('searchResultsCount').textContent, '1 video');
      assert.ok(elements.get('searchResultsList').innerHTML.includes('sample-clip.mp4'));
    });
  });

  describe('normalizeVideoItem & Unified Adapter Schema', () => {
    it('normalizes missing optional fields, author arrays, and canonical platform tags without losing URL fallback chains', () => {
      assert.strictEqual(normalizeVideoItem(null), null);
      assert.strictEqual(normalizeVideoItem({ title: 'No URL' }), null);

      const archiveItem = normalizeVideoItem({
        id: 'ia-apollo11-mp4',
        title: '  Apollo 11 Launch  ',
        videoUrl: 'https://archive.org/download/apollo11/apollo11.ia.mp4',
        originalUrl: 'https://archive.org/download/apollo11/apollo11.mp4',
        convertedUrl: 'https://archive.org/download/apollo11/apollo11_512kb.mp4',
        author: ['NASA Johnson Space Center', 'Secondary'],
        sourceName: 'Archive.org (apollo)',
        pageUrl: 'https://archive.org/details/apollo11'
      });

      assert.strictEqual(archiveItem.title, 'Apollo 11 Launch');
      assert.strictEqual(archiveItem.videoUrl, 'https://archive.org/download/apollo11/apollo11.ia.mp4');
      assert.strictEqual(archiveItem.originalUrl, 'https://archive.org/download/apollo11/apollo11.mp4');
      assert.strictEqual(archiveItem.convertedUrl, 'https://archive.org/download/apollo11/apollo11_512kb.mp4');
      assert.strictEqual(archiveItem.format, 'mp4');
      assert.strictEqual(archiveItem.isNsfw, false);
      assert.strictEqual(archiveItem.duration, 0);
      assert.strictEqual(archiveItem.isHd, false);
      assert.deepStrictEqual(archiveItem.tags, []);
      assert.strictEqual(archiveItem.author, 'NASA Johnson Space Center');
      assert.strictEqual(archiveItem.platform, 'archive');

      const ptItem = normalizeVideoItem({
        id: 'custom-uuid',
        title: 'Federated Clip',
        videoUrl: 'https://tube.example/static/1080.mp4',
        platform: 'peertube',
        sourceName: 'Custom Instance'
      });
      assert.strictEqual(isPeerTubeVideoItem(ptItem), true);
      assert.strictEqual(inferVideoPlatform({ id: 'lemmy-42', sourceName: 'Custom Label' }), 'lemmy');
      assert.strictEqual(
        isStaleOrDisallowedRestoredItem(
          normalizeVideoItem({
            id: 'custom-lemmy-1',
            videoUrl: 'https://cdn.example/clip.mp4',
            platform: 'lemmy',
            sourceName: 'Custom Label'
          }),
          [{ id: 's-reddit', type: 'subreddit', value: 'videos', label: 'r/videos', enabled: true }]
        ),
        true
      );
    });
  });

  describe('Dual-Layer Video Recycling (True 0ms Swipe)', () => {
    function createDualVideoMockDom() {
      const { elements, tabViews, navTabs } = createMockDom();
      let videoCreateCount = 0;

      function makeVideoNode(initialId, slotName, initialClasses) {
        const classes = new Set(initialClasses);
        const attrs = new Map();
        const node = {
          id: initialId,
          src: '',
          muted: slotName === 'B',
          volume: 1,
          playbackRate: 1,
          currentTime: 0,
          duration: 12,
          readyState: 4,
          paused: true,
          controls: slotName === 'A',
          playsInline: true,
          preload: 'auto',
          error: null,
          loadCount: 0,
          playCount: 0,
          pauseCount: 0,
          style: {},
          dataset: { playerSlot: slotName, prebufferedUrl: '', prebufferFailed: 'false' },
          classList: {
            add: (...tokens) => tokens.forEach((t) => classes.add(t)),
            remove: (...tokens) => tokens.forEach((t) => classes.delete(t)),
            toggle: (token, force) => {
              const shouldAdd = typeof force === 'boolean' ? force : !classes.has(token);
              if (shouldAdd) classes.add(token);
              else classes.delete(token);
              return shouldAdd;
            },
            contains: (token) => classes.has(token)
          },
          getAttribute: (k) => (k === 'src' ? node.src || null : attrs.get(k) ?? null),
          setAttribute: (k, v) => {
            if (k === 'src') node.src = String(v);
            else attrs.set(k, String(v));
          },
          removeAttribute: (k) => {
            if (k === 'src') node.src = '';
            else attrs.delete(k);
          },
          canPlayType: () => 'probably',
          load: () => {
            node.loadCount++;
          },
          play: () => {
            node.playCount++;
            node.paused = false;
            return Promise.resolve();
          },
          pause: () => {
            node.pauseCount++;
            node.paused = true;
          },
          addEventListener: () => {}
        };
        return node;
      }

      const slotA = makeVideoNode('mainVideo', 'A', ['stage-video-layer', 'active-video-layer']);
      const slotB = makeVideoNode('standbyVideo', 'B', ['stage-video-layer', 'standby-video-layer']);
      const origCreateElement = globalThis.document.createElement;

      globalThis.document = {
        ...globalThis.document,
        getElementById: (id) => {
          if (slotA.id === id) return slotA;
          if (slotB.id === id) return slotB;
          return elements.get(id) || null;
        },
        createElement: (tag) => {
          if (String(tag).toLowerCase() === 'video') {
            videoCreateCount++;
          }
          return origCreateElement(tag);
        },
        querySelectorAll: (selector) => {
          if (selector === '.tab-view') return tabViews;
          if (selector === '.nav-tab') return navTabs;
          if (selector === '#videoStage video') return [slotA, slotB];
          return [];
        }
      };

      return { elements, slotA, slotB, getVideoCreateCount: () => videoCreateCount };
    }

    it('keeps index.html, styles.css, and sw.js in 3-way version lockstep with stacked Player A and Player B in #videoStage', () => {
      const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      const swCode = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
      const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

      const verMatch = swCode.match(/const CACHE_NAME = 'reelvault-v(\d+)'/);
      assert.ok(verMatch, 'sw.js must define CACHE_NAME = reelvault-v<N>');
      const ver = Number(verMatch[1]);
      assert.ok(ver >= 32, 'CACHE_NAME version should be >= 32');
      assert.ok(html.includes(`./styles.css?v=${ver}`), `index.html styles.css?v=${ver} must match sw.js`);
      assert.ok(html.includes(`./app.js?v=${ver}`), `index.html app.js?v=${ver} must match sw.js`);
      assert.ok(html.includes('id="mainVideo"') && html.includes('data-player-slot="A"'));
      assert.ok(html.includes('id="standbyVideo"') && html.includes('data-player-slot="B"'));
      assert.ok(css.includes('.video-stage .active-video-layer'));
      assert.ok(css.includes('.video-stage .standby-video-layer'));
    });

    it('swaps foreground/standby roles in 0ms on swipe without reloading or creating <video> elements', async () => {
      const { slotA, slotB, getVideoCreateCount } = createDualVideoMockDom();
      const origPrebuffer = settings.prebuffer;
      const origAutoPlay = settings.autoPlay;
      const origAllowNsfw = settings.allowNsfw;
      const origSpeed = settings.playbackSpeed;

      try {
        settings.prebuffer = true;
        settings.autoPlay = true;
        settings.allowNsfw = false;
        settings.playbackSpeed = 1.5;
        slotA.muted = false;
        slotA.volume = 0.65;

        setAppState({
          videoQueue: [
            { id: 'c0', title: 'Clip 0', videoUrl: 'https://cdn.example/clip0.mp4', format: 'mp4', isNsfw: false },
            { id: 'c1', title: 'Clip 1', videoUrl: 'https://cdn.example/clip1.mp4', format: 'mp4', isNsfw: false },
            { id: 'c2', title: 'Clip 2', videoUrl: 'https://cdn.example/clip2.mp4', format: 'mp4', isNsfw: false },
            { id: 'c3', title: 'Clip 3', videoUrl: 'https://cdn.example/clip3.mp4', format: 'mp4', isNsfw: false }
          ],
          currentIndex: 0
        });

        updatePlayerUI();
        await scheduleBackgroundQueuePrebuffer();

        assert.strictEqual(slotA.id, 'mainVideo');
        assert.strictEqual(slotA.src, 'https://cdn.example/clip0.mp4');
        assert.strictEqual(slotB.id, 'standbyVideo');
        assert.strictEqual(slotB.src, 'https://cdn.example/clip1.mp4');
        assert.strictEqual(slotB.muted, true);
        assert.strictEqual(slotB.style.zIndex, '0');
        assert.strictEqual(slotB.style.opacity, '0');

        const slotBLoadsBeforeSwipe = slotB.loadCount;
        advanceToNextVideo({ userInitiated: true });
        await scheduleBackgroundQueuePrebuffer();

        // Player B is now the active foreground #mainVideo playing Clip 1 without calling .load() again
        assert.strictEqual(slotB.id, 'mainVideo');
        assert.strictEqual(slotB.classList.contains('active-video-layer'), true);
        assert.strictEqual(slotB.style.zIndex, '1');
        assert.strictEqual(slotB.style.opacity, '1');
        assert.strictEqual(slotB.loadCount, slotBLoadsBeforeSwipe, 'Promoted standby layer must not reload src');
        assert.ok(slotB.playCount >= 1, 'Promoted foreground layer should call play() immediately');
        assert.strictEqual(slotB.muted, false, 'Foreground layer should inherit user unmuted state');
        assert.strictEqual(slotB.volume, 0.65, 'Foreground layer should inherit user volume');
        assert.strictEqual(slotB.playbackRate, 1.5, 'Foreground layer should inherit playback speed');

        // Player A was recycled into hidden #standbyVideo preloading Clip 2
        assert.strictEqual(slotA.id, 'standbyVideo');
        assert.strictEqual(slotA.classList.contains('standby-video-layer'), true);
        assert.strictEqual(slotA.muted, true);
        assert.strictEqual(slotA.style.zIndex, '0');
        assert.strictEqual(slotA.style.opacity, '0');
        assert.strictEqual(slotA.src, 'https://cdn.example/clip2.mp4');
        assert.strictEqual(getVideoCreateCount(), 0, 'Zero dynamic <video> elements should be created');
      } finally {
        settings.prebuffer = origPrebuffer;
        settings.autoPlay = origAutoPlay;
        settings.allowNsfw = origAllowNsfw;
        settings.playbackSpeed = origSpeed;
        clearStandbyVideoBuffer();
        setAppState({ videoQueue: [], currentIndex: -1 });
      }
    });

    it('refuses to promote a failed standby buffer and scrubs standby src on App Lock and Panic Safe Mode', async () => {
      const { slotA, slotB } = createDualVideoMockDom();
      const origPrebuffer = settings.prebuffer;

      try {
        settings.prebuffer = true;
        setAppState({
          videoQueue: [
            { id: 'f0', title: 'Clip A', videoUrl: 'https://cdn.example/a.mp4', format: 'mp4' },
            { id: 'f1', title: 'Clip B', videoUrl: 'https://cdn.example/b.mp4', format: 'mp4' },
            { id: 'f2', title: 'Clip C', videoUrl: 'https://cdn.example/c.mp4', format: 'mp4' },
            { id: 'f3', title: 'Clip D', videoUrl: 'https://cdn.example/d.mp4', format: 'mp4' }
          ],
          currentIndex: 0
        });

        updatePlayerUI();
        await scheduleBackgroundQueuePrebuffer();
        assert.strictEqual(slotB.src, 'https://cdn.example/b.mp4');

        // Simulate background prebuffer error on standby layer
        slotB.dataset.prebufferFailed = 'true';
        advanceToNextVideo({ userInitiated: true });
        assert.strictEqual(slotA.id, 'mainVideo', 'Broken standby layer must not be promoted');
        assert.strictEqual(slotA.src, 'https://cdn.example/b.mp4');

        // Re-buffer next item on standby, then verify lockAppGate scrubs standby buffer
        await scheduleBackgroundQueuePrebuffer();
        assert.strictEqual(slotB.src, 'https://cdn.example/c.mp4');
        lockAppGate();
        assert.strictEqual(slotB.src, '', 'lockAppGate must scrub #standbyVideo src');
        assert.strictEqual(slotB.dataset.prebufferedUrl, '');

        unlockAppGate();
        await scheduleBackgroundQueuePrebuffer();
        assert.strictEqual(slotB.src, 'https://cdn.example/c.mp4');
        triggerPanicSafeMode();
        const currentStandby = globalThis.document.getElementById('standbyVideo');
        assert.strictEqual(currentStandby.src, '', 'Panic Safe Mode must scrub #standbyVideo src');
      } finally {
        settings.prebuffer = origPrebuffer;
        unlockAppGate();
        clearStandbyVideoBuffer();
        setAppState({ videoQueue: [], currentIndex: -1 });
      }
    });
  });

  describe('Local-Only AffinityEngine (Smart Personalization)', () => {
    function setupAffinityStorage(initial = {}) {
      const store = new Map(Object.entries(initial));
      globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
      };
      return store;
    }

    it('rewards >=80% completion / Vault / Favorite (+5), clamps weights, and persists strictly separated Safe vs 18+ profiles', () => {
      createMockDom();
      const store = setupAffinityStorage();
      const origAllowNsfw = settings.allowNsfw;

      try {
        settings.allowNsfw = false;
        resetAffinityState();

        const safeClip = {
          id: 'safe-astro-1',
          title: 'NASA Rocket Telemetry',
          videoUrl: 'https://archive.org/download/rocket.mp4',
          tags: ['space', 'rockets'],
          author: '@NASAOfficial',
          platform: 'archive',
          isNsfw: false
        };
        const adultClip = {
          id: 'nsfw-clip-1',
          title: 'Adult Studio Clip',
          videoUrl: 'https://media.redgifs.com/sample.mp4?expires=4102444800',
          tags: ['space', 'glamour'],
          author: 'StudioCreator',
          platform: 'redgifs',
          isNsfw: true
        };

        assert.strictEqual(recordAffinitySignal(safeClip, 'complete'), 5);
        assert.strictEqual(recordAffinitySignal(safeClip, 'vault'), 5);
        assert.strictEqual(recordAffinitySignal(adultClip, 'favorite'), 5);

        const state = AffinityEngine.getState();
        assert.strictEqual(state.safe.tags.space, 10);
        assert.strictEqual(state.safe.authors.nasaofficial, 10);
        assert.strictEqual(state.safe.platforms.archive, 10);
        assert.strictEqual(state.safe.tags.glamour, undefined, '18+ tags must never leak into Safe profile');

        assert.strictEqual(state.nsfw.tags.glamour, 5);
        assert.strictEqual(state.nsfw.authors.studiocreator, 5);
        assert.strictEqual(state.nsfw.platforms.redgifs, 5);
        assert.strictEqual(state.nsfw.tags.rockets, undefined, 'Safe tags must never leak into 18+ profile');

        // Verify localStorage persistence & reload
        assert.ok(store.has(STORAGE_KEYS.AFFINITY_PROFILE));
        setAppState({ resetAffinity: false });
        const reloaded = loadAffinityState();
        assert.strictEqual(reloaded.safe.tags.space, 10);
        assert.strictEqual(reloaded.nsfw.tags.glamour, 5);

        // Verify Safe item sharing only an 18+ tag gets 0 score from 18+ profile
        const safeGlamourTest = {
          id: 'safe-glamour',
          title: 'Fashion Clip',
          videoUrl: 'https://cdn.example/fashion.mp4',
          tags: ['glamour'],
          isNsfw: false
        };
        assert.strictEqual(getVideoAffinityScore(safeGlamourTest), 0);
        assert.ok(getVideoAffinityScore(safeClip) > 20);
      } finally {
        settings.allowNsfw = origAllowNsfw;
        resetAffinityState();
      }
    });

    it('applies -3 penalty on <2s manual skip ONLY after playback started, never on buffering or auto-skips', () => {
      createMockDom();
      setupAffinityStorage();
      const origPrebuffer = settings.prebuffer;
      const origAllowNsfw = settings.allowNsfw;

      try {
        settings.prebuffer = false;
        settings.allowNsfw = false;
        resetAffinityState();

        const clip0 = {
          id: 'sk-0',
          title: 'Unstarted Buffering Clip',
          videoUrl: 'https://cdn.example/sk0.mp4',
          tags: ['buffertag'],
          author: 'bufferauthor',
          platform: 'reddit',
          isNsfw: false
        };
        const clip1 = {
          id: 'sk-1',
          title: 'Error Auto-Skipped Clip',
          videoUrl: 'https://cdn.example/sk1.mp4',
          tags: ['errortag'],
          author: 'errorauthor',
          platform: 'reddit',
          isNsfw: false
        };
        const clip2 = {
          id: 'sk-2',
          title: 'Fast Skipped Played Clip',
          videoUrl: 'https://cdn.example/sk2.mp4',
          tags: ['boringtag'],
          author: 'boringauthor',
          platform: 'reddit',
          isNsfw: false
        };
        const clip3 = {
          id: 'sk-3',
          title: 'Final Clip',
          videoUrl: 'https://cdn.example/sk3.mp4',
          tags: ['finaltag'],
          isNsfw: false
        };

        setAppState({ videoQueue: [clip0, clip1, clip2, clip3], currentIndex: 0 });
        updatePlayerUI();

        // 1. User skips while clip0 never started playing (hasPlayed = false) -> 0 penalty
        advanceToNextVideo({ userInitiated: true });
        assert.strictEqual(AffinityEngine.getState().safe.tags.buffertag, undefined);

        // 2. Non-user-initiated advance on clip1 even if hasPlayed = true -> 0 penalty
        setAppState({ activeAffinityWatch: { hasPlayed: true, accumulatedPlaySec: 0.5, maxCurrentTimeSec: 0.5 } });
        advanceToNextVideo();
        assert.strictEqual(AffinityEngine.getState().safe.tags.errortag, undefined);

        // 3. User-initiated skip on clip2 after 0.8s of actual playback -> -3 penalty
        setAppState({ activeAffinityWatch: { hasPlayed: true, accumulatedPlaySec: 0.8, maxCurrentTimeSec: 0.8 } });
        advanceToNextVideo({ userInitiated: true });
        assert.strictEqual(AffinityEngine.getState().safe.tags.boringtag, -3);
        assert.strictEqual(AffinityEngine.getState().safe.authors.boringauthor, -3);
      } finally {
        settings.prebuffer = origPrebuffer;
        settings.allowNsfw = origAllowNsfw;
        resetAffinityState();
        setAppState({ videoQueue: [], currentIndex: -1 });
      }
    });

    it('ranks incoming items by affinity with exploration slots and re-ranks queue tail without touching currentIndex + 1', () => {
      createMockDom();
      setupAffinityStorage();
      const origPrebuffer = settings.prebuffer;
      const origAllowNsfw = settings.allowNsfw;

      try {
        settings.prebuffer = false;
        settings.allowNsfw = false;
        resetAffinityState();

        // Seed strong positive affinity for 'robotics' and strong negative penalty for 'spamtopic'
        const likedSeed = {
          id: 'seed-like',
          title: 'Robotics Lab',
          videoUrl: 'https://cdn.example/seed1.mp4',
          tags: ['robotics'],
          author: 'mitlab',
          platform: 'archive',
          isNsfw: false
        };
        recordAffinitySignal(likedSeed, 'complete');
        recordAffinitySignal(likedSeed, 'vault');

        const dislikedSeed = {
          id: 'seed-dislike',
          title: 'Spam Clip',
          videoUrl: 'https://cdn.example/seed2.mp4',
          tags: ['spamtopic'],
          isNsfw: false
        };
        recordAffinitySignal(dislikedSeed, 'skip');
        recordAffinitySignal(dislikedSeed, 'skip');
        recordAffinitySignal(dislikedSeed, 'skip'); // -9 (< -6 exploration floor)

        const candidates = [
          { id: 'n1', title: 'Neutral 1', videoUrl: 'https://cdn.example/n1.mp4', tags: ['cooking'], isNsfw: false },
          { id: 'bad1', title: 'Penalized', videoUrl: 'https://cdn.example/bad1.mp4', tags: ['spamtopic'], isNsfw: false },
          { id: 'n2', title: 'Neutral 2', videoUrl: 'https://cdn.example/n2.mp4', tags: ['gardening'], isNsfw: false },
          { id: 'top1', title: 'Top Match 1', videoUrl: 'https://cdn.example/t1.mp4', tags: ['robotics'], author: 'mitlab', isNsfw: false },
          { id: 'top2', title: 'Top Match 2', videoUrl: 'https://cdn.example/t2.mp4', tags: ['robotics'], isNsfw: false }
        ];

        const ranked = rankVideosByAffinity(candidates, { jitter: 0, exploreRatio: 0.25, isNsfw: false });
        assert.strictEqual(ranked[0].id, 'top1');
        assert.strictEqual(ranked[1].id, 'top2');
        assert.strictEqual(ranked[ranked.length - 1].id, 'bad1', 'Heavily penalized clip must stay at bottom');

        // Verify reRankUpcomingQueueTail preserves videoQueue[0] and videoQueue[1] (#standbyVideo)
        const active0 = { id: 'q0', title: 'Playing Now', videoUrl: 'https://cdn.example/q0.mp4', isNsfw: false };
        const standby1 = { id: 'q1', title: 'Prebuffered Next', videoUrl: 'https://cdn.example/q1.mp4', isNsfw: false };
        const tailLow = { id: 'q2', title: 'Low Tail', videoUrl: 'https://cdn.example/q2.mp4', tags: ['spamtopic'], isNsfw: false };
        const tailHigh = { id: 'q3', title: 'High Tail', videoUrl: 'https://cdn.example/q3.mp4', tags: ['robotics'], author: 'mitlab', isNsfw: false };

        setAppState({ videoQueue: [active0, standby1, tailLow, tailHigh], currentIndex: 0 });
        assert.strictEqual(reRankUpcomingQueueTail(), true);

        const reordered = getAppState().videoQueue;
        assert.strictEqual(reordered[0].id, 'q0', 'Active video must stay at currentIndex');
        assert.strictEqual(reordered[1].id, 'q1', 'Prebuffered currentIndex + 1 must remain untouched');
        assert.strictEqual(reordered[2].id, 'q3', 'High-affinity tail item should move ahead of low-affinity tail');
        assert.strictEqual(reordered[3].id, 'q2');
      } finally {
        settings.prebuffer = origPrebuffer;
        settings.allowNsfw = origAllowNsfw;
        resetAffinityState();
        setAppState({ videoQueue: [], currentIndex: -1 });
      }
    });
  });

  describe('0ms App Boot: Service Worker SWR & Expired Session Auto-Refill', () => {
    it('serves cached same-origin App Shell assets in 0ms while revalidating in background and ignores cross-origin APIs', async () => {
      const swSource = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
      const listeners = {};
      const cacheEntries = new Map();
      const cachedResponse = { ok: true, tag: 'cached-app-js', clone() { return this; } };
      cacheEntries.set('https://reelvault.local/app.js', cachedResponse);

      let resolveNetworkFetch;
      const networkPromise = new Promise((r) => {
        resolveNetworkFetch = r;
      });
      const fetchedUrls = [];

      const mockCache = {
        match: async (req, opts) => {
          const url = typeof req === 'string' ? req : req.url;
          if (cacheEntries.has(url)) return cacheEntries.get(url);
          if (opts?.ignoreSearch) {
            const base = url.split('?')[0];
            return cacheEntries.get(base) || null;
          }
          return null;
        },
        put: async (req, res) => {
          const url = typeof req === 'string' ? req : req.url;
          cacheEntries.set(url, res);
        }
      };

      const sandbox = {
        URL,
        Promise,
        Response: { error: () => ({ ok: false }) },
        caches: {
          open: async () => mockCache,
          keys: async () => ['reelvault-v30', 'reelvault-v31'],
          delete: async () => true
        },
        fetch: (req) => {
          const url = typeof req === 'string' ? req : req.url;
          fetchedUrls.push(url);
          return networkPromise;
        },
        self: {
          location: { origin: 'https://reelvault.local' },
          skipWaiting: () => {},
          clients: { claim: () => {} },
          addEventListener: (type, fn) => {
            listeners[type] = fn;
          }
        }
      };

      vm.runInNewContext(swSource, sandbox);
      assert.strictEqual(typeof listeners.fetch, 'function');

      // 1. Cross-origin signed/18+ API request must NOT be intercepted or cached
      let crossOriginResponded = false;
      listeners.fetch({
        request: { method: 'GET', url: 'https://api.redgifs.com/v2/gifs/search?search_text=test' },
        respondWith: () => {
          crossOriginResponded = true;
        },
        waitUntil: () => {}
      });
      assert.strictEqual(crossOriginResponded, false, 'Service Worker must never intercept cross-origin API JSON');

      // 2. Same-origin App Shell asset resolves immediately from cache BEFORE network settles
      let swResponsePromise = null;
      const waitUntilPromises = [];
      listeners.fetch({
        request: { method: 'GET', url: 'https://reelvault.local/app.js?v=31' },
        respondWith: (p) => {
          swResponsePromise = p;
        },
        waitUntil: (p) => {
          waitUntilPromises.push(p);
        }
      });

      assert.ok(swResponsePromise, 'Same-origin GET should be handled by SW');
      const immediateResult = await swResponsePromise;
      assert.strictEqual(immediateResult.tag, 'cached-app-js', 'Cached shell must return in 0ms before network resolves');
      assert.strictEqual(fetchedUrls.length, 1);

      // Now finish background network fetch and verify cache updates cleanly
      const updatedResponse = { ok: true, tag: 'fresh-app-js-v31', clone() { return this; } };
      resolveNetworkFetch(updatedResponse);
      await Promise.all(waitUntilPromises);
      assert.strictEqual(cacheEntries.get('https://reelvault.local/app.js?v=31').tag, 'fresh-app-js-v31');
    });

    it('flags expired overnight sessions during restorePlaybackState and auto-pulls fresh feed on unlockAppGate', async () => {
      createMockDom();
      const origResume = settings.resumePlayback;
      const origPrebuffer = settings.prebuffer;
      const origAllowNsfw = settings.allowNsfw;
      const origFetch = globalThis.fetch;

      const store = new Map();
      globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
      };

      let fetchTriggered = 0;
      globalThis.fetch = async () => {
        fetchTriggered++;
        return {
          ok: true,
          json: async () => ({ data: { children: [] }, response: { docs: [] } }),
          text: async () => ''
        };
      };

      try {
        settings.resumePlayback = true;
        settings.prebuffer = true;
        settings.allowNsfw = false;

        setAppState({
          sources: [{ id: 's-reddit', type: 'subreddit', value: 'space', label: 'r/space', enabled: true }],
          videoQueue: [],
          currentIndex: -1,
          savedSessionExpiredOnRestore: false
        });

        // Simulate a saved session whose CDN token expired overnight (?expires=1700000000)
        store.set(
          STORAGE_KEYS.PLAYBACK_STATE,
          JSON.stringify({
            currentVideo: {
              id: 'exp-1',
              title: 'Expired CDN Stream',
              videoUrl: 'https://cdn.example/clip.mp4?expires=1700000000',
              format: 'mp4',
              isNsfw: false
            },
            videoQueue: [
              {
                id: 'exp-1',
                title: 'Expired CDN Stream',
                videoUrl: 'https://cdn.example/clip.mp4?expires=1700000000',
                format: 'mp4',
                isNsfw: false
              }
            ],
            currentIndex: 0,
            currentTime: 4.2
          })
        );

        const restored = restorePlaybackState();
        assert.strictEqual(restored, false);
        assert.strictEqual(
          getAppState().savedSessionExpiredOnRestore,
          true,
          'Pruning all expired session items should mark savedSessionExpiredOnRestore = true'
        );

        unlockAppGate();
        await new Promise((r) => setTimeout(r, 25));

        assert.strictEqual(getAppState().savedSessionExpiredOnRestore, false);
        assert.ok(fetchTriggered > 0, 'unlockAppGate should auto-pull fresh videos after overnight session expiry');
      } finally {
        globalThis.fetch = origFetch;
        settings.resumePlayback = origResume;
        settings.prebuffer = origPrebuffer;
        settings.allowNsfw = origAllowNsfw;
        setAppState({ videoQueue: [], currentIndex: -1, savedSessionExpiredOnRestore: false });
      }
    });
  });
});
