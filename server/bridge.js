#!/usr/bin/env node
'use strict';

const http = require('node:http');
const dns = require('node:dns');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { spawn, execFile } = require('node:child_process');

const PORT = Number(process.env.PORT) || 8787;
const API_KEY = String(process.env.REELVAULT_API_KEY || '').trim();
const RESIDENTIAL_PROXY_URL = String(process.env.RESIDENTIAL_PROXY_URL || '').trim();
const PLEX_URL = String(process.env.PLEX_URL || 'http://host.docker.internal:32400').replace(/\/+$/, '');
const ENV_PLEX_TOKEN = String(process.env.PLEX_TOKEN || '').trim();
const VPS_IP = String(process.env.VPS_IP || '').trim();
const PLEX_DOMAIN = String(process.env.PLEX_DOMAIN || '').trim();
const PLEX_PREFS_PATH =
  process.env.PLEX_PREFS_PATH ||
  '/plex-config/Library/Application Support/Plex Media Server/Preferences.xml';
const MEDIA_SAFE_DIR = process.env.MEDIA_SAFE_DIR || '/data/safe';
const MEDIA_NSFW_DIR = process.env.MEDIA_NSFW_DIR || '/data/vault-18';

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'host.docker.internal',
  'plex',
  'reelvault-plex',
  'caddy',
  'reelvault-caddy',
  'reelvault-bridge',
  'metadata.google.internal',
  'metadata'
]);

const BINARY_MEDIA_EXT_REGEX =
  /\.(?:mp4|m4v|mov|webm|ogv|ogg|mkv|avi|mpeg|mpg|3gp|3g2|flv|f4v|wmv|ts|m2ts|m4s|aac|mp3|m4a)(?:[?#]|$)/i;

const VIDEO_CDN_HOST_REGEX =
  /(?:^|\.)(?:v\.redd\.it|redd\.it|media\.redgifs\.com|thumbs\d*\.redgifs\.com|gvideo\.eporner\.com|commondatastorage\.googleapis\.com|upload\.wikimedia\.org)$/i;

const PROXY_FIRST_METADATA_HOST_REGEX = /(?:^|\.)(?:reddit\.com|redd\.it)$/i;

function isPrivateOrReservedIp(ip) {
  const clean = String(ip || '').trim().toLowerCase();
  if (!clean) return true;

  const v4Mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped) {
    return isPrivateOrReservedIp(v4Mapped[1]);
  }
  const v4MappedHex = clean.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (v4MappedHex) {
    const hi = parseInt(v4MappedHex[1], 16);
    const lo = parseInt(v4MappedHex[2], 16);
    const dotted = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
    return isPrivateOrReservedIp(dotted);
  }

  const ver = net.isIP(clean);
  if (ver === 4) {
    const parts = clean.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    return false;
  }

  if (ver === 6) {
    if (clean === '::' || clean === '::1') return true;
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
    if (/^fe[89ab]/i.test(clean)) return true;
    if (clean.startsWith('ff')) return true;
    if (clean.startsWith('2001:db8:')) return true;
    return false;
  }

  return true;
}

async function assertSafePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Invalid target URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in target URL are not permitted');
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('Blocked internal hostname');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Blocked private or reserved IP address');
    }
    return parsed;
  }

  let records;
  try {
    records = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Unable to resolve host: ${host}`);
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`No DNS records found for host: ${host}`);
  }

  for (const rec of records) {
    if (!rec?.address || isPrivateOrReservedIp(rec.address)) {
      throw new Error('Target resolves to a private or reserved IP address');
    }
  }

  return parsed;
}

function extractProvidedApiKey(req, parsedUrl) {
  const authHeader = String(req.headers?.authorization || '').trim();
  if (/^bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^bearer\s+/i, '').trim();
  }
  const headerKey = String(req.headers?.['x-api-key'] || '').trim();
  if (headerKey) return headerKey;
  const queryKey = String(parsedUrl.searchParams.get('key') || '').trim();
  if (queryKey) return queryKey;
  return '';
}

function verifyApiKey(providedKey, expectedKey = API_KEY) {
  if (!expectedKey || !providedKey) return false;
  const a = Buffer.from(String(providedKey));
  const b = Buffer.from(String(expectedKey));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key, Range');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges, Content-Type'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function buildUpstreamReferer(parsedUrl) {
  const host = parsedUrl.hostname.toLowerCase();
  if (host.includes('redgifs.com')) return 'https://www.redgifs.com/';
  if (host.includes('eporner.com')) return 'https://www.eporner.com/';
  if (host.includes('redd.it') || host.includes('reddit.com')) return 'https://www.reddit.com/';
  return `${parsedUrl.protocol}//${parsedUrl.host}/`;
}

