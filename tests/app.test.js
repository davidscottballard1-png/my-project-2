const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
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
  getFormatBadgeInfo,
  getEffectivePlaybackUrl
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
});
