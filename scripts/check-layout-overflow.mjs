#!/usr/bin/env node
/**
 * Headless Chrome / Chromium Pixel-Level Layout & Horizontal Overflow Guard
 *
 * Launches a local static HTTP server + real headless Chrome/Chromium via DevTools
 * Protocol (zero external npm packages required) and inspects `getBoundingClientRect()`
 * on every visible DOM element across 6 mobile & tablet portrait/landscape viewports:
 *   - iPhone Narrow (320x680)
 *   - iPhone SE / Mini (375x812)
 *   - iPhone Pro Max (430x932)
 *   - iPad Portrait (768x1024)
 *   - iPad Landscape (1024x768)
 *   - Phone Landscape (844x390)
 *
 * Across each viewport it checks:
 *   1. Passcode lock overlay (#appLockOverlay)
 *   2. Safe Mode across all 4 tabs (Player, Search Web, Sources, Vault) + modals
 *   3. 18+ Mode with Expandable Directory open in "+ Enable / + Enable All" state,
 *      long unbroken Search & Vault items, and long #toast notification
 *   4. 18+ Mode with all 45+ Directory & Preset sources enabled in #sourcesList
 *
 * Fails with exit code 1 and exact element/parent coordinates if any element
 * overflows either the viewport width or its non-scrollable parent container.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function resolveBrowserBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);

  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }

  for (const cmd of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const resolved = execFileSync('which', [cmd], { encoding: 'utf8' }).trim();
      if (resolved) return resolved;
    } catch {
      // Try next binary name
    }
  }

  throw new Error(
    'No Chrome/Chromium binary found. Set CHROME_BIN or install google-chrome / chromium.'
  );
}

const mimeMap = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mobileconfig': 'application/x-apple-aspen-config'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(rootDir, relPath);

  if (!filePath.startsWith(rootDir + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': mimeMap[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(fs.readFileSync(filePath));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const browserBin = resolveBrowserBinary();
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reelvault-layout-'));

const chrome = spawn(
  browserBin,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'disabled:' }
  }
);

function cleanup() {
  try {
    chrome.kill('SIGKILL');
  } catch {}
  try {
    server.close();
  } catch {}
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

let totalIssues = 0;

try {
  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for Chrome DevTools endpoint: ${stderr}`)),
      30000
    );
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    chrome.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited prematurely (code ${code}): ${stderr}`));
    });
  });

  const debugPort = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error(`No inspectable page target found in ${JSON.stringify(targets)}`);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let msgId = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  // Block outbound third-party network calls so layout checks run 100% deterministically & offline
  await send('Network.enable');
  await send('Network.setBlockedURLs', {
    urls: ['https://*', 'http://*.com/*', 'http://*.org/*', 'http://*.net/*', 'http://*.io/*', 'http://*.tv/*']
  });

  const viewports = [
    { name: 'iPhone Narrow (320x680)', width: 320, height: 680 },
    { name: 'iPhone SE (375x812)', width: 375, height: 812 },
    { name: 'iPhone 15 Pro Max (430x932)', width: 430, height: 932 },
    { name: 'iPad Portrait (768x1024)', width: 768, height: 1024 },
    { name: 'iPad Landscape (1024x768)', width: 1024, height: 768 },
    { name: 'Phone Landscape (844x390)', width: 844, height: 390 }
  ];

  console.log(`[layout-check] Using browser: ${browserBin}`);

  for (const vp of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: true
    });

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    await new Promise((r) => setTimeout(r, 350));

    const evalRes = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const issues = [];

        function describeEl(el) {
          const idPart = el.id ? '#' + el.id : '';
          const clsPart = el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().replace(/\\s+/g, '.')
            : '';
          return el.tagName.toLowerCase() + idPart + clsPart;
        }

        function scanDom(stateLabel, contextLabel) {
          const vw = document.documentElement.clientWidth;
          for (const el of document.querySelectorAll('*')) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            // Intentional horizontal chip scrollers with overflow-x: auto
            if (el.closest('.nsfw-chips-bar, .video-tags-bar')) continue;

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;

            if (rect.right > vw + 1 || rect.left < -1) {
              issues.push({
                state: stateLabel,
                context: contextLabel,
                type: 'viewport-overflow',
                sel: describeEl(el),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                vw
              });
            }

            const parent = el.parentElement;
            if (parent) {
              const pStyle = getComputedStyle(parent);
              if (pStyle.overflowX !== 'auto' && pStyle.overflowX !== 'scroll') {
                const pRect = parent.getBoundingClientRect();
                if (pRect.width > 0 && (rect.right > pRect.right + 1.5 || rect.left < pRect.left - 1.5)) {
                  issues.push({
                    state: stateLabel,
                    context: contextLabel,
                    type: 'parent-overflow',
                    sel: describeEl(el),
                    parentSel: describeEl(parent),
                    childLeft: Math.round(rect.left),
                    childRight: Math.round(rect.right),
                    parentLeft: Math.round(pRect.left),
                    parentRight: Math.round(pRect.right),
                    text: (el.textContent || '').trim().slice(0, 60)
                  });
                }
              }
            }
          }
        }

        function scanAllTabs(stateLabel) {
          for (const tab of ['view-discover', 'view-search', 'view-sources', 'view-vault']) {
            switchTab(tab);
            scanDom(stateLabel, tab);
          }
        }

        // 1. Check Passcode Lock Overlay before unlocking
        if (!document.getElementById('appLockOverlay')?.classList.contains('hidden')) {
          scanDom('passcode-lock', 'appLockOverlay');
        }

        // Unlock app
        document.body.classList.remove('app-locked');
        document.getElementById('appLockOverlay')?.classList.add('hidden');
        if (typeof stopContinuousBackgroundPuller === 'function') {
          stopContinuousBackgroundPuller();
        }

        // Seed Safe + 18+ Vault items (including unbroken 60+ char title & multireddit source)
        await saveVideoToVaultDB({
          id: 'layout-sfw-1',
          title: 'NASA_Perseverance_Mars_Rover_4K_Descent_Unbroken_Identifier_Clip',
          videoUrl: 'https://images-assets.nasa.gov/video/mars_descent_1080p.mp4',
          pageUrl: 'https://images.nasa.gov/details/mars_descent',
          format: 'mp4',
          sourceName: 'NASA Archive',
          isNsfw: false,
          isFavorite: true
        });
        await saveVideoToVaultDB({
          id: 'layout-nsfw-1',
          title: 'Unbroken_60Char_Stream_nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual_1080p.mkv',
          videoUrl: 'https://cdn.example.com/streams/nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual/clip.mkv',
          pageUrl: 'https://www.reddit.com/r/nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual/',
          format: 'mkv',
          sourceName: 'r/nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual',
          isNsfw: true,
          isFavorite: true
        });

        // 2. Safe Mode across all 4 tabs + Modals
        setAdultContentEnabled(false);
        renderSearchResults([
          {
            id: 'sfw-search-1',
            title: 'Wikimedia_Commons_4K_Timelapses_Long_Unbroken_Filename_2026.webm',
            videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/sample.webm',
            format: 'webm',
            sourceName: 'Wikimedia Commons',
            isNsfw: false
          }
        ]);
        await renderVaultList();
        scanAllTabs('safe-mode');

        openAgeGateModal();
        scanDom('safe-mode', 'ageGateModal');
        closeAgeGateModal();

        document.getElementById('installModal')?.classList.remove('hidden');
        scanDom('safe-mode', 'installModal');
        document.getElementById('installModal')?.classList.add('hidden');

        // 3. 18+ Mode — Directory expanded in "+ Enable / + Enable All (5)" state (IMG_1528.jpeg)
        setAdultContentEnabled(true);
        if (typeof stopContinuousBackgroundPuller === 'function') {
          stopContinuousBackgroundPuller();
        }
        toggleAdultDirectory(true);
        disableAllDirectorySources();
        renderSearchResults([
          {
            id: 'nsfw-search-1',
            title: 'SuperLongUnbrokenTitle_nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual_1080p_60fps',
            videoUrl: 'https://cdn.example.com/very/long/unbroken/path/video.mp4',
            format: 'mp4',
            sourceName: 'r/nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual',
            isNsfw: true
          }
        ]);
        await renderVaultList();
        showToast('Enabled all 45 sources from the 18+ Subreddit & Niche Directory with zero horizontal overflow!');
        scanAllTabs('nsfw-dir-disabled');

        // 4. 18+ Mode — All 45+ Directory & Preset sources enabled in #sourcesList
        enableAllDirectorySources();
        if (typeof stopContinuousBackgroundPuller === 'function') {
          stopContinuousBackgroundPuller();
        }
        scanAllTabs('nsfw-dir-enabled');

        // 5. Cloud & Plex Connected State — #sendToPlexBtn, #reelsPlexBtn, Search/Vault 🎬 Plex buttons, and #cloudJobsBox
        setCloudBackendConfig('https://85-239-249-225.nip.io', 'rv_layout_audit_secret_key_0123456789');
        renderPlexJobsBox([
          {
            id: 'a1b2c3d4',
            title: 'SuperLongUnbrokenClipTitle_nsfw+NSFW_GIF+RealGirls+Amateur_1080p_60fps',
            isNsfw: true,
            status: 'ready',
            sizeBytes: 48 * 1024 * 1024
          },
          {
            id: 'e5f60718',
            title: 'NASA_Perseverance_Mars_Descent_4K_DirectPlay',
            isNsfw: false,
            status: 'optimizing',
            sizeBytes: 0
          }
        ]);
        await renderVaultList();
        scanAllTabs('cloud-plex-connected');
        clearCloudBackendConfig();

        return issues;
      })()`
    });

    if (evalRes.exceptionDetails) {
      throw new Error(`Page evaluation threw on ${vp.name}: ${JSON.stringify(evalRes.exceptionDetails)}`);
    }

    const vpIssues = evalRes.result.value || [];
    totalIssues += vpIssues.length;
    console.log(`[layout-check] ${vp.name}: ${vpIssues.length} overflow issue(s)`);
    if (vpIssues.length > 0) {
      console.error(JSON.stringify(vpIssues.slice(0, 20), null, 2));
    }
  }

  ws.close();
} finally {
  cleanup();
}

if (totalIssues > 0) {
  console.error(`[layout-check] FAIL: Detected ${totalIssues} horizontal overflow issue(s).`);
  process.exit(1);
}

console.log('[layout-check] PASS: Zero viewport or parent-container overflows across all 6 viewports & 4 tabs.');