function isBinaryMediaRequest(parsedUrl, req) {
  if (req?.headers?.range) return true;
  if (BINARY_MEDIA_EXT_REGEX.test(parsedUrl.pathname)) return true;
  if (VIDEO_CDN_HOST_REGEX.test(parsedUrl.hostname) && !/\.json$/i.test(parsedUrl.pathname)) {
    return true;
  }
  if (/archive\.org$/i.test(parsedUrl.hostname) && /^\/download\//i.test(parsedUrl.pathname)) {
    return true;
  }
  return false;
}

function shouldPreferResidentialProxyFirst(parsedUrl) {
  if (!RESIDENTIAL_PROXY_URL) return false;
  return PROXY_FIRST_METADATA_HOST_REGEX.test(parsedUrl.hostname);
}

function isBlockedTextPayload(status, text) {
  if ([401, 403, 429, 451, 503].includes(status)) return true;
  if (typeof text !== 'string') return false;
  const sample = text.slice(0, 1200);
  return /<title[^>]*>\s*(?:Just a moment\.\.\.|Attention Required!|Access denied|Whoa there,\s*pardner!|Blocked)\s*<\/title>/i.test(
    sample
  );
}

function fetchViaCurlProxy(targetUrl, referer, timeoutSec = 14) {
  return new Promise((resolve, reject) => {
    const marker = `__RV_META_${crypto.randomBytes(6).toString('hex')}__`;
    const args = [
      '-sS',
      '-L',
      '--max-redirs',
      '4',
      '--max-time',
      String(timeoutSec),
      '--max-filesize',
      String(12 * 1024 * 1024),
      '--compressed',
      '-A',
      BROWSER_UA,
      '-H',
      'Accept: application/json,text/html,application/xhtml+xml,application/vnd.apple.mpegurl,*/*;q=0.8',
      '-H',
      'Accept-Language: en-US,en;q=0.9',
      '-e',
      referer,
      '--config',
      '-',
      '-w',
      `\n${marker}%{http_code}|%{content_type}`,
      targetUrl
    ];

    const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let errText = '';
    let total = 0;

    child.stdout.on('data', (buf) => {
      total += buf.length;
      if (total <= 15 * 1024 * 1024) chunks.push(buf);
    });
    child.stderr.on('data', (buf) => {
      errText += buf.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const full = Buffer.concat(chunks);
      const markerBuf = Buffer.from(`\n${marker}`);
      const idx = full.lastIndexOf(markerBuf);
      if (code !== 0 && idx < 0) {
        return reject(new Error(errText.trim() || `curl exited with code ${code}`));
      }
      if (idx < 0) {
        return resolve({ status: 200, contentType: 'text/plain; charset=utf-8', body: full });
      }
      const body = full.subarray(0, idx);
      const meta = full.subarray(idx + markerBuf.length).toString('utf8').trim();
      const [codeStr, ct] = meta.split('|');
      resolve({
        status: Number(codeStr) || 200,
        contentType: ct || 'text/plain; charset=utf-8',
        body
      });
    });

    const escapedProxy = RESIDENTIAL_PROXY_URL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    child.stdin.write(`proxy = "${escapedProxy}"\n`);
    child.stdin.end();
  });
}

async function fetchSafeWithRedirects(initialUrl, fetchOpts = {}, maxRedirects = 4) {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = await assertSafePublicUrl(currentUrl);
    const res = await fetch(parsed.href, {
      ...fetchOpts,
      redirect: 'manual'
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      try {
        await res.body?.cancel?.();
      } catch {}
      if (!loc) return res;
      currentUrl = new URL(loc, parsed.href).href;
      continue;
    }
    return res;
  }
  throw new Error('Too many upstream redirects');
}

