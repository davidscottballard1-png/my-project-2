const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  detectVideoFormat,
  normalizeAndAutoRewriteVideoUrl,
  VIDEO_FORMAT_CATALOG
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
      // Default fallback is 'mp4'
      assert.strictEqual(detectVideoFormat(null).ext, 'mp4');
      assert.strictEqual(detectVideoFormat(undefined).ext, 'mp4');
      assert.strictEqual(detectVideoFormat('').ext, 'mp4');
      assert.strictEqual(detectVideoFormat(12345).ext, 'mp4');
      assert.strictEqual(detectVideoFormat({}).ext, 'mp4');
      assert.strictEqual(detectVideoFormat('https://example.com/not-a-video').ext, 'mp4');
      assert.strictEqual(detectVideoFormat('https://example.com/document.pdf').ext, 'mp4');

      // Custom fallback format
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

      // Uppercase .GIFV
      const upperGifv = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/example.GIFV');
      assert.strictEqual(upperGifv.videoUrl, 'https://i.imgur.com/example.mp4');
      assert.strictEqual(upperGifv.isAutoConverted, true);

      // .gifv with query string
      const gifvQuery = normalizeAndAutoRewriteVideoUrl('https://i.imgur.com/example.gifv?token=123');
      assert.strictEqual(gifvQuery.videoUrl, 'https://i.imgur.com/example.mp4?token=123');
      assert.strictEqual(gifvQuery.isAutoConverted, true);

      // .gifv with hash anchor
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

      // Both .gifv rewrite and &amp; unescaping
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

      // Verify specific expected mime types
      assert.strictEqual(VIDEO_FORMAT_CATALOG.mp4.mime, 'video/mp4');
      assert.strictEqual(VIDEO_FORMAT_CATALOG.webm.mime, 'video/webm');
      assert.strictEqual(VIDEO_FORMAT_CATALOG.m3u8.mime, 'application/vnd.apple.mpegurl');
      assert.strictEqual(VIDEO_FORMAT_CATALOG.gifv.mime, 'video/mp4');
    });
  });
});
