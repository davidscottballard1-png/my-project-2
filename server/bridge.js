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

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

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
  /\.(?:mp4|m4v|mov|webm|ogv|ogg|mkv|avi|mpeg|mpg|3gp|3g2|flv|f4v|wmv|ts|m2ts|m4s|aac|mp3|m4a|key)(?:[?#]|$)/i;

const VIDEO_CDN_HOST_REGEX =
  /(?:^|\.)(?:v\.redd\.it|redd\.it|media\.redgifs\.com|thumbs\d*\.redgifs\.com|(?:gvideo|s\d+|v\d+|vid[\w-]*)\.eporner\.com|googlevideo\.com|tiktokcdn[\w-]*\.com|byteoversea\.com|vimeocdn\.com|dmcdn\.net|xhcdn\.com|xv-cdn\.com|sb-cd\.com|phncdn\.com|ypncdn\.com|[\w-]*tnmr\.org|cloudwindow-route\.com|commondatastorage\.googleapis\.com|upload\.wikimedia\.org)$/i;

const IP_BOUND_EMBED_OR_CDN_HOST_REGEX =
  /(?:^|\.)(?:[\w-]*tnmr\.org|luluvid\.com|luluvdo\.com|lulustream\.com|lulust\.com|voe\.sx|hentaisword\.com|susanexpectcare\.com|cloudwindow-route\.com)$/i;

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

function createSsrfError(message) {
  const err = new Error(message);
  err.isSsrfBlock = true;
  return err;
}

async function assertSafePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw createSsrfError('Invalid target URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createSsrfError('Only http:// and https:// URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw createSsrfError('Credentials in target URL are not permitted');
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw createSsrfError('Blocked internal hostname');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw createSsrfError('Blocked private or reserved IP address');
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
      throw createSsrfError('Target resolves to a private or reserved IP address');
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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Api-Key, X-Upstream-Authorization, Range'
  );
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

function buildUpstreamReferer(parsedUrl, rawRefererOverride = '') {
  const cleanOverride = String(rawRefererOverride || '').trim();
  if (cleanOverride && !/[\r\n]/.test(cleanOverride)) {
    try {
      const refParsed = new URL(cleanOverride);
      if (refParsed.protocol === 'http:' || refParsed.protocol === 'https:') {
        return refParsed.href;
      }
    } catch {}
  }
  const host = parsedUrl.hostname.toLowerCase();
  if (host.includes('redgifs.com')) return 'https://www.redgifs.com/';
  if (host.includes('eporner.com')) return 'https://www.eporner.com/';
  if (host.includes('redd.it') || host.includes('reddit.com')) return 'https://www.reddit.com/';
  if (host.includes('spankbang.com') || host.endsWith('sb-cd.com')) return 'https://spankbang.com/';
  if (host.includes('xhamster') || host.endsWith('xhcdn.com')) return 'https://xhamster.com/';
  if (host.includes('xvideos') || host.endsWith('xv-cdn.com')) return 'https://www.xvideos.com/';
  if (host.includes('pornhub.com') || host.endsWith('phncdn.com')) return 'https://www.pornhub.com/';
  if (host.includes('youporn.com') || host.endsWith('ypncdn.com')) return 'https://www.youporn.com/';
  if (host.includes('vimeo.com') || host.endsWith('vimeocdn.com')) return 'https://vimeo.com/';
  if (host.includes('dailymotion.com') || host.endsWith('dmcdn.net')) return 'https://www.dailymotion.com/';
  if (host.includes('tiktok.com') || host.includes('tiktokcdn') || host.endsWith('byteoversea.com')) {
    return 'https://www.tiktok.com/';
  }
  if (host.includes('youtube.com') || host.endsWith('youtu.be') || host.endsWith('googlevideo.com')) {
    return 'https://www.youtube.com/';
  }
  if (host.includes('bilibili.com') || host.endsWith('bilivideo.com')) return 'https://www.bilibili.com/';
  if (
    /(?:^|\.)[\w-]*tnmr\.org$/i.test(host) ||
    host.includes('luluvid.com') ||
    host.includes('luluvdo.com') ||
    host.includes('lulustream.com') ||
    host.includes('lulust.com')
  ) {
    if (host.includes('lulust.com')) return 'https://lulust.com/';
    if (host.includes('luluvdo.com')) return 'https://luluvdo.com/';
    return 'https://luluvid.com/';
  }
  if (
    host.endsWith('cloudwindow-route.com') ||
    host.includes('voe.sx') ||
    host.includes('hentaisword.com') ||
    host.includes('susanexpectcare.com')
  ) {
    return 'https://voe.sx/';
  }
  if (host.includes('fulltaboo.tv')) return 'https://fulltaboo.tv/';
  if (host.includes('pornone.com')) return 'https://pornone.com/';
  return `${parsedUrl.protocol}//${parsedUrl.host}/`;
}

function extractSafeUpstreamAuth(req, parsedTarget) {
  if (!parsedTarget || parsedTarget.hostname.toLowerCase() !== 'api.redgifs.com') {
    return '';
  }
  const raw = String(req?.headers?.['x-upstream-authorization'] || '').trim();
  if (!/^Bearer\s+[A-Za-z0-9._-]+$/i.test(raw)) return '';
  const tokenPart = raw.replace(/^Bearer\s+/i, '').trim();
  if (!tokenPart || verifyApiKey(tokenPart)) return '';
  return `Bearer ${tokenPart}`;
}

function isBinaryMediaRequest(parsedUrl, req) {
  if (!req?.headers?.range && /\.m3u8$/i.test(parsedUrl.pathname)) {
    return false;
  }
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
  const sample = text.slice(0, 2400);
  if (status === 202 && /(?:anomaly-modal|duckduckgo\.com\/anomaly\.js|cc=botnet)/i.test(sample)) {
    return true;
  }
  if (/(?:cf-browser-verification|\/cdn-cgi\/challenge-platform\/)/i.test(sample)) {
    return true;
  }
  return /<title[^>]*>\s*(?:Just a moment\.\.\.|Attention Required!|Access denied|Whoa there,\s*pardner!|Blocked)\s*<\/title>/i.test(
    sample
  );
}

function fetchViaCurlProxy(targetUrl, referer, timeoutSec = 14, upstreamAuth = '') {
  return new Promise((resolve, reject) => {
    const marker = `__RV_META_${crypto.randomBytes(6).toString('hex')}__`;
    const args = [
      '-sS',
      '-L',
      '--proto',
      '=http,https',
      '--proto-redir',
      '=http,https',
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
      referer
    ];
    if (upstreamAuth) {
      args.push('-H', `Authorization: ${upstreamAuth}`);
    }
    args.push(
      '--config',
      '-',
      '-w',
      `\n${marker}%{http_code}|%{content_type}`,
      targetUrl
    );

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
      if (idx < 0) {
        if (code !== 0) {
          return reject(new Error(errText.trim() || `curl exited with code ${code}`));
        }
        return resolve({ status: 200, contentType: 'text/plain; charset=utf-8', body: full });
      }
      const body = full.subarray(0, idx);
      const meta = full.subarray(idx + markerBuf.length).toString('utf8').trim();
      const [codeStr, ct] = meta.split('|');
      const statusNum = Number(codeStr);
      if (code !== 0 || !Number.isFinite(statusNum) || statusNum < 100) {
        return reject(
          new Error(errText.trim() || `curl proxy request failed (exit ${code}, http ${codeStr || '000'})`)
        );
      }
      resolve({
        status: statusNum,
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
    try {
      Object.defineProperty(res, '_finalUrl', { value: parsed.href, configurable: true });
    } catch {}
    return res;
  }
  throw new Error('Too many upstream redirects');
}

function getPublicProxyOrigin(req) {
  const fwdProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = fwdProto === 'https' || fwdProto === 'http' ? fwdProto : 'http';
  const rawHost = String(
    req?.headers?.['x-forwarded-host'] || req?.headers?.host || `127.0.0.1:${PORT}`
  )
    .split(',')[0]
    .trim();
  const safeHost = rawHost.replace(/[^a-zA-Z0-9.:[\]-]/g, '') || `127.0.0.1:${PORT}`;
  return `${proto}://${safeHost}`;
}

function rewriteM3u8ManifestForProxy(
  manifestText,
  baseManifestUrl,
  proxyEndpointBase,
  apiKey,
  refererUrl = ''
) {
  if (typeof manifestText !== 'string' || !manifestText.trim()) return manifestText;
  const cleanOrigin = String(proxyEndpointBase || '').replace(/\/+$/, '');
  const cleanReferer = String(refererUrl || '').trim();

  const wrapResolvedUri = (rawUri, hintIsPlaylist = false) => {
    const trimmed = String(rawUri || '').trim();
    if (!trimmed || /^(?:data|blob|skd):/i.test(trimmed)) return rawUri;
    let absUrl;
    try {
      absUrl = new URL(trimmed, baseManifestUrl).href;
    } catch {
      return rawUri;
    }
    if (!/^https?:\/\//i.test(absUrl)) return rawUri;
    // Prevent accidental double-wrapping if already pointing at this /proxy
    if (cleanOrigin && absUrl.startsWith(`${cleanOrigin}/proxy?`)) {
      return absUrl;
    }
    const isChildPlaylist =
      Boolean(hintIsPlaylist) || /\.m3u8(?:[?#]|$)/i.test(absUrl);
    let built = `${cleanOrigin}/proxy?`;
    if (apiKey) {
      built += `key=${encodeURIComponent(apiKey)}&`;
    }
    built += `url=${encodeURIComponent(absUrl)}`;
    if (cleanReferer && /^https?:\/\//i.test(cleanReferer)) {
      built += `&referer=${encodeURIComponent(cleanReferer)}`;
    }
    if (isChildPlaylist) {
      built += '&hls=1';
    }
    return built;
  };

  const lines = manifestText.split(/\r?\n/);
  let prevTagWasStreamInf = false;

  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      const isStreamInf = /^#EXT-X-STREAM-INF\b/i.test(trimmed);
      const isPlaylistTag = /^#EXT-X-(?:MEDIA|I-FRAME-STREAM-INF)\b/i.test(trimmed);
      prevTagWasStreamInf = isStreamInf;

      if (/\bURI=(["'])([^"']+)\1/i.test(line)) {
        return line.replace(/\bURI=(["'])([^"']+)\1/gi, (_match, quote, innerUri) => {
          const wrapped = wrapResolvedUri(innerUri, isPlaylistTag);
          return `URI=${quote}${wrapped}${quote}`;
        });
      }
      return line;
    }

    const asPlaylist = prevTagWasStreamInf;
    prevTagWasStreamInf = false;
    return wrapResolvedUri(trimmed, asPlaylist);
  });

  return rewritten.join('\n');
}

function maybeSendTextOrRewrittenHls(
  req,
  res,
  statusCode,
  contentType,
  bodyBuf,
  cacheControl,
  hlsCtx
) {
  if (
    hlsCtx?.enabled &&
    statusCode >= 200 &&
    statusCode < 300 &&
    bodyBuf &&
    bodyBuf.length > 0
  ) {
    const text = bodyBuf.toString('utf8');
    if (/^\s*#EXTM3U\b/i.test(text)) {
      const rewrittenText = rewriteM3u8ManifestForProxy(
        text,
        hlsCtx.baseManifestUrl,
        hlsCtx.proxyOrigin,
        hlsCtx.apiKey,
        hlsCtx.referer
      );
      const outBuf = Buffer.from(rewrittenText, 'utf8');
      setCorsHeaders(res);
      res.writeHead(statusCode, {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': outBuf.length
      });
      return res.end(outBuf);
    }
  }

  setCorsHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'Content-Length': bodyBuf.length
  });
  return res.end(bodyBuf);
}

async function handleProxyRequest(req, res, parsedReqUrl) {
  const rawTarget = parsedReqUrl.searchParams.get('url') || '';
  let parsedTarget;
  try {
    parsedTarget = await assertSafePublicUrl(rawTarget);
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: err.message });
  }

  const referer = buildUpstreamReferer(
    parsedTarget,
    parsedReqUrl.searchParams.get('referer') || ''
  );
  const upstreamAuth = extractSafeUpstreamAuth(req, parsedTarget);
  const wantsHlsRewrite = parsedReqUrl.searchParams.get('hls') === '1';
  const isMedia = wantsHlsRewrite ? false : isBinaryMediaRequest(parsedTarget, req);
  const hlsCtx = wantsHlsRewrite
    ? {
        enabled: true,
        baseManifestUrl: parsedTarget.href,
        proxyOrigin: getPublicProxyOrigin(req),
        apiKey: extractProvidedApiKey(req, parsedReqUrl),
        referer
      }
    : null;

  // 1. Metadata / JSON / HTML / M3U8 path (uses Webshare Residential Proxy selectively without wasting GBs on video bytes)
  if (!isMedia && req.method === 'GET') {
    const preferProxy = shouldPreferResidentialProxyFirst(parsedTarget);

    if (preferProxy) {
      try {
        const proxied = await fetchViaCurlProxy(parsedTarget.href, referer, 14, upstreamAuth);
        if (proxied.status >= 200 && proxied.status < 400 && proxied.body.length > 0) {
          return maybeSendTextOrRewrittenHls(
            req,
            res,
            proxied.status,
            proxied.contentType,
            proxied.body,
            'public, max-age=45',
            hlsCtx
          );
        }
      } catch {
        // Fall through to direct attempt
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const abortOnPrematureClose = () => {
      if (!res.writableFinished) {
        try {
          controller.abort();
        } catch {}
      }
    };
    res.once('close', abortOnPrematureClose);
    try {
      const metaHeaders = {
        'User-Agent': BROWSER_UA,
        Accept:
          'application/json,text/html,application/xhtml+xml,application/vnd.apple.mpegurl,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: referer
      };
      if (upstreamAuth) {
        metaHeaders.Authorization = upstreamAuth;
      }
      const upstream = await fetchSafeWithRedirects(parsedTarget.href, {
        method: 'GET',
        signal: controller.signal,
        headers: metaHeaders
      });
      clearTimeout(timer);

      const ct = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
      if (/^(?:video|audio)\//i.test(ct) && !wantsHlsRewrite) {
        res.off('close', abortOnPrematureClose);
        return pipeUpstreamStream(req, res, upstream, controller);
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.off('close', abortOnPrematureClose);
      const sampleText = buf.subarray(0, 2400).toString('utf8');
      if (hlsCtx && upstream._finalUrl) {
        hlsCtx.baseManifestUrl = upstream._finalUrl;
      }

      const isIpBoundTarget = IP_BOUND_EMBED_OR_CDN_HOST_REGEX.test(parsedTarget.hostname);
      if (
        RESIDENTIAL_PROXY_URL &&
        !preferProxy &&
        !isIpBoundTarget &&
        isBlockedTextPayload(upstream.status, sampleText)
      ) {
        try {
          const rescued = await fetchViaCurlProxy(parsedTarget.href, referer, 14, upstreamAuth);
          if (rescued.status >= 200 && rescued.status < 400 && rescued.body.length > 0) {
            return maybeSendTextOrRewrittenHls(
              req,
              res,
              rescued.status,
              rescued.contentType,
              rescued.body,
              'public, max-age=45',
              hlsCtx
            );
          }
        } catch {
          // Return original response below
        }
      }

      return maybeSendTextOrRewrittenHls(
        req,
        res,
        upstream.status,
        ct,
        buf,
        upstream.ok ? 'public, max-age=45' : 'no-store',
        hlsCtx
      );
    } catch (err) {
      clearTimeout(timer);
      res.off('close', abortOnPrematureClose);
      if (err?.isSsrfBlock) {
        return sendJson(res, 400, { ok: false, error: err.message });
      }
      if (
        RESIDENTIAL_PROXY_URL &&
        !preferProxy &&
        !IP_BOUND_EMBED_OR_CDN_HOST_REGEX.test(parsedTarget.hostname) &&
        !res.destroyed
      ) {
        try {
          const rescued = await fetchViaCurlProxy(parsedTarget.href, referer, 14, upstreamAuth);
          return maybeSendTextOrRewrittenHls(
            req,
            res,
            rescued.status,
            rescued.contentType,
            rescued.body,
            'no-store',
            hlsCtx
          );
        } catch {}
      }
      if (!res.headersSent && !res.destroyed) {
        return sendJson(res, 502, { ok: false, error: err.message || 'Upstream fetch failed' });
      }
      return;
    }
  }

  // 2. Direct Unmetered Contabo Fiber Video Streaming (supports Range / 206 Partial Content for iOS Safari <video>)
  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), 18000);
  const abortMediaOnClose = () => {
    if (!res.writableFinished) {
      try {
        controller.abort();
      } catch {}
    }
  };
  res.once('close', abortMediaOnClose);

  try {
    const headers = {
      'User-Agent': BROWSER_UA,
      Accept: req.headers.accept || '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
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
    res.off('close', abortMediaOnClose);
    return pipeUpstreamStream(req, res, upstream, controller);
  } catch (err) {
    clearTimeout(connectTimer);
    res.off('close', abortMediaOnClose);
    if (!res.headersSent && !res.destroyed) {
      const code = err?.isSsrfBlock ? 400 : 502;
      return sendJson(res, code, { ok: false, error: err.message || 'Upstream stream error' });
    }
    res.destroy();
  }
}

function pipeUpstreamStream(req, res, upstream, controller = null) {
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
  res.once('close', () => {
    if (!res.writableFinished) {
      try {
        controller?.abort();
      } catch {}
      try {
        nodeStream.destroy();
      } catch {}
    }
  });
  nodeStream.on('error', () => {
    if (!res.writableEnded) res.destroy();
  });
  nodeStream.pipe(res);
}

// ==========================================
// YT-DLP METADATA EXTRACTOR (/extract) & PUBLIC WEB / STRICT 18+ SEARCH (/search)
// ==========================================

const MAINSTREAM_SFW_HOST_REGEX =
  /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com|googlevideo\.com|tiktok\.com|tiktokcdn[\w-]*\.com|byteoversea\.com|vimeo\.com|vimeocdn\.com|dailymotion\.com|dai\.ly|dmcdn\.net|twitch\.tv|jtvnw\.net|bilibili\.com|bilivideo\.com|wikimedia\.org|wikipedia\.org|archive\.org|nasa\.gov|pbs\.org|ted\.com|khanacademy\.org|bbc\.(?:com|co\.uk)|cnn\.com|nytimes\.com|reuters\.com|apnews\.com|espn\.com|spotify\.com|soundcloud\.com|apple\.com|microsoft\.com|github\.com|gitlab\.com|linkedin\.com|pinterest\.com|facebook\.com|fb\.watch|instagram\.com|netflix\.com|hulu\.com|disneyplus\.com|amazon\.com)$/i;

const KNOWN_ADULT_HOST_REGEX =
  /(?:^|\.)(?:redgifs\.com|eporner\.com|spankbang\.com|xvideos\d*\.com|xv-cdn\.com|xnxx\d*\.com|xhamster\d*\.(?:com|desi|one|live)|xhcdn\.com|pornhub\.com|phncdn\.com|youporn\.com|ypncdn\.com|tube8\.com|tnaflix\.com|txxx\.com|porntrex\.com|pornone\.com|fulltaboo\.tv|motherless\.com|erome\.com|beeg\.com|thumbzilla\.com|drtuber\.com|sunporno\.com|upornia\.com|hclips\.com|vjav\.com|rule34video\.com|iwara\.tv|heavy-r\.com|anysex\.com|4tube\.com|fux\.com|porndig\.com|gotporn\.com|empflix\.com|nuvid\.com|zbporn\.com|pornhd\.com|fuq\.com|pornhat\.com|ok\.xxx|trendyporn\.com|veporn\.com|sxyprn\.com|hqporner\.com|fapello\.com|sb-cd\.com|bunkr\.[a-z]+)$/i;

const ADULT_HOST_TOKEN_REGEX =
  /(?:^|[.-])(?:porn\w*|xxx\w*|xvideos\w*|xhamster\w*|redgifs|spankbang|youporn|hentai\w*|nsfw\w*|rule34\w*|fap\w*|taboo\w*|erotic\w*|chaturbate|stripchat|cam4|bongacams)(?:[.-]|$)/i;

const ADULT_CONTENT_SIGNAL_REGEX =
  /(?:RTA-5042-1996-1400-1577-RTA|<meta[^>]+name=["']rating["'][^>]+content=["'](?:adult|mature|RTA-[^"']+)["']|\b(?:porn|porno|xxx|nsfw|18\+|hardcore|hentai|milf|blowjob|handjob|creampie|cumshot|anal|lesbian|threesome|orgasm|masturbat\w*|stripper|nude|naked|boobs|tits|pussy|cock|dick|bdsm|fetish|sex\s+video|sex\s+tape)\b)/i;

const SEARCH_IGNORE_HOST_REGEX =
  /(?:^|\.)(?:duckduckgo\.com|google\.com|bing\.com|yahoo\.com|yandex\.[a-z]+|doubleclick\.net|googlesyndication\.com|exoclick\.com|juicyads\.com|trafficjunky\.net)$/i;

function getHostnameClean(rawUrl) {
  try {
    return new URL(String(rawUrl || '').trim()).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function isIpBoundStreamUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  return /(?:googlevideo\.com|tiktokcdn|byteoversea\.com|bilivideo\.com|eporner\.com|[\w-]*tnmr\.org|cloudwindow-route\.com|luluvid\.com|luluvdo\.com|lulustream\.com|lulust\.com|voe\.sx|hentaisword\.com|susanexpectcare\.com|[?&]ip=\d+\.\d+\.\d+\.\d+)/i.test(
    rawUrl
  );
}

function isMainstreamSfwHost(rawHostOrUrl) {
  const host = rawHostOrUrl.includes('://') ? getHostnameClean(rawHostOrUrl) : String(rawHostOrUrl || '').replace(/^www\./i, '').toLowerCase();
  if (!host) return false;
  return MAINSTREAM_SFW_HOST_REGEX.test(host);
}

function isKnownAdultHost(rawHostOrUrl) {
  const host = rawHostOrUrl.includes('://') ? getHostnameClean(rawHostOrUrl) : String(rawHostOrUrl || '').replace(/^www\./i, '').toLowerCase();
  if (!host || isMainstreamSfwHost(host)) return false;
  return KNOWN_ADULT_HOST_REGEX.test(host) || ADULT_HOST_TOKEN_REGEX.test(host);
}

function hasAdultContentSignals(text) {
  if (!text || typeof text !== 'string') return false;
  return ADULT_CONTENT_SIGNAL_REGEX.test(text);
}

function isVerifiedStrictAdultItem(item, htmlSample = '') {
  if (!item || typeof item !== 'object' || !item.videoUrl) return false;
  const pageHost = getHostnameClean(item.pageUrl || item.originalUrl || '');
  const videoHost = getHostnameClean(item.videoUrl || '');
  if (isMainstreamSfwHost(pageHost) || isMainstreamSfwHost(videoHost)) {
    return false;
  }
  if (isKnownAdultHost(pageHost) || isKnownAdultHost(videoHost)) {
    return true;
  }
  if (Number(item.ageLimit) >= 18) {
    return true;
  }
  const metaHay = `${item.title || ''} ${Array.isArray(item.tags) ? item.tags.join(' ') : ''} ${item.pageUrl || ''}`;
  if (hasAdultContentSignals(metaHay) || hasAdultContentSignals(String(htmlSample || '').slice(0, 12000))) {
    return true;
  }
  return false;
}

function isVerifiedSafePublicItem(item, htmlSample = '') {
  if (!item || typeof item !== 'object' || !item.videoUrl) return false;
  if (item.isNsfw || Number(item.ageLimit) >= 18) return false;
  const pageHost = getHostnameClean(item.pageUrl || item.originalUrl || '');
  const videoHost = getHostnameClean(item.videoUrl || '');
  if (isKnownAdultHost(pageHost) || isKnownAdultHost(videoHost)) {
    return false;
  }
  const metaHay = `${item.title || ''} ${Array.isArray(item.tags) ? item.tags.join(' ') : ''} ${item.pageUrl || ''}`;
  if (hasAdultContentSignals(metaHay)) {
    return false;
  }
  if (/<meta[^>]+name=["']rating["'][^>]+content=["'](?:adult|mature|RTA-[^"']+)["']/i.test(String(htmlSample || '').slice(0, 8000))) {
    return false;
  }
  return true;
}

function runYtDlpJson(targetUrl, useResidentialProxy = false, timeoutMs = 28000) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--socket-timeout',
      '14',
      '--user-agent',
      BROWSER_UA
    ];
    if (useResidentialProxy && RESIDENTIAL_PROXY_URL) {
      args.push('--proxy', RESIDENTIAL_PROXY_URL);
    }
    args.push('--', targetUrl);

    execFile('yt-dlp', args, { maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs }, (err, stdout, stderr) => {
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

function runYtDlpSearchJson(query, count = 4, timeoutMs = 15000) {
  const safeCount = Math.max(1, Math.min(6, Number(count) || 4));
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--ignore-errors',
      '--socket-timeout',
      '10',
      '--match-filter',
      '!is_live',
      '--user-agent',
      BROWSER_UA,
      '--',
      `ytsearch${safeCount}:${query}`
    ];
    execFile('yt-dlp', args, { maxBuffer: 25 * 1024 * 1024, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (!stdout && err) {
        return reject(new Error((stderr || err.message || 'yt-dlp search failed').slice(0, 400)));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Invalid JSON from yt-dlp search'));
      }
    });
  });
}

function pickPlayableItemsFromYtDlp(info, fallbackPageUrl) {
  if (!info || typeof info !== 'object') return [];
  const entries = Array.isArray(info.entries) && info.entries.length > 0 ? info.entries.slice(0, 8) : [info];
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
    const pageUrl = entry.webpage_url || entry.original_url || fallbackPageUrl;
    const ageLimit = Number(entry.age_limit) || 0;

    items.push({
      id: `cloud-${entry.id || Date.now()}`,
      title: entry.title || info.title || 'Extracted Video',
      videoUrl: best.url,
      originalUrl: pageUrl,
      convertedUrl: progressiveMp4[1]?.url || null,
      format: ext,
      duration: Number(entry.duration) || 0,
      isHd: (Number(best.height) || 0) >= 720,
      ageLimit,
      proxyRequired: isIpBoundStreamUrl(best.url),
      ...(ageLimit >= 18 || isKnownAdultHost(pageUrl || '') ? { isNsfw: true } : {}),
      tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 6) : [],
      author: entry.uploader || entry.channel || null,
      sourceName: entry.extractor_key ? `${entry.extractor_key} (Cloud)` : 'Cloud Extractor',
      pageUrl
    });
  }

  return items;
}

async function fetchTextWithProxyFallback(targetUrl, timeoutMs = 9000) {
  const parsed = await assertSafePublicUrl(targetUrl);
  const referer = buildUpstreamReferer(parsed);
  const preferProxy = shouldPreferResidentialProxyFirst(parsed);

  if (preferProxy && RESIDENTIAL_PROXY_URL) {
    try {
      const proxied = await fetchViaCurlProxy(parsed.href, referer, Math.ceil(timeoutMs / 1000));
      if (proxied.status >= 200 && proxied.status < 400 && proxied.body.length > 0) {
        return proxied.body.toString('utf8');
      }
    } catch {}
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const res = await fetchSafeWithRedirects(parsed.href, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: referer
      }
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.toString('utf8');
    if (RESIDENTIAL_PROXY_URL && !preferProxy && isBlockedTextPayload(res.status, text)) {
      try {
        const rescued = await fetchViaCurlProxy(parsed.href, referer, Math.ceil(timeoutMs / 1000));
        if (rescued.status >= 200 && rescued.status < 400 && rescued.body.length > 0) {
          return rescued.body.toString('utf8');
        }
      } catch {}
    }
    return res.ok ? text : '';
  } catch (err) {
    if (!err?.isSsrfBlock && RESIDENTIAL_PROXY_URL && !preferProxy) {
      try {
        const rescued = await fetchViaCurlProxy(parsed.href, referer, Math.ceil(timeoutMs / 1000));
        if (rescued.status >= 200 && rescued.status < 400 && rescued.body.length > 0) {
          return rescued.body.toString('utf8');
        }
      } catch {}
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function unpackDeanEdwardsPackerServer(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.includes('eval(function(p,a,c,k,e,')) {
    return '';
  }
  const encodeToken = (num, radix) => {
    if (radix <= 36) return num.toString(radix);
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let out = '';
    let n = num;
    do {
      out = chars[n % radix] + out;
      n = Math.floor(n / radix);
    } while (n > 0);
    return out;
  };
  const results = [];
  const packerRegex =
    /eval\(function\(p,a,c,k,e,(?:d|r)\)\{[\s\S]*?\}\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])((?:\\.|(?!\5)[\s\S])*)\5\.split\(['"]\|['"]\)/g;
  let m;
  let blocks = 0;
  while ((m = packerRegex.exec(rawText)) !== null && blocks < 4) {
    blocks++;
    const radix = Number(m[3]);
    const count = Number(m[4]);
    if (!Number.isFinite(radix) || radix < 2 || radix > 62 || !Number.isFinite(count) || count <= 0 || count > 10000) {
      continue;
    }
    const payload = m[2].replace(/\\(['"\\])/g, '$1');
    const symtab = m[6].replace(/\\(['"\\])/g, '$1').split('|');
    const dict = new Map();
    for (let i = Math.min(count, symtab.length) - 1; i >= 0; i--) {
      if (symtab[i]) dict.set(encodeToken(i, radix), symtab[i]);
    }
    results.push(payload.replace(/\b[0-9a-zA-Z]+\b/g, (tok) => (dict.has(tok) ? dict.get(tok) : tok)));
  }
  return results.join('\n');
}

function decodeVoeStreamsServer(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const urls = [];
  const jsonScriptRegex =
    /<script[^>]+type=["']application\/json["'][^>]*>\s*\[\s*"([^"]{24,})"\s*\]\s*<\/script>/gi;
  let m;
  let count = 0;
  while ((m = jsonScriptRegex.exec(rawText)) !== null && count < 4) {
    count++;
    try {
      const rot = m[1].replace(/[a-zA-Z]/g, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      });
      const stripped = rot.replace(/@\$|\^\^|~@|%\?|\*~|!!|#&/g, '');
      const step3 = Buffer.from(stripped, 'base64').toString('utf8');
      if (!step3) continue;
      let shifted = '';
      for (let i = 0; i < step3.length; i++) {
        shifted += String.fromCharCode(step3.charCodeAt(i) - 3);
      }
      const step5 = Buffer.from(shifted.split('').reverse().join(''), 'base64').toString('utf8');
      const parsed = JSON.parse(step5);
      for (const c of [parsed?.source, parsed?.direct_access_url, parsed?.hls, parsed?.mp4]) {
        if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) {
          urls.push(c.trim());
        }
      }
    } catch {}
  }
  return urls;
}

function extractDirectStreamsFromHtmlServer(rawHtml, baseUrl) {
  if (!rawHtml || typeof rawHtml !== 'string') return [];
  const unpacked = unpackDeanEdwardsPackerServer(rawHtml);
  const combined = unpacked ? `${rawHtml}\n${unpacked}` : rawHtml;
  const normalized = combined
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  const found = [];
  const seen = new Set();
  const addUrl = (raw) => {
    if (!raw || typeof raw !== 'string') return;
    const clean = raw.trim().replace(/^['"]+|['"]+$/g, '');
    if (!clean) return;
    try {
      const abs = new URL(clean, baseUrl).href;
      if (!/^https?:\/\//i.test(abs) || seen.has(abs)) return;
      if (
        /(?:test-videos\.co\.uk|Big_Buck_Bunny_\d+_\d+s|preview|trailer|thumb|sprite|banner|preroll|adserver|exoclick|trafficjunky|juicyads|pemsrv|magsrv|tsyndicate)/i.test(
          abs
        )
      ) {
        return;
      }
      if (/\.(?:mp4|m4v|mov|webm|m3u8)(?:[?#]|$)/i.test(abs)) {
        seen.add(abs);
        found.push(abs);
      }
    } catch {}
  };

  for (const vUrl of decodeVoeStreamsServer(rawHtml)) {
    addUrl(vUrl);
  }

  // Explicit tube player setters (XVideos / XNXX / SpankBang / HTML5 sources / og:video)
  const playerSetterRegex =
    /(?:setVideoUrlHigh|setVideoUrlLow|setVideoHLS|video_url|contentUrl|quality_(?:1080|720|480)p|mp4_url|hls_url)\s*(?:\(|:|=)\s*["'](https?:\/\/[^"'\s<>]+)["']/gi;
  let m;
  while ((m = playerSetterRegex.exec(normalized)) !== null) {
    addUrl(m[1]);
  }

  const fullUrlRegex = /https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m4v|mov|webm|m3u8)(?:\?[^\s"'<>\\]*)?/gi;
  while ((m = fullUrlRegex.exec(normalized)) !== null && found.length < 12) {
    addUrl(m[0]);
  }

  const mp4s = found.filter((u) => /\.mp4(?:[?#]|$)/i.test(u));
  const others = found.filter((u) => !/\.mp4(?:[?#]|$)/i.test(u));
  return [...mp4s, ...others];
}

function extractSearchCandidatesFromHtmlServer(rawHtml, isStrictNsfw = false) {
  if (!rawHtml || typeof rawHtml !== 'string') return [];
  const found = [];
  const seen = new Set();

  const consider = (raw) => {
    const clean = String(raw || '').replace(/&amp;/g, '&').trim();
    if (!clean || seen.has(clean)) return;
    try {
      const parsed = new URL(clean);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      if (!host || SEARCH_IGNORE_HOST_REGEX.test(host)) return;
      if (/\.(?:css|js|png|jpe?g|svg|ico|woff2?|ttf|xml|json|pdf)(?:[?#]|$)/i.test(parsed.pathname)) {
        return;
      }
      if (/(?:facebook\.com|instagram\.com|linkedin\.com|pinterest\.com|netflix\.com|hulu\.com|amazon\.com)/i.test(host)) {
        return;
      }
      // Strict mode enforcement: 18+ mode NEVER accepts mainstream SFW sites; Safe mode NEVER accepts adult hosts
      if (isStrictNsfw) {
        if (isMainstreamSfwHost(host)) return;
      } else {
        if (isKnownAdultHost(host)) return;
      }
      seen.add(parsed.href);
      found.push(parsed.href);
    } catch {}
  };

  const uddgRegex = /[?&]uddg=([^&"'>\s]+)/gi;
  let m;
  while ((m = uddgRegex.exec(rawHtml)) !== null) {
    try {
      consider(decodeURIComponent(m[1]));
    } catch {}
  }

  const hrefRegex = /href=["'](https?:\/\/[^"'<>#\s]+)["']/gi;
  while ((m = hrefRegex.exec(rawHtml)) !== null) {
    consider(m[1]);
  }

  if (isStrictNsfw) {
    const adultPriority = found.filter(
      (u) =>
        isKnownAdultHost(u) &&
        /(?:\/video|\/watch|\/videos\/|\/v\/|\/gifs\/|viewkey=|-\w+\/?$)/i.test(u)
    );
    const otherAdult = found.filter((u) => !adultPriority.includes(u) && isKnownAdultHost(u));
    const openAdult = found.filter((u) => !adultPriority.includes(u) && !otherAdult.includes(u));
    return [...adultPriority, ...otherAdult, ...openAdult];
  }

  const watchPriority = found.filter(
    (u) =>
      /\.(?:mp4|webm|mov|m3u8)(?:[?#]|$)/i.test(u) ||
      /(?:\/video|\/watch|\/shorts\/|\/videos\/|\/v\/|vimeo\.com\/\d+|dailymotion\.com\/video\/|streamable\.com\/|tiktok\.com\/@[^/]+\/video\/|youtu\.be\/)/i.test(
        u
      )
  );
  const rest = found.filter((u) => !watchPriority.includes(u));
  return [...watchPriority, ...rest];
}

async function discoverDirectAdultTubeWatchUrls(query, fetchTextFn) {
  const cleanKw = String(query || '').trim();
  if (!cleanKw) return [];

  const sources = [
    {
      searchUrl: `https://www.xvideos.com/?k=${encodeURIComponent(cleanKw)}`,
      base: 'https://www.xvideos.com',
      linkRegex: /href=["'](\/video[.\w-]+\/[^"'?#\s<>]+)["']/gi
    },
    {
      searchUrl: `https://xhamster.com/search/${encodeURIComponent(cleanKw)}`,
      base: 'https://xhamster.com',
      linkRegex: /href=["'](https?:\/\/[^"'?#\s<>]*xhamster[^"'?#\s<>]*\/videos\/[^"'?#\s<>]+|\/videos\/[^"'?#\s<>]+)["']/gi
    },
    {
      searchUrl: `https://spankbang.com/s/${encodeURIComponent(cleanKw)}/`,
      base: 'https://spankbang.com',
      linkRegex: /href=["'](\/[a-z0-9]{4,}\/video\/[^"'?#\s<>]+)["']/gi
    }
  ];

  const buckets = await Promise.all(
    sources.map(async (src) => {
      const links = [];
      const seen = new Set();
      try {
        const html = await fetchTextFn(src.searchUrl, 7500);
        if (!html) return links;
        let m;
        while ((m = src.linkRegex.exec(html)) !== null && links.length < 3) {
          try {
            const abs = new URL(m[1], src.base).href;
            if (!seen.has(abs)) {
              seen.add(abs);
              links.push(abs);
            }
          } catch {}
        }
      } catch {}
      return links;
    })
  );

  // Interleave across adult networks so results aren't dominated by a single site
  const interleaved = [];
  for (let i = 0; i < 3; i++) {
    for (const b of buckets) {
      if (b[i] && !interleaved.includes(b[i])) {
        interleaved.push(b[i]);
      }
    }
  }
  return interleaved;
}

function selectDiverseUrlsByHost(urls, maxTotal = 5, maxPerHost = 2) {
  const chosen = [];
  const counts = new Map();
  for (const u of urls) {
    if (chosen.length >= maxTotal) break;
    const h = getHostnameClean(u);
    if (!h) continue;
    const prev = counts.get(h) || 0;
    if (prev >= maxPerHost) continue;
    counts.set(h, prev + 1);
    chosen.push(u);
  }
  return chosen;
}

function safeDecodeUriComponent(rawStr) {
  const s = String(rawStr || '');
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const cloudSearchCache = new Map();
const CLOUD_SEARCH_CACHE_TTL_MS = 180_000;

async function executeCloudKeywordSearch(rawQuery, opts = {}, deps = {}) {
  const cleanQuery = String(rawQuery || '').trim();
  if (!cleanQuery) return [];

  const isStrictNsfw = Boolean(opts.isNsfw);
  const limit = Math.max(1, Math.min(12, Number(opts.limit) || 6));
  const useCache =
    Boolean(opts.forceCache) ||
    (!deps.fetchText && !deps.runYtDlpUrl && !deps.runYtDlpSearch && !deps.assertSafeUrl);
  const cacheKey = `${isStrictNsfw ? '18' : 'sfw'}:${cleanQuery.toLowerCase()}`;

  if (useCache) {
    const hit = cloudSearchCache.get(cacheKey);
    if (
      hit &&
      Date.now() - hit.timestamp < CLOUD_SEARCH_CACHE_TTL_MS &&
      (hit.items.length >= limit || (hit.fetchedLimit || 0) >= limit)
    ) {
      return hit.items.slice(0, limit);
    }
  }

  const assertSafeUrlFn = deps.assertSafeUrl || assertSafePublicUrl;
  const fetchTextFn = deps.fetchText || fetchTextWithProxyFallback;
  const runYtDlpUrlFn =
    deps.runYtDlpUrl ||
    (async (url) => {
      const parsed = await assertSafeUrlFn(url);
      const preferProxy = shouldPreferResidentialProxyFirst(parsed);
      try {
        return await runYtDlpJson(parsed.href, preferProxy, 14000);
      } catch (e1) {
        if (RESIDENTIAL_PROXY_URL && !preferProxy) {
          return await runYtDlpJson(parsed.href, true, 16000);
        }
        throw e1;
      }
    });
  const runYtDlpSearchFn = deps.runYtDlpSearch || ((q, n) => runYtDlpSearchJson(q, n, 15000));

  const extractCandidatePage = async (candidateUrl) => {
    const parsed = await assertSafeUrlFn(candidateUrl);
    const host = getHostnameClean(parsed.href);
    const sourceLabel = `${host} (Cloud)`;

    // 1. Direct media file link
    if (/\.(?:mp4|m4v|mov|webm|m3u8)(?:[?#]|$)/i.test(parsed.pathname)) {
      const extMatch = parsed.pathname.match(/\.(mp4|m4v|mov|webm|m3u8)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
      const item = {
        id: `cloud-direct-${crypto.randomBytes(4).toString('hex')}`,
        title: safeDecodeUriComponent(parsed.pathname.split('/').pop() || 'Web Video') || 'Web Video',
        videoUrl: parsed.href,
        originalUrl: parsed.href,
        convertedUrl: null,
        format: ext,
        duration: 0,
        isHd: /720|1080|hd/i.test(parsed.href),
        ageLimit: isKnownAdultHost(host) ? 18 : 0,
        proxyRequired: false,
        ...(isStrictNsfw || isKnownAdultHost(host) ? { isNsfw: true } : {}),
        tags: [],
        sourceName: sourceLabel,
        pageUrl: parsed.href
      };
      return isStrictNsfw
        ? isVerifiedStrictAdultItem(item) ? [item] : []
        : isVerifiedSafePublicItem(item) ? [item] : [];
    }

    // 2. Fetch page HTML first for fast stream extraction + RTA/title metadata check
    let html = '';
    if (!/(?:youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)/i.test(host)) {
      html = await fetchTextFn(parsed.href, 7500).catch(() => '');
      if (html) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const pageTitle = titleMatch?.[1]?.replace(/\s+/g, ' ')?.trim() || `${host} Video`;
        const streams = extractDirectStreamsFromHtmlServer(html, parsed.href);
        if (streams.length > 0) {
          const primary = streams[0];
          const isM3u8 = /\.m3u8(?:[?#]|$)/i.test(primary);
          const item = {
            id: `cloud-web-${crypto.randomBytes(4).toString('hex')}`,
            title: pageTitle,
            videoUrl: primary,
            originalUrl: parsed.href,
            convertedUrl: streams[1] || null,
            format: isM3u8 ? 'm3u8' : 'mp4',
            duration: 0,
            isHd: /720|1080|hd|high/i.test(primary),
            ageLimit: isKnownAdultHost(host) ? 18 : 0,
            proxyRequired: isIpBoundStreamUrl(primary),
            ...(isStrictNsfw ? { isNsfw: true } : {}),
            tags: [],
            sourceName: sourceLabel,
            pageUrl: parsed.href
          };
          if (isStrictNsfw ? isVerifiedStrictAdultItem(item, html) : isVerifiedSafePublicItem(item, html)) {
            return [item];
          }
          return [];
        }
      }
    }

    // 3. Deep yt-dlp extractor fallback (supports 1,800+ video & adult tube sites)
    try {
      const info = await runYtDlpUrlFn(parsed.href);
      const picked = pickPlayableItemsFromYtDlp(info, parsed.href);
      return picked
        .filter((it) => (isStrictNsfw ? isVerifiedStrictAdultItem(it, html) : isVerifiedSafePublicItem(it, html)))
        .map((it) => (isStrictNsfw ? { ...it, isNsfw: true } : it))
        .slice(0, 2);
    } catch {
      return [];
    }
  };

  const collected = [];
  const seenStreams = new Set();
  const pushUnique = (list) => {
    for (const item of list) {
      if (item?.videoUrl && !seenStreams.has(item.videoUrl)) {
        seenStreams.add(item.videoUrl);
        collected.push(item);
      }
    }
  };

  if (isStrictNsfw) {
    // STRICT 18+ PUBLIC WEB MODE: DuckDuckGo kp=-2 adult web + Direct Multi-Tube 18+ Discovery (zero SFW/YouTube)
    const ddgAdultUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      `${cleanQuery} (porn OR xxx OR nsfw) video`
    )}&kp=-2`;

    const [ddgHtml, directTubeLinks] = await Promise.all([
      fetchTextFn(ddgAdultUrl, 8500).catch(() => ''),
      discoverDirectAdultTubeWatchUrls(cleanQuery, fetchTextFn).catch(() => [])
    ]);

    const ddgLinks = extractSearchCandidatesFromHtmlServer(ddgHtml, true);
    const mergedCandidates = [];
    const maxLen = Math.max(directTubeLinks.length, ddgLinks.length);
    for (let i = 0; i < maxLen; i++) {
      if (directTubeLinks[i]) mergedCandidates.push(directTubeLinks[i]);
      if (ddgLinks[i]) mergedCandidates.push(ddgLinks[i]);
    }

    const targets = selectDiverseUrlsByHost(mergedCandidates, Math.min(limit + 1, 6), 2);
    const settled = await Promise.allSettled(targets.map((u) => extractCandidatePage(u)));
    for (const s of settled) {
      if (s.status === 'fulfilled' && Array.isArray(s.value)) {
        pushUnique(s.value);
      }
    }
  } else {
    // SAFE PUBLIC WEB MODE: YouTube ytsearch + DuckDuckGo kp=1 Safe Open-Web Video Discovery
    const ddgSafeUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      `${cleanQuery} video watch`
    )}&kp=1`;

    const [ytResult, ddgHtml] = await Promise.all([
      runYtDlpSearchFn(cleanQuery, Math.min(limit, 4)).catch(() => null),
      fetchTextFn(ddgSafeUrl, 8500).catch(() => '')
    ]);

    const ytItems = ytResult
      ? pickPlayableItemsFromYtDlp(ytResult, 'https://www.youtube.com').filter((it) =>
          isVerifiedSafePublicItem(it)
        )
      : [];

    const openCandidates = extractSearchCandidatesFromHtmlServer(ddgHtml, false).filter(
      (u) => !/(?:youtube\.com|youtu\.be)/i.test(getHostnameClean(u))
    );
    const webTargets = selectDiverseUrlsByHost(openCandidates, 3, 1);
    const webSettled = await Promise.allSettled(webTargets.map((u) => extractCandidatePage(u)));
    const webItems = [];
    for (const s of webSettled) {
      if (s.status === 'fulfilled' && Array.isArray(s.value)) {
        webItems.push(...s.value);
      }
    }

    const maxPairs = Math.max(ytItems.length, webItems.length);
    for (let i = 0; i < maxPairs; i++) {
      if (ytItems[i]) pushUnique([ytItems[i]]);
      if (webItems[i]) pushUnique([webItems[i]]);
    }
  }

  if (useCache && collected.length > 0) {
    if (cloudSearchCache.size >= 60 && !cloudSearchCache.has(cacheKey)) {
      const oldestKey = cloudSearchCache.keys().next().value;
      if (oldestKey) cloudSearchCache.delete(oldestKey);
    }
    cloudSearchCache.set(cacheKey, {
      timestamp: Date.now(),
      items: collected,
      fetchedLimit: limit
    });
  }

  return collected.slice(0, limit);
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

async function handleSearchRequest(res, parsedReqUrl) {
  const query = String(parsedReqUrl.searchParams.get('q') || '').trim();
  if (!query) {
    return sendJson(res, 400, { ok: false, error: 'Missing search query parameter ?q=' });
  }
  const nsfwRaw = String(parsedReqUrl.searchParams.get('nsfw') || '0').toLowerCase();
  const isNsfw = nsfwRaw === '1' || nsfwRaw === 'true';
  const limit = Math.max(1, Math.min(12, Number(parsedReqUrl.searchParams.get('limit')) || 6));

  try {
    const items = await executeCloudKeywordSearch(query, { isNsfw, limit });
    return sendJson(res, 200, {
      ok: true,
      mode: isNsfw ? 'strict_18_plus' : 'safe_public_web',
      items
    });
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

async function downloadUrlWithYtDlp(targetUrl, outTemplate, useProxy = false, referer = '') {
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
    BROWSER_UA
  ];
  if (referer) {
    args.push('--referer', referer);
  }
  args.push(
    '-f',
    'bestvideo[vcodec^=avc1][height<=1080]+bestaudio[acodec^=mp4a]/best[ext=mp4][height<=1080]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '--merge-output-format',
    'mp4',
    '--ppa',
    'Merger+ffmpeg_o:-movflags +faststart',
    '-o',
    outTemplate
  );
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
      const isDirectBinary = isBinaryMediaRequest(parsed, { headers: {} });
      const preferProxy = !isDirectBinary && shouldPreferResidentialProxyFirst(parsed);
      const referer = buildUpstreamReferer(parsed, job.referer || '');
      try {
        await downloadUrlWithYtDlp(parsed.href, outTemplate, preferProxy, referer);
        downloaded = true;
        break;
      } catch (err1) {
        lastErr = err1;
        // Only retry watch-page URLs over Webshare Residential Proxy so raw .mp4 binary streams never burn proxy GBs
        if (RESIDENTIAL_PROXY_URL && !preferProxy && !isDirectBinary) {
          try {
            await downloadUrlWithYtDlp(parsed.href, outTemplate, true, referer);
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
    const stagedMp4 = path.join(tmpDir, 'optimized.mp4');
    await ensureDirectPlayMp4(largestFile, stagedMp4);
    const stagedStats = fs.statSync(stagedMp4);
    if (!stagedStats.size) {
      throw new Error('Transcoder produced an empty output file');
    }

    const safeTitle = sanitizeFilenameTitle(job.title);
    const finalFileName = `${safeTitle} [${job.id}].mp4`;
    const finalPath = path.join(destDir, finalFileName);
    const hiddenPublishTmp = path.join(destDir, `.rv-staging-${job.id}.tmp`);

    try {
      try {
        fs.renameSync(stagedMp4, finalPath);
      } catch (moveErr) {
        if (moveErr && moveErr.code === 'EXDEV') {
          fs.copyFileSync(stagedMp4, hiddenPublishTmp);
          fs.renameSync(hiddenPublishTmp, finalPath);
        } else {
          throw moveErr;
        }
      }
    } catch (pubErr) {
      try {
        fs.rmSync(hiddenPublishTmp, { force: true });
      } catch {}
      try {
        fs.rmSync(finalPath, { force: true });
      } catch {}
      throw pubErr;
    }

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

function toSafePrimitiveString(val) {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        if (!settled) {
          settled = true;
          const err = new Error('Request body too large');
          err.tooLarge = true;
          reject(err);
        }
        // Drain modest oversized bodies so HTTP 400 flushes without TCP ECONNRESET; pause multi-MB floods
        if (size > 2 * 1024 * 1024) {
          req.pause();
        }
        return;
      }
      if (!settled) {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

async function handlePlexSaveRequest(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err?.tooLarge) {
      res.setHeader('Connection', 'close');
      res.once('finish', () => {
        if (!req.complete) {
          setTimeout(() => {
            try {
              req.destroy();
            } catch {}
          }, 50).unref?.();
        }
      });
    }
    return sendJson(res, 400, { ok: false, error: err.message });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { ok: false, error: 'JSON body must be an object' });
  }

  const rawUrl = toSafePrimitiveString(body.url).trim();
  const rawFallbackUrl = toSafePrimitiveString(body.fallbackUrl).trim();
  const rawPageUrl = toSafePrimitiveString(body.pageUrl).trim();
  const rawStreamReferer = toSafePrimitiveString(body.streamReferer).trim();
  const rawOriginalUrl = toSafePrimitiveString(body.originalUrl).trim();

  let safeReferer = '';
  const preferredRefRaw = rawStreamReferer || rawPageUrl;
  if (preferredRefRaw) {
    try {
      const refUrl = await assertSafePublicUrl(preferredRefRaw);
      safeReferer = refUrl.href;
    } catch {}
  }

  const candidateSet = new Set();
  if (isSpecificWatchPageUrl(rawPageUrl) && /(?:reddit\.com|redgifs\.com)/i.test(rawPageUrl)) {
    candidateSet.add(rawPageUrl);
  }
  if (rawUrl) candidateSet.add(rawUrl);
  if (rawFallbackUrl && /^https?:\/\//i.test(rawFallbackUrl)) candidateSet.add(rawFallbackUrl);
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
    title: sanitizeFilenameTitle(toSafePrimitiveString(body.title) || 'ReelVault Clip'),
    sourceName: (toSafePrimitiveString(body.sourceName) || 'ReelVault').slice(0, 80),
    isNsfw,
    library: isNsfw ? 'ReelVault 18+ Vault' : 'ReelVault Clips',
    status: 'queued',
    createdAt: Date.now(),
    finishedAt: null,
    sizeBytes: 0,
    fileName: null,
    plexScanned: false,
    error: null,
    referer: safeReferer,
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
    try {
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
        return await handleProxyRequest(req, res, parsedUrl);
      }

      if (pathname === '/extract' && req.method === 'GET') {
        return await handleExtractRequest(res, parsedUrl);
      }

      if (pathname === '/search' && req.method === 'GET') {
        return await handleSearchRequest(res, parsedUrl);
      }

      if (pathname === '/plex/save' && req.method === 'POST') {
        return await handlePlexSaveRequest(req, res);
      }

      if (pathname === '/plex/jobs' && req.method === 'GET') {
        const publicJobs = plexJobs.map(({ candidates, referer, ...rest }) => rest);
        return sendJson(res, 200, { ok: true, jobs: publicJobs });
      }

      return sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
    } catch (err) {
      if (!res.headersSent && !res.destroyed) {
        return sendJson(res, 500, { ok: false, error: err?.message || 'Internal server error' });
      }
      if (!res.writableEnded) {
        res.destroy();
      }
    }
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
  extractSafeUpstreamAuth,
  buildUpstreamReferer,
  getPublicProxyOrigin,
  rewriteM3u8ManifestForProxy,
  isBlockedTextPayload,
  isBinaryMediaRequest,
  shouldPreferResidentialProxyFirst,
  sanitizeFilenameTitle,
  isSpecificWatchPageUrl,
  isIpBoundStreamUrl,
  isMainstreamSfwHost,
  isKnownAdultHost,
  hasAdultContentSignals,
  isVerifiedStrictAdultItem,
  isVerifiedSafePublicItem,
  extractSearchCandidatesFromHtmlServer,
  extractDirectStreamsFromHtmlServer,
  pickPlayableItemsFromYtDlp,
  executeCloudKeywordSearch,
  isGenericContainerOrVpsName,
  buildDesiredCustomConnections,
  ensurePlexRemoteConnectivity,
  createBridgeServer
};