async function handleProxyRequest(req, res, parsedReqUrl) {
  const rawTarget = parsedReqUrl.searchParams.get('url') || '';
  let parsedTarget;
  try {
    parsedTarget = await assertSafePublicUrl(rawTarget);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: err.message });
  }

  const referer = buildUpstreamReferer(parsedTarget);
  const isMedia = isBinaryMediaRequest(parsedTarget, req);

  // 1. Metadata / JSON / HTML / M3U8 path (uses Webshare Residential Proxy selectively without wasting GBs on video bytes)
  if (!isMedia && req.method === 'GET') {
    const preferProxy = shouldPreferResidentialProxyFirst(parsedTarget);

    if (preferProxy) {
      try {
        const proxied = await fetchViaCurlProxy(parsedTarget.href, referer);
        if (proxied.status >= 200 && proxied.status < 400 && proxied.body.length > 0) {
          setCorsHeaders(res);
          res.writeHead(proxied.status, {
            'Content-Type': proxied.contentType,
            'Cache-Control': 'public, max-age=45',
            'Content-Length': proxied.body.length
          });
          return res.end(proxied.body);
        }
      } catch {
        // Fall through to direct attempt
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const upstream = await fetchSafeWithRedirects(parsedTarget.href, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept:
            'application/json,text/html,application/xhtml+xml,application/vnd.apple.mpegurl,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: referer
        }
      });
      clearTimeout(timer);

      const ct = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
      if (/^(?:video|audio)\//i.test(ct)) {
        return pipeUpstreamStream(req, res, upstream);
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      const sampleText = buf.subarray(0, 1200).toString('utf8');

      if (
        RESIDENTIAL_PROXY_URL &&
        !preferProxy &&
        isBlockedTextPayload(upstream.status, sampleText)
      ) {
        try {
          const rescued = await fetchViaCurlProxy(parsedTarget.href, referer);
          if (rescued.status >= 200 && rescued.status < 400 && rescued.body.length > 0) {
            setCorsHeaders(res);
            res.writeHead(rescued.status, {
              'Content-Type': rescued.contentType,
              'Cache-Control': 'public, max-age=45',
              'Content-Length': rescued.body.length
            });
            return res.end(rescued.body);
          }
        } catch {
          // Return original response below
        }
      }

      setCorsHeaders(res);
      res.writeHead(upstream.status, {
        'Content-Type': ct,
        'Cache-Control': upstream.ok ? 'public, max-age=45' : 'no-store',
        'Content-Length': buf.length
      });
      return res.end(buf);
    } catch (err) {
      clearTimeout(timer);
      if (RESIDENTIAL_PROXY_URL && !preferProxy) {
        try {
          const rescued = await fetchViaCurlProxy(parsedTarget.href, referer);
          setCorsHeaders(res);
          res.writeHead(rescued.status, {
            'Content-Type': rescued.contentType,
            'Cache-Control': 'no-store',
            'Content-Length': rescued.body.length
          });
          return res.end(rescued.body);
        } catch {}
      }
      return sendJson(res, 502, { ok: false, error: err.message || 'Upstream fetch failed' });
    }
  }

  // 2. Direct Unmetered Contabo Fiber Video Streaming (supports Range / 206 Partial Content for iOS Safari <video>)
  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), 18000);
  req.on('close', () => {
    try {
      controller.abort();
    } catch {}
  });

  try {
    const headers = {
      'User-Agent': BROWSER_UA,
      Accept: req.headers.accept || '*/*',
      Referer: referer
    };
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const upstream = await fetchSafeWithRedirects(parsedTarget.href, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(connectTimer);
    return pipeUpstreamStream(req, res, upstream);
  } catch (err) {
    clearTimeout(connectTimer);
    if (!res.headersSent) {
      return sendJson(res, 502, { ok: false, error: err.message || 'Upstream stream error' });
    }
    res.destroy();
  }
}

function pipeUpstreamStream(req, res, upstream) {
  setCorsHeaders(res);
  const outHeaders = {
    'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    'Cache-Control': 'public, max-age=3600'
  };
  const len = upstream.headers.get('content-length');
  if (len) outHeaders['Content-Length'] = len;
  const range = upstream.headers.get('content-range');
  if (range) outHeaders['Content-Range'] = range;

  res.writeHead(upstream.status, outHeaders);
  if (req.method === 'HEAD' || !upstream.body) {
    return res.end();
  }
  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.on('error', () => {
    if (!res.writableEnded) res.destroy();
  });
  nodeStream.pipe(res);
}

// ==========================================
// YT-DLP METADATA EXTRACTOR (/extract)
// ==========================================

function runYtDlpJson(targetUrl, useResidentialProxy = false) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--socket-timeout',
      '15',
      '--user-agent',
      BROWSER_UA
    ];
    if (useResidentialProxy && RESIDENTIAL_PROXY_URL) {
      args.push('--proxy', RESIDENTIAL_PROXY_URL);
    }
    args.push('--', targetUrl);

    execFile('yt-dlp', args, { maxBuffer: 20 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error((stderr || err.message || 'yt-dlp failed').slice(0, 400)));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Invalid JSON from yt-dlp'));
      }
    });
  });
}

function pickPlayableItemsFromYtDlp(info, fallbackPageUrl) {
  if (!info || typeof info !== 'object') return [];
  const entries = Array.isArray(info.entries) && info.entries.length > 0 ? info.entries.slice(0, 6) : [info];
  const items = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const formats = Array.isArray(entry.formats) ? entry.formats : [];
    const httpFormats = formats.filter(
      (f) => f && typeof f.url === 'string' && /^https?:\/\//i.test(f.url)
    );

    // Prefer progressive MP4 with both video (H.264) and audio so browser <video> plays with sound
    const progressiveMp4 = httpFormats
      .filter(
        (f) =>
          f.ext === 'mp4' &&
          f.vcodec &&
          f.vcodec !== 'none' &&
          f.acodec &&
          f.acodec !== 'none' &&
          !/^m3u8/i.test(String(f.protocol || ''))
      )
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0));

    const hlsFormats = httpFormats
      .filter((f) => /^m3u8/i.test(String(f.protocol || '')) || /\.m3u8(?:[?#]|$)/i.test(f.url))
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0));

    const anyVideo = httpFormats
      .filter((f) => f.vcodec && f.vcodec !== 'none')
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0));

    const best =
      progressiveMp4.find((f) => /^avc1|h264/i.test(String(f.vcodec || ''))) ||
      progressiveMp4[0] ||
      hlsFormats[0] ||
      anyVideo[0] ||
      (typeof entry.url === 'string' && /^https?:\/\//i.test(entry.url) ? { url: entry.url, ext: entry.ext || 'mp4' } : null);

    if (!best?.url) continue;

    const isM3u8 = /^m3u8/i.test(String(best.protocol || '')) || /\.m3u8(?:[?#]|$)/i.test(best.url);
    const ext = isM3u8 ? 'm3u8' : String(best.ext || 'mp4').toLowerCase();

    items.push({
      id: `cloud-${entry.id || Date.now()}`,
      title: entry.title || info.title || 'Extracted Video',
      videoUrl: best.url,
      originalUrl: entry.webpage_url || fallbackPageUrl,
      convertedUrl: progressiveMp4[1]?.url || null,
      format: ext,
      duration: Number(entry.duration) || 0,
      isHd: (Number(best.height) || 0) >= 720,
      tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 6) : [],
      sourceName: entry.extractor_key ? `${entry.extractor_key} (Cloud)` : 'Cloud Extractor',
      pageUrl: entry.webpage_url || fallbackPageUrl
    });
  }

  return items;
}

async function handleExtractRequest(res, parsedReqUrl) {
  const rawTarget = parsedReqUrl.searchParams.get('url') || '';
  let parsedTarget;
  try {
    parsedTarget = await assertSafePublicUrl(rawTarget);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: err.message });
  }

  const preferProxy = shouldPreferResidentialProxyFirst(parsedTarget);
  try {
    let info;
    try {
      info = await runYtDlpJson(parsedTarget.href, preferProxy);
    } catch (firstErr) {
      if (RESIDENTIAL_PROXY_URL && !preferProxy) {
        info = await runYtDlpJson(parsedTarget.href, true);
      } else {
        throw firstErr;
      }
    }
    const items = pickPlayableItemsFromYtDlp(info, parsedTarget.href);
    return sendJson(res, 200, { ok: true, items });
  } catch (err) {
    return sendJson(res, 200, { ok: false, items: [], error: err.message });
  }
}

// ==========================================
// PLEX AUTO-DISCOVERY, LIBRARY BOOTSTRAP & SAVE QUEUE
// ==========================================

function readPlexToken() {
  if (ENV_PLEX_TOKEN) return ENV_PLEX_TOKEN;
  try {
    if (fs.existsSync(PLEX_PREFS_PATH)) {
      const xml = fs.readFileSync(PLEX_PREFS_PATH, 'utf8');
      const m = xml.match(/PlexOnlineToken="([^"]+)"/);
      if (m?.[1]) return m[1].trim();
    }
  } catch {}
  return '';
}

async function getPlexSections(token) {
  if (!token) return null;
  const res = await fetch(`${PLEX_URL}/library/sections?X-Plex-Token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data?.MediaContainer?.Directory) ? data.MediaContainer.Directory : [];
}

let lastPlexConnectivityCheckAt = 0;

function isGenericContainerOrVpsName(name) {
  const clean = String(name || '').trim();
  if (!clean) return true;
  // Matches 12-char hex Docker container IDs (e.g. c9b3ab10cc47) or generic default VPS hostnames (e.g. Contabo vmi123456)
  return /^(?:[0-9a-f]{12}|vmi\d+(?:\..+)?|localhost|ubuntu|debian)$/i.test(clean);
}

function buildDesiredCustomConnections(plexDomain = PLEX_DOMAIN, vpsIp = VPS_IP) {
  const urls = [];
  const cleanDomain = String(plexDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/:\d+$/, '');
  const cleanIp = String(vpsIp || '').trim();
  if (cleanDomain) {
    urls.push(`https://${cleanDomain}:443`);
  }
  if (cleanIp && net.isIP(cleanIp) === 4 && !isPrivateOrReservedIp(cleanIp)) {
    urls.push(`http://${cleanIp}:32400`);
  }
  return urls;
}

async function ensurePlexRemoteConnectivity(token, opts = {}) {
  if (!token) return { synced: false, updated: [] };

  const basePlexUrl = String(opts.plexUrl || PLEX_URL).replace(/\/+$/, '');
  const plexDomain = opts.plexDomain !== undefined ? opts.plexDomain : PLEX_DOMAIN;
  const vpsIp = opts.vpsIp !== undefined ? opts.vpsIp : VPS_IP;
  const force = Boolean(opts.force);

  const prefsRes = await fetch(`${basePlexUrl}/:/prefs?X-Plex-Token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(6000)
  });
  if (!prefsRes.ok) {
    return { synced: false, updated: [] };
  }

  const prefsData = await prefsRes.json();
  const rawSettings = Array.isArray(prefsData?.MediaContainer?.Setting)
    ? prefsData.MediaContainer.Setting
    : [];

  const byLower = new Map();
  for (const s of rawSettings) {
    if (s && typeof s.id === 'string') {
      byLower.set(s.id.toLowerCase(), s);
    }
  }

  const findSetting = (...names) => {
    for (const n of names) {
      const found = byLower.get(String(n).toLowerCase());
      if (found) return found;
    }
    return null;
  };

  const isTruthyPref = (v) =>
    v === true || v === 1 || v === '1' || String(v || '').toLowerCase() === 'true';

  const formatBoolValue = (setting, val) => {
    if (setting?.type === 'int') return val ? '1' : '0';
    return val ? 'true' : 'false';
  };

  const updates = [];

  const friendlySetting = findSetting('FriendlyName');
  let friendlyName = String(friendlySetting?.value || '').trim();
  if (friendlySetting && isGenericContainerOrVpsName(friendlyName)) {
    friendlyName = 'ReelVault Cloud';
    updates.push([friendlySetting.id, friendlyName]);
  }

  const eulaSetting = findSetting('acceptedEULA');
  if (eulaSetting && !isTruthyPref(eulaSetting.value)) {
    updates.push([eulaSetting.id, formatBoolValue(eulaSetting, true)]);
  }

  const publishSetting = findSetting('PublishServerOnPlexOnlineKey', 'PublishServerOnPlexOnline');
  if (publishSetting && !isTruthyPref(publishSetting.value)) {
    updates.push([publishSetting.id, formatBoolValue(publishSetting, true)]);
  }

  const manualModeSetting = findSetting('ManualPortMappingMode');
  if (manualModeSetting && !isTruthyPref(manualModeSetting.value)) {
    updates.push([manualModeSetting.id, formatBoolValue(manualModeSetting, true)]);
  }

  const manualPortSetting = findSetting('ManualPortMappingPort');
  if (manualPortSetting && Number(manualPortSetting.value) !== 32400) {
    updates.push([manualPortSetting.id, '32400']);
  }

  const secureSetting = findSetting('secureConnections');
  if (secureSetting && Number(secureSetting.value) !== 1) {
    updates.push([secureSetting.id, '1']);
  }

  const customConnSetting = findSetting('customConnections');
  const desiredUrls = buildDesiredCustomConnections(plexDomain, vpsIp);
  let customConnections = String(customConnSetting?.value || '').trim();
  if (customConnSetting && desiredUrls.length > 0) {
    const cleanedExisting = customConnections
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter((u) => {
        if (!u) return false;
        try {
          const parsed = new URL(u);
          if (net.isIP(parsed.hostname) && isPrivateOrReservedIp(parsed.hostname)) return false;
          if (parsed.hostname === 'localhost') return false;
          if (/\.(?:nip|sslip)\.io$/i.test(parsed.hostname) && parsed.port === '32400') return false;
          return true;
        } catch {
          return false;
        }
      });

    const merged = [...new Set([...desiredUrls, ...cleanedExisting])].join(',');
    if (customConnections !== merged) {
      customConnections = merged;
      updates.push([customConnSetting.id, merged]);
    }
  }

  const appliedKeys = [];
  for (const [exactKey, val] of updates) {
    const putRes = await fetch(
      `${basePlexUrl}/:/prefs?${encodeURIComponent(exactKey)}=${encodeURIComponent(
        val
      )}&X-Plex-Token=${encodeURIComponent(token)}`,
      {
        method: 'PUT',
        signal: AbortSignal.timeout(6000)
      }
    );
    if (putRes.ok) {
      appliedKeys.push(exactKey);
    }
  }

  if (appliedKeys.length > 0 || force) {
    await fetch(
      `${basePlexUrl}/myplex/refreshReachability?X-Plex-Token=${encodeURIComponent(token)}`,
      {
        method: 'PUT',
        signal: AbortSignal.timeout(8000)
      }
    ).catch(() => {});
  }

  return {
    synced: true,
    updated: appliedKeys,
    friendlyName: friendlyName || null,
    customConnections: customConnections || null
  };
}

async function ensurePlexLibraries(opts = {}) {
  const token = readPlexToken();
  if (!token) {
    return { reachable: false, claimed: false, libraries: [] };
  }

  try {
    let dirs = await getPlexSections(token);
    if (!dirs) {
      return { reachable: false, claimed: true, libraries: [] };
    }

    let remoteAccess = null;
    const now = Date.now();
    if (opts.forceRefresh || now - lastPlexConnectivityCheckAt > 45000) {
      lastPlexConnectivityCheckAt = now;
      remoteAccess = await ensurePlexRemoteConnectivity(token, {
        force: Boolean(opts.forceRefresh)
      }).catch(() => null);
    }

    const hasPath = (sections, targetPath) =>
      sections.some((sec) =>
        (sec.Location || []).some((loc) => String(loc.path || '').replace(/\/+$/, '') === targetPath)
      );

    let createdAny = false;
    if (!hasPath(dirs, MEDIA_SAFE_DIR)) {
      const params = new URLSearchParams({
        name: 'ReelVault Clips',
        type: 'movie',
        agent: 'com.plexapp.agents.none',
        scanner: 'Plex Video Files Scanner',
        language: 'xn',
        location: MEDIA_SAFE_DIR,
        'X-Plex-Token': token
      });
      const addSafe = await fetch(`${PLEX_URL}/library/sections?${params.toString()}`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000)
      });
      if (addSafe.ok) createdAny = true;
    }

    if (!hasPath(dirs, MEDIA_NSFW_DIR)) {
      const params = new URLSearchParams({
        name: 'ReelVault 18+ Vault',
        type: 'movie',
        agent: 'com.plexapp.agents.none',
        scanner: 'Plex Video Files Scanner',
        language: 'xn',
        location: MEDIA_NSFW_DIR,
        'prefs[includeInGlobal]': '0',
        'X-Plex-Token': token
      });
      const addNsfw = await fetch(`${PLEX_URL}/library/sections?${params.toString()}`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000)
      });
      if (addNsfw.ok) createdAny = true;
    }

    if (createdAny) {
      dirs = (await getPlexSections(token)) || dirs;
    }

    return {
      reachable: true,
      claimed: true,
      friendlyName: remoteAccess?.friendlyName || undefined,
      updatedPrefs: remoteAccess?.updated || undefined,
      libraries: dirs.map((d) => ({ id: d.key, title: d.title }))
    };
  } catch {
    return { reachable: false, claimed: Boolean(token), libraries: [] };
  }
}

async function triggerPlexScan(targetFolder) {
  const token = readPlexToken();
  if (!token) return false;
  try {
    await ensurePlexLibraries();
    const dirs = await getPlexSections(token);
    if (!dirs) return false;

    const cleanFolder = targetFolder.replace(/\/+$/, '');
    const matched = dirs.filter((sec) =>
      (sec.Location || []).some((loc) => String(loc.path || '').replace(/\/+$/, '') === cleanFolder)
    );
    const targets = matched.length > 0 ? matched : dirs;

    await Promise.allSettled(
      targets.map((sec) =>
        fetch(
          `${PLEX_URL}/library/sections/${encodeURIComponent(sec.key)}/refresh?X-Plex-Token=${encodeURIComponent(
            token
          )}`,
          { signal: AbortSignal.timeout(5000) }
        )
      )
    );
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilenameTitle(rawTitle, fallback = 'ReelVault_Clip') {
  const cleaned = String(rawTitle || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return cleaned || fallback;
}

function isSpecificWatchPageUrl(rawPageUrl) {
  if (!rawPageUrl || typeof rawPageUrl !== 'string') return false;
  try {
    const u = new URL(rawPageUrl.trim());
    const p = u.pathname.replace(/\/+$/, '');
    if (!p || p === '') return false;
    if (/reddit\.com$/i.test(u.hostname)) return /\/comments\//i.test(p);
    if (/redgifs\.com$/i.test(u.hostname)) return /\/(?:watch|ifr|detail)\//i.test(p);
    return p.length > 3;
  } catch {
    return false;
  }
}

function runExecFile(cmd, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error((stderr || stdout || err.message || `${cmd} failed`).slice(-500)));
      }
      resolve({ stdout, stderr });
    });
  });
}

async function downloadUrlWithYtDlp(targetUrl, outTemplate, useProxy = false) {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout',
    '20',
    '--retries',
    '3',
    '--fragment-retries',
    '3',
    '--concurrent-fragments',
    '4',
    '--user-agent',
    BROWSER_UA,
    '-f',
    'bestvideo[vcodec^=avc1][height<=1080]+bestaudio[acodec^=mp4a]/best[ext=mp4][height<=1080]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '--merge-output-format',
    'mp4',
    '--ppa',
    'Merger+ffmpeg_o:-movflags +faststart',
    '-o',
    outTemplate
  ];
  if (useProxy && RESIDENTIAL_PROXY_URL) {
    args.push('--proxy', RESIDENTIAL_PROXY_URL);
  }
  args.push('--', targetUrl);
  await runExecFile('yt-dlp', args, 8 * 60 * 1000);
}

async function ensureDirectPlayMp4(inputFile, finalDestFile) {
  let vcodec = '';
  try {
    const { stdout } = await runExecFile(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputFile
      ],
      20000
    );
    vcodec = String(stdout || '').trim().toLowerCase();
  } catch {}

  const isAppleNativeCodec = vcodec === 'h264' || vcodec === 'hevc';
  const isMp4Ext = inputFile.toLowerCase().endsWith('.mp4');

  if (isAppleNativeCodec && isMp4Ext) {
    fs.copyFileSync(inputFile, finalDestFile);
    return;
  }

  const ffArgs = isAppleNativeCodec
    ? ['-y', '-i', inputFile, '-c', 'copy', '-movflags', '+faststart', finalDestFile]
    : [
        '-y',
        '-i',
        inputFile,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '22',
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        finalDestFile
      ];

  await runExecFile('ffmpeg', ffArgs, 10 * 60 * 1000);
}

const plexJobs = [];
const jobQueue = [];
let activeWorkers = 0;
const MAX_CONCURRENT_JOBS = 2;

function recordJob(job) {
  plexJobs.unshift(job);
  if (plexJobs.length > 30) plexJobs.pop();
}

function pumpJobQueue() {
  while (activeWorkers < MAX_CONCURRENT_JOBS && jobQueue.length > 0) {
    const nextJob = jobQueue.shift();
    activeWorkers++;
    processPlexSaveJob(nextJob)
      .catch((err) => {
        nextJob.status = 'error';
        nextJob.error = err.message || 'Download failed';
        nextJob.finishedAt = Date.now();
      })
      .finally(() => {
        activeWorkers--;
        pumpJobQueue();
      });
  }
}

async function processPlexSaveJob(job) {
  job.status = 'downloading';
  const destDir = job.isNsfw ? MEDIA_NSFW_DIR : MEDIA_SAFE_DIR;
  fs.mkdirSync(destDir, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `rv-plex-${job.id}-`));
  const outTemplate = path.join(tmpDir, 'clip.%(ext)s');

  try {
    let downloaded = false;
    let lastErr = null;

    for (const candidateUrl of job.candidates) {
      const parsed = await assertSafePublicUrl(candidateUrl);
      const preferProxy = shouldPreferResidentialProxyFirst(parsed);
      try {
        await downloadUrlWithYtDlp(parsed.href, outTemplate, preferProxy);
        downloaded = true;
        break;
      } catch (err1) {
        lastErr = err1;
        if (RESIDENTIAL_PROXY_URL && !preferProxy) {
          try {
            await downloadUrlWithYtDlp(parsed.href, outTemplate, true);
            downloaded = true;
            break;
          } catch (err2) {
            lastErr = err2;
          }
        }
      }
    }

    if (!downloaded) {
      throw lastErr || new Error('Could not download media stream');
    }

    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'))
      .map((f) => path.join(tmpDir, f));

    if (files.length === 0) {
      throw new Error('Downloader produced no output file');
    }

    files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
    const largestFile = files[0];

    job.status = 'optimizing';
    const safeTitle = sanitizeFilenameTitle(job.title);
    const finalFileName = `${safeTitle} [${job.id}].mp4`;
    const finalPath = path.join(destDir, finalFileName);

    await ensureDirectPlayMp4(largestFile, finalPath);
    const stats = fs.statSync(finalPath);
    job.sizeBytes = stats.size;
    job.fileName = finalFileName;

    job.status = 'scanning';
    job.plexScanned = await triggerPlexScan(destDir);
    job.status = 'ready';
    job.finishedAt = Date.now();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function handlePlexSaveRequest(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: err.message });
  }

  const rawUrl = String(body.url || '').trim();
  const rawPageUrl = String(body.pageUrl || '').trim();
  const rawOriginalUrl = String(body.originalUrl || '').trim();

  const candidateSet = new Set();
  if (isSpecificWatchPageUrl(rawPageUrl) && /(?:reddit\.com|redgifs\.com)/i.test(rawPageUrl)) {
    candidateSet.add(rawPageUrl);
  }
  if (rawUrl) candidateSet.add(rawUrl);
  if (rawOriginalUrl && /^https?:\/\//i.test(rawOriginalUrl)) candidateSet.add(rawOriginalUrl);
  if (isSpecificWatchPageUrl(rawPageUrl)) candidateSet.add(rawPageUrl);

  const validCandidates = [];
  for (const c of candidateSet) {
    try {
      const safe = await assertSafePublicUrl(c);
      validCandidates.push(safe.href);
    } catch {}
  }

  if (validCandidates.length === 0) {
    return sendJson(res, 400, { ok: false, error: 'No valid public video URL supplied' });
  }

  const isNsfw = Boolean(body.isNsfw);
  const job = {
    id: crypto.randomBytes(4).toString('hex'),
    title: sanitizeFilenameTitle(body.title || 'ReelVault Clip'),
    sourceName: String(body.sourceName || 'ReelVault').slice(0, 80),
    isNsfw,
    library: isNsfw ? 'ReelVault 18+ Vault' : 'ReelVault Clips',
    status: 'queued',
    createdAt: Date.now(),
    finishedAt: null,
    sizeBytes: 0,
    fileName: null,
    plexScanned: false,
    error: null,
    candidates: validCandidates
  };

  recordJob(job);
  jobQueue.push(job);
  pumpJobQueue();

  return sendJson(res, 202, {
    ok: true,
    jobId: job.id,
    library: job.library,
    status: job.status
  });
}

function createBridgeServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      return res.end();
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    } catch {
      return sendJson(res, 400, { ok: false, error: 'Malformed request URI' });
    }

    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
    const providedKey = extractProvidedApiKey(req, parsedUrl);

    if (pathname === '/health' || pathname === '/') {
      if (!providedKey) {
        return sendJson(res, 200, { ok: true, service: 'reelvault-bridge' });
      }
      if (!verifyApiKey(providedKey)) {
        return sendJson(res, 401, { ok: false, error: 'Invalid API Secret Key' });
      }
      const forceRefresh = parsedUrl.searchParams.get('refreshPlex') === '1';
      const plex = await ensurePlexLibraries({ forceRefresh });
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        service: 'reelvault-bridge',
        residentialProxy: Boolean(RESIDENTIAL_PROXY_URL),
        plex,
        activeJobs: activeWorkers + jobQueue.length
      });
    }

    if (!verifyApiKey(providedKey)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized: missing or invalid API Secret Key' });
    }

    if (pathname === '/proxy' && (req.method === 'GET' || req.method === 'HEAD')) {
      return handleProxyRequest(req, res, parsedUrl);
    }

    if (pathname === '/extract' && req.method === 'GET') {
      return handleExtractRequest(res, parsedUrl);
    }

    if (pathname === '/plex/save' && req.method === 'POST') {
      return handlePlexSaveRequest(req, res);
    }

    if (pathname === '/plex/jobs' && req.method === 'GET') {
      const publicJobs = plexJobs.map(({ candidates, ...rest }) => rest);
      return sendJson(res, 200, { ok: true, jobs: publicJobs });
    }

    return sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
  });
}

if (require.main === module) {
  if (!API_KEY) {
    console.error('[reelvault-bridge] FATAL: REELVAULT_API_KEY environment variable is required.');
    process.exit(1);
  }
  fs.mkdirSync(MEDIA_SAFE_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_NSFW_DIR, { recursive: true });

  const server = createBridgeServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[reelvault-bridge] Listening on 0.0.0.0:${PORT} (Residential proxy: ${
        RESIDENTIAL_PROXY_URL ? 'ENABLED' : 'off'
      })`
    );
    setTimeout(() => {
      ensurePlexLibraries({ forceRefresh: true }).catch(() => {});
    }, 8000).unref?.();
  });
}

module.exports = {
  isPrivateOrReservedIp,
  assertSafePublicUrl,
  verifyApiKey,
  extractProvidedApiKey,
  isBinaryMediaRequest,
  shouldPreferResidentialProxyFirst,
  sanitizeFilenameTitle,
  isSpecificWatchPageUrl,
  pickPlayableItemsFromYtDlp,
  isGenericContainerOrVpsName,
  buildDesiredCustomConnections,
  ensurePlexRemoteConnectivity,
  createBridgeServer
};
