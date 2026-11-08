// ReelVault — iPhone Random Video Discovery, Multi-Engine Search & Downloader PWA

const STORAGE_KEYS = {
  SOURCES: 'reelvault_sources_v1',
  SETTINGS: 'reelvault_settings_v1'
};

const DEFAULT_SOURCES = [
  {
    id: 'src-kw-satisfying',
    type: 'keyword',
    value: 'oddly satisfying',
    label: 'Oddly Satisfying Clips',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-kw-vintage',
    type: 'keyword',
    value: 'vintage cartoon animation',
    label: 'Vintage Cartoons & Retro',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-kw-space',
    type: 'keyword',
    value: 'nasa space launch',
    label: 'NASA & Space Footage',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-kw-nature',
    type: 'keyword',
    value: 'ocean wildlife nature',
    label: 'Ocean & Nature',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-sub-unexpected',
    type: 'subreddit',
    value: 'Unexpected',
    label: 'r/Unexpected',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-sub-satisfying',
    type: 'subreddit',
    value: 'oddlysatisfying',
    label: 'r/oddlysatisfying',
    enabled: true,
    builtIn: true
  }
];

// Reliable public-domain / CC0 direct .mp4 fallback clips so the player never fails offline/rate-limited
const FALLBACK_VIDEOS = [
  {
    id: 'fb-apollo11',
    title: 'Apollo 11 Saturn V Launch (NASA Archive)',
    videoUrl: 'https://archive.org/download/Apollo11Audio/Apollo11Launch.mp4',
    sourceName: 'Internet Archive (NASA)',
    pageUrl: 'https://archive.org/details/Apollo11Audio'
  },
  {
    id: 'fb-bigbuck',
    title: 'Big Buck Bunny — Open Movie Short Clip',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    sourceName: 'Open Movie Archive',
    pageUrl: 'https://peach.blender.org/'
  },
  {
    id: 'fb-forbiggerblazes',
    title: 'High Speed Nature & Fire Reel',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    sourceName: 'Open Media Stream',
    pageUrl: 'https://commondatastorage.googleapis.com/'
  },
  {
    id: 'fb-forbiggerescapes',
    title: 'Scenic Mountain & Alpine Escape Reel',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    sourceName: 'Open Media Stream',
    pageUrl: 'https://commondatastorage.googleapis.com/'
  },
  {
    id: 'fb-wearegoingonbullrun',
    title: 'Rally & Roadtrip Action Clip',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    sourceName: 'Open Media Stream',
    pageUrl: 'https://commondatastorage.googleapis.com/'
  }
];

// App State
let sources = [];
let settings = {
  allowNsfw: false,
  autoPlay: true
};
let videoQueue = [];
let currentIndex = -1;
let seenUrls = new Set();
let lastSearchResults = [];

// IndexedDB for Vault
const DB_NAME = 'ReelVaultDB';
const DB_VERSION = 1;
const VAULT_STORE = 'vault_videos';

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllVaultVideos() {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE, 'readonly');
      const store = tx.objectStore(VAULT_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.savedAt - a.savedAt));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function saveVideoToVaultDB(videoItem) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const record = {
      ...videoItem,
      id: videoItem.id || 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      savedAt: Date.now()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

async function deleteVaultVideoDB(id) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearVaultDB() {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Load & Save Settings / Sources
function loadState() {
  try {
    const rawSources = localStorage.getItem(STORAGE_KEYS.SOURCES);
    if (rawSources) {
      sources = JSON.parse(rawSources);
    } else {
      sources = structuredClone(DEFAULT_SOURCES);
    }
  } catch {
    sources = structuredClone(DEFAULT_SOURCES);
  }

  try {
    const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (rawSettings) {
      settings = { ...settings, ...JSON.parse(rawSettings) };
    }
  } catch {
    // keep defaults
  }
}

function saveSources() {
  localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));
  updateHeaderSummary();
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// UI Helpers
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2800);
}

function updateHeaderSummary() {
  const enabledCount = sources.filter((s) => s.enabled).length;
  const el = document.getElementById('activeSourceSummary');
  if (el) {
    el.textContent = `${enabledCount} active source${enabledCount === 1 ? '' : 's'} ready`;
  }
}

// Fetch helper with CORS proxy fallback for Reddit / third-party pages
async function fetchWithCorsFallback(url, asText = false) {
  const attempts = [
    url,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  let lastErr = null;
  for (const candidate of attempts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const res = await fetch(candidate, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      return asText ? await res.text() : await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Network request failed');
}

// ==========================================
// VIDEO DISCOVERY ENGINES
// ==========================================

// 1. Internet Archive Engine (Native CORS support + direct .mp4 files)
async function searchInternetArchive(keyword, limit = 12) {
  const safeQuery = keyword.replace(/["()]/g, ' ').trim();
  const nsfwFilter = settings.allowNsfw ? '' : ' AND NOT collection:(adult)';
  const q = `(${safeQuery}) AND mediatype:(movies)${nsfwFilter}`;
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title&sort[]=downloads+desc&rows=30&page=1&output=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(searchUrl, { signal: controller.signal });
  clearTimeout(timer);
  if (!res.ok) return [];

  const data = await res.json();
  const docs = data?.response?.docs || [];
  if (!docs.length) return [];

  // Shuffle docs and inspect metadata of up to 5 items in parallel to get direct .mp4 links
  const shuffled = [...docs].sort(() => Math.random() - 0.5).slice(0, Math.min(6, limit));
  const results = [];

  await Promise.all(
    shuffled.map(async (doc) => {
      try {
        const metaRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        const files = meta?.files || [];
        // Find a direct .mp4 file (prefer reasonable size < 80MB if size is listed)
        const mp4Files = files.filter(
          (f) =>
            f.name &&
            f.name.toLowerCase().endsWith('.mp4') &&
            !f.name.toLowerCase().includes('.ia.mp4')
        );
        const chosen =
          mp4Files.find((f) => f.size && Number(f.size) < 75_000_000) ||
          mp4Files[0] ||
          files.find((f) => f.name && f.name.toLowerCase().endsWith('.mp4'));

        if (chosen) {
          const encodedPath = chosen.name
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/');
          const videoUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodedPath}`;
          results.push({
            id: `ia-${doc.identifier}`,
            title: doc.title || doc.identifier,
            videoUrl,
            sourceName: `Archive.org (${keyword})`,
            pageUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`
          });
        }
      } catch {
        // ignore individual metadata error
      }
    })
  );

  return results;
}

// 2. Wikimedia Commons Video Search Engine (Native CORS via origin=*)
async function searchWikimediaVideos(keyword, limit = 10) {
  const query = `${keyword} filetype:video`;
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  const res = await fetch(apiUrl, { signal: controller.signal });
  clearTimeout(timer);
  if (!res.ok) return [];

  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  const results = [];

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info || !info.url) continue;
    const cleanTitle = (page.title || 'Wikimedia Video')
      .replace(/^File:/i, '')
      .replace(/\.(webm|ogv|mp4|mov)$/i, '')
      .replace(/_/g, ' ');

    // Prefer direct mp4 or webm playable stream
    if (info.url.match(/\.(mp4|mov|m4v|webm)$/i)) {
      results.push({
        id: `wiki-${page.pageid}`,
        title: cleanTitle,
        videoUrl: info.url,
        sourceName: `Wikimedia (${keyword})`,
        pageUrl: info.descriptionurl || info.url
      });
    }
  }

  return results;
}

// 3. Reddit Subreddit or Global Keyword Video Search
function extractRedditVideosFromListing(json, sourceLabel) {
  const children = json?.data?.children || [];
  const results = [];

  for (const child of children) {
    const post = child?.data;
    if (!post) continue;
    if (post.over_18 && !settings.allowNsfw) continue;

    // Check crosspost parent too
    const mediaPost = post.crosspost_parent_list?.[0] || post;

    let videoUrl =
      mediaPost?.secure_media?.reddit_video?.fallback_url ||
      mediaPost?.media?.reddit_video?.fallback_url ||
      mediaPost?.preview?.reddit_video_preview?.fallback_url ||
      null;

    if (!videoUrl && typeof mediaPost.url === 'string' && mediaPost.url.match(/\.mp4(\?.*)?$/i)) {
      videoUrl = mediaPost.url;
    }

    if (videoUrl) {
      results.push({
        id: `rd-${post.id}`,
        title: post.title || 'Reddit Video Clip',
        videoUrl: videoUrl.replace(/&amp;/g, '&'),
        sourceName: sourceLabel,
        pageUrl: `https://www.reddit.com${post.permalink || ''}`
      });
    }
  }

  return results;
}

async function fetchSubredditVideos(subreddit) {
  const cleanSub = subreddit.replace(/^\/?r\//i, '').trim();
  const sorts = ['hot', 'top', 'new'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
  const url = `https://www.reddit.com/r/${encodeURIComponent(cleanSub)}/${randomSort}.json?limit=45&raw_json=1`;

  const json = await fetchWithCorsFallback(url, false);
  return extractRedditVideosFromListing(json, `r/${cleanSub}`);
}

async function searchRedditVideosByKeyword(keyword) {
  const nsfwFlag = settings.allowNsfw ? '1' : '0';
  const sorts = ['relevance', 'hot', 'top'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
    keyword
  )}&type=link&sort=${randomSort}&include_over_18=${nsfwFlag}&limit=45&raw_json=1`;

  const json = await fetchWithCorsFallback(url, false);
  return extractRedditVideosFromListing(json, `Reddit (${keyword})`);
}

// 4. Custom URL / Webpage .mp4 Scanner
async function scanUrlForVideos(targetUrl, customLabel = 'Web Scanner') {
  const trimmed = targetUrl.trim();

  // Direct video URL
  if (trimmed.match(/\.(mp4|mov|m4v|webm)(\?.*)?$/i)) {
    const fileName = trimmed.split('/').pop().split('?')[0] || 'Direct Video';
    return [
      {
        id: `url-${Date.now()}`,
        title: decodeURIComponent(fileName),
        videoUrl: trimmed,
        sourceName: customLabel,
        pageUrl: trimmed
      }
    ];
  }

  // If Reddit URL, route to Reddit JSON
  if (trimmed.includes('reddit.com/r/')) {
    const match = trimmed.match(/reddit\.com\/r\/([^/?#]+)/i);
    if (match?.[1]) {
      return await fetchSubredditVideos(match[1]);
    }
  }

  // Otherwise fetch raw text/JSON and extract all direct .mp4 / .webm links
  const rawText = await fetchWithCorsFallback(trimmed, true);
  const foundUrls = new Set();

  // Absolute video URLs
  const absRegex = /https?:\/\/[^\s"'<>\\]+\.(?:mp4|m4v|mov|webm)(?:\?[^\s"'<>\\]*)?/gi;
  let m;
  while ((m = absRegex.exec(rawText)) !== null) {
    foundUrls.add(m[0].replace(/&amp;/g, '&'));
  }

  // Relative video src attributes
  const relRegex = /(?:src|href)=["']([^"']+\.(?:mp4|m4v|mov|webm)(?:\?[^"']*)?)["']/gi;
  while ((m = relRegex.exec(rawText)) !== null) {
    try {
      const resolved = new URL(m[1], trimmed).href;
      foundUrls.add(resolved);
    } catch {
      // ignore invalid relative URL
    }
  }

  return Array.from(foundUrls).map((vUrl, idx) => {
    const shortName = vUrl.split('/').pop().split('?')[0] || `Video #${idx + 1}`;
    return {
      id: `scan-${Date.now()}-${idx}`,
      title: decodeURIComponent(shortName),
      videoUrl: vUrl,
      sourceName: customLabel,
      pageUrl: trimmed
    };
  });
}

// Pull videos from a single source object
async function pullFromSource(source) {
  if (source.type === 'subreddit') {
    return await fetchSubredditVideos(source.value);
  }
  if (source.type === 'url') {
    return await scanUrlForVideos(source.value, source.label || 'Custom URL');
  }
  // Default: 'keyword' -> query Archive.org, Reddit, and Wikimedia in parallel
  const settled = await Promise.allSettled([
    searchInternetArchive(source.value, 6),
    searchRedditVideosByKeyword(source.value),
    searchWikimediaVideos(source.value, 8)
  ]);

  const combined = [];
  for (const res of settled) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      combined.push(...res.value);
    }
  }
  return combined;
}

// ==========================================
// PLAYER & SHUFFLE CONTROLLER
// ==========================================

function setPlayerLoading(isLoading, message = 'Pulling random video...') {
  const overlay = document.getElementById('playerLoading');
  const textEl = document.getElementById('playerLoadingText');
  const emptyEl = document.getElementById('playerEmpty');
  if (textEl) textEl.textContent = message;
  if (isLoading) {
    emptyEl?.classList.add('hidden');
    overlay?.classList.remove('hidden');
  } else {
    overlay?.classList.add('hidden');
  }
}

function updatePlayerUI() {
  const videoEl = document.getElementById('mainVideo');
  const titleEl = document.getElementById('videoTitle');
  const badgeEl = document.getElementById('videoSourceBadge');
  const queueEl = document.getElementById('queueCounter');
  const origLink = document.getElementById('videoOriginalLink');
  const prevBtn = document.getElementById('prevVideoBtn');
  const savePhoneBtn = document.getElementById('saveToPhoneBtn');
  const saveVaultBtn = document.getElementById('saveToVaultBtn');
  const emptyEl = document.getElementById('playerEmpty');

  queueEl.textContent =
    videoQueue.length > 0
      ? `Video ${currentIndex + 1} of ${videoQueue.length}`
      : '0 in queue';

  prevBtn.disabled = currentIndex <= 0;

  const current = videoQueue[currentIndex];
  if (!current) {
    savePhoneBtn.disabled = true;
    saveVaultBtn.disabled = true;
    return;
  }

  emptyEl?.classList.add('hidden');
  savePhoneBtn.disabled = false;
  saveVaultBtn.disabled = false;

  titleEl.textContent = current.title || 'Untitled Video';
  badgeEl.textContent = current.sourceName || 'Random Feed';

  if (current.pageUrl) {
    origLink.href = current.pageUrl;
    origLink.classList.remove('hidden');
  } else {
    origLink.classList.add('hidden');
  }

  if (videoEl.src !== current.videoUrl) {
    videoEl.src = current.videoUrl;
    videoEl.load();
    if (settings.autoPlay) {
      videoEl.play().catch(() => {
        // iOS may require user tap if unmuted; user can tap play on controls
      });
    }
  }
}

async function pullRandomVideos(count = 1, customKeyword = null) {
  setPlayerLoading(
    true,
    customKeyword
      ? `Searching the web for "${customKeyword}"...`
      : count > 1
      ? `Pulling ${count} random videos...`
      : 'Pulling random video...'
  );

  try {
    let pool = [];

    if (customKeyword) {
      pool = await pullFromSource({
        type: 'keyword',
        value: customKeyword,
        label: customKeyword
      });
    } else {
      const activeSources = sources.filter((s) => s.enabled);
      if (activeSources.length === 0) {
        showToast('Enable at least one source in the Sources tab!');
        setPlayerLoading(false);
        return;
      }

      // Pick up to 2 random active sources for variety & speed
      const pickedSources = [...activeSources]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(2, activeSources.length));

      const results = await Promise.allSettled(
        pickedSources.map((src) => pullFromSource(src))
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          pool.push(...r.value);
        }
      }
    }

    // Filter out already seen URLs if possible
    let fresh = pool.filter((item) => item?.videoUrl && !seenUrls.has(item.videoUrl));
    if (fresh.length === 0 && pool.length > 0) {
      seenUrls.clear();
      fresh = pool;
    }

    // Fallback if offline or no matches returned
    if (fresh.length === 0) {
      if (customKeyword) {
        showToast(`No direct .mp4 videos found for "${customKeyword}". Try another keyword!`);
        setPlayerLoading(false);
        return;
      }
      fresh = [...FALLBACK_VIDEOS];
    }

    // Shuffle and pick requested count
    const selected = fresh.sort(() => Math.random() - 0.5).slice(0, count);
    for (const item of selected) {
      seenUrls.add(item.videoUrl);
      videoQueue.push(item);
    }

    currentIndex = videoQueue.length - selected.length;
    updatePlayerUI();

    if (count > 1) {
      showToast(`Added ${selected.length} random videos to your queue!`);
    }
  } catch {
    const fallbackItem = FALLBACK_VIDEOS[Math.floor(Math.random() * FALLBACK_VIDEOS.length)];
    videoQueue.push(fallbackItem);
    currentIndex = videoQueue.length - 1;
    updatePlayerUI();
  } finally {
    setPlayerLoading(false);
  }
}

// ==========================================
// DOWNLOAD TO IPHONE (PHOTOS / FILES)
// ==========================================

async function downloadVideoToIphone(videoItem) {
  if (!videoItem?.videoUrl) return;

  const statusBox = document.getElementById('downloadStatusBox');
  const statusText = document.getElementById('downloadStatusText');
  const statusPercent = document.getElementById('downloadStatusPercent');
  const progressBar = document.getElementById('downloadProgressBar');
  const saveBtn = document.getElementById('saveToPhoneBtn');

  statusBox?.classList.remove('hidden');
  if (statusText) statusText.textContent = 'Downloading .mp4 to iPhone...';
  if (statusPercent) statusPercent.textContent = '0%';
  if (progressBar) progressBar.style.width = '8%';
  if (saveBtn) saveBtn.disabled = true;

  const cleanFileName =
    (videoItem.title || 'reelvault-video')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 42) + '.mp4';

  try {
    // Attempt direct CORS fetch or proxy fetch to get a Blob for iOS Share Sheet ("Save Video")
    let response = null;
    const candidateUrls = [
      videoItem.videoUrl,
      `https://corsproxy.io/?${encodeURIComponent(videoItem.videoUrl)}`
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          response = res;
          break;
        }
      } catch {
        // try next
      }
    }

    if (!response) {
      throw new Error('Direct stream requires browser download fallback');
    }

    const contentLength = Number(response.headers.get('content-length')) || 0;
    const reader = response.body?.getReader();
    let blob;

    if (reader) {
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          const pct = Math.min(99, Math.round((received / contentLength) * 100));
          if (statusPercent) statusPercent.textContent = `${pct}%`;
          if (progressBar) progressBar.style.width = `${pct}%`;
        } else {
          const mb = (received / (1024 * 1024)).toFixed(1);
          if (statusPercent) statusPercent.textContent = `${mb} MB`;
          if (progressBar) progressBar.style.width = '70%';
        }
      }
      blob = new Blob(chunks, { type: 'video/mp4' });
    } else {
      blob = await response.blob();
    }

    if (statusPercent) statusPercent.textContent = '100%';
    if (progressBar) progressBar.style.width = '100%';

    const file = new File([blob], cleanFileName, { type: 'video/mp4' });

    // On iPhone Safari, navigator.share({ files }) opens the native sheet with "Save Video" (to Photos) & "Save to Files"
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      if (statusText) statusText.textContent = 'Opening iPhone Save menu...';
      await navigator.share({
        files: [file],
        title: videoItem.title || 'ReelVault Video'
      });
      showToast('Saved! Choose "Save Video" for Photos app.');
    } else {
      // Standard browser file download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cleanFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      showToast('Video downloaded to your device!');
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      // User dismissed iOS share sheet
      showToast('Share menu closed');
    } else {
      // Fallback: open direct .mp4 link for native Safari download
      const a = document.createElement('a');
      a.href = videoItem.videoUrl;
      a.download = cleanFileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Opened direct video file for saving');
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    setTimeout(() => {
      statusBox?.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }, 1200);
  }
}

// ==========================================
// RENDER SOURCES, SEARCH RESULTS & VAULT
// ==========================================

function renderSourcesList() {
  const container = document.getElementById('sourcesList');
  if (!container) return;

  if (sources.length === 0) {
    container.innerHTML = `<p class="muted-center">No sources configured. Add one above!</p>`;
    return;
  }

  const typeBadges = {
    keyword: '🔍 Keyword',
    subreddit: '👽 Subreddit',
    url: '🔗 URL'
  };

  container.innerHTML = sources
    .map(
      (s) => `
      <div class="source-item">
        <div class="source-info">
          <div class="source-name">${escapeHtml(s.label || s.value)}</div>
          <div class="source-sub">${typeBadges[s.type] || s.type}: <code>${escapeHtml(s.value)}</code></div>
        </div>
        <div class="source-controls">
          <label class="switch" title="Toggle source">
            <input type="checkbox" data-action="toggle-source" data-id="${s.id}" ${
        s.enabled ? 'checked' : ''
      } />
            <span class="slider"></span>
          </label>
          <button class="delete-btn" data-action="delete-source" data-id="${s.id}" title="Remove source">
            🗑
          </button>
        </div>
      </div>
    `
    )
    .join('');
}

function renderSearchResults(items) {
  lastSearchResults = items;
  const countEl = document.getElementById('searchResultsCount');
  const listEl = document.getElementById('searchResultsList');
  if (countEl) countEl.textContent = `${items.length} video${items.length === 1 ? '' : 's'}`;
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="muted-center">No direct .mp4 videos found for that query. Try another keyword or enable more engines.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (item, idx) => `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <span class="source-badge">${escapeHtml(item.sourceName)}</span>
        </div>
        <div class="vli-actions">
          <button class="btn-primary btn-mini" data-action="play-search-item" data-index="${idx}">
            ▶ Watch in Player
          </button>
          <button class="btn-download btn-mini" data-action="download-search-item" data-index="${idx}">
            📲 Save to iPhone
          </button>
          <button class="btn-secondary btn-mini" data-action="vault-search-item" data-index="${idx}">
            📥 Vault
          </button>
        </div>
      </div>
    `
    )
    .join('');
}

async function renderVaultList() {
  const items = await getAllVaultVideos();
  const listEl = document.getElementById('vaultList');
  const badgeEl = document.getElementById('vaultBadge');

  if (badgeEl) {
    if (items.length > 0) {
      badgeEl.textContent = String(items.length);
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  if (!listEl) return;
  if (items.length === 0) {
    listEl.innerHTML = `<p class="muted-center">No videos saved in your Vault yet. Tap "📥 Vault" on any video to save it here.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <span class="source-badge">${escapeHtml(item.sourceName || 'Saved')}</span>
        </div>
        <div class="vli-actions">
          <button class="btn-primary btn-mini" data-action="play-vault-item" data-id="${escapeHtml(item.id)}">
            ▶ Watch
          </button>
          <button class="btn-download btn-mini" data-action="download-vault-item" data-id="${escapeHtml(item.id)}">
            📲 Save to iPhone
          </button>
          <button class="delete-btn" data-action="delete-vault-item" data-id="${escapeHtml(item.id)}" title="Remove">
            🗑
          </button>
        </div>
      </div>
    `
    )
    .join('');
}

function switchTab(targetId) {
  document.querySelectorAll('.tab-view').forEach((sec) => {
    sec.classList.toggle('active', sec.id === targetId);
  });
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === targetId);
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  updateHeaderSummary();
  renderSourcesList();
  await renderVaultList();

  // Sync settings toggles
  const nsfwToggle = document.getElementById('allowNsfwToggle');
  const autoPlayToggle = document.getElementById('autoPlayToggle');
  if (nsfwToggle) nsfwToggle.checked = Boolean(settings.allowNsfw);
  if (autoPlayToggle) autoPlayToggle.checked = Boolean(settings.autoPlay);

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Bottom Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.target);
    });
  });

  // Quick Keyword Search on Player Tab
  document.getElementById('quickSearchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('quickSearchInput');
    const kw = input?.value?.trim();
    if (!kw) return;
    await pullRandomVideos(1, kw);
  });

  // Player Controls: Shuffle, Next, Prev
  document.getElementById('shuffleBtn')?.addEventListener('click', () => {
    pullRandomVideos(1);
  });

  document.getElementById('nextVideoBtn')?.addEventListener('click', () => {
    if (currentIndex < videoQueue.length - 1) {
      currentIndex++;
      updatePlayerUI();
    } else {
      pullRandomVideos(1);
    }
  });

  document.getElementById('prevVideoBtn')?.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updatePlayerUI();
    }
  });

  // Swipe left/right on Video Stage for quick Next/Prev on iPhone
  const stage = document.getElementById('videoStage');
  let touchStartX = 0;
  let touchStartY = 0;
  stage?.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true }
  );
  stage?.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          // Swipe Left -> Next
          document.getElementById('nextVideoBtn')?.click();
        } else if (currentIndex > 0) {
          // Swipe Right -> Prev
          document.getElementById('prevVideoBtn')?.click();
        }
      }
    },
    { passive: true }
  );

  // Batch Pull 5 Random Videos
  document.getElementById('batchPullBtn')?.addEventListener('click', () => {
    pullRandomVideos(5);
  });

  // Save to iPhone & Save to Vault
  document.getElementById('saveToPhoneBtn')?.addEventListener('click', () => {
    const current = videoQueue[currentIndex];
    if (current) downloadVideoToIphone(current);
  });

  document.getElementById('saveToVaultBtn')?.addEventListener('click', async () => {
    const current = videoQueue[currentIndex];
    if (!current) return;
    await saveVideoToVaultDB(current);
    await renderVaultList();
    showToast('Saved to your Offline Vault!');
  });

  // TAB 2: Multi-Engine Search Form
  document.getElementById('deepSearchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('deepSearchInput')?.value?.trim();
    if (!query) return;

    const useArchive = document.getElementById('engArchive')?.checked;
    const useWiki = document.getElementById('engWikimedia')?.checked;
    const useReddit = document.getElementById('engReddit')?.checked;

    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
      listEl.innerHTML = `<p class="muted-center">Searching open video networks for "${escapeHtml(query)}"...</p>`;
    }

    const tasks = [];
    if (useArchive) tasks.push(searchInternetArchive(query, 8));
    if (useWiki) tasks.push(searchWikimediaVideos(query, 10));
    if (useReddit) tasks.push(searchRedditVideosByKeyword(query));

    const settled = await Promise.allSettled(tasks);
    const combined = [];
    for (const r of settled) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        combined.push(...r.value);
      }
    }

    renderSearchResults(combined);
  });

  // TAB 2: Webpage .mp4 Scanner Form
  document.getElementById('urlScanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlInput = document.getElementById('urlScanInput')?.value?.trim();
    if (!urlInput) return;

    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
      listEl.innerHTML = `<p class="muted-center">Scanning page for downloadable .mp4 files...</p>`;
    }

    try {
      const found = await scanUrlForVideos(urlInput, 'Scanned Page');
      renderSearchResults(found);
      if (found.length > 0) {
        showToast(`Found ${found.length} video(s) on page!`);
      }
    } catch {
      renderSearchResults([]);
      showToast('Could not scan that URL due to site security restrictions.');
    }
  });

  // Delegate clicks on Search Results list
  document.getElementById('searchResultsList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    const item = lastSearchResults[idx];
    if (!item) return;

    if (btn.dataset.action === 'play-search-item') {
      videoQueue.push(item);
      currentIndex = videoQueue.length - 1;
      switchTab('view-discover');
      updatePlayerUI();
    } else if (btn.dataset.action === 'download-search-item') {
      await downloadVideoToIphone(item);
    } else if (btn.dataset.action === 'vault-search-item') {
      await saveVideoToVaultDB(item);
      await renderVaultList();
      showToast('Saved to Vault!');
    }
  });

  // TAB 3: Segmented control for Source Type
  const sourceInput = document.getElementById('newSourceInput');
  document.querySelectorAll('.segmented-control .segment').forEach((seg) => {
    seg.addEventListener('click', () => {
      document.querySelectorAll('.segmented-control .segment').forEach((s) => s.classList.remove('active'));
      seg.classList.add('active');
      const radio = seg.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      const type = seg.dataset.type;
      if (sourceInput) {
        if (type === 'keyword') {
          sourceInput.placeholder = 'e.g. vintage cartoons, synthwave, nature...';
        } else if (type === 'subreddit') {
          sourceInput.placeholder = 'e.g. Unexpected, oddlysatisfying, NatureIsFuckingLit';
        } else {
          sourceInput.placeholder = 'https://example.com/video.mp4 or feed URL';
        }
      }
    });
  });

  // TAB 3: Add Source Form
  document.getElementById('addSourceForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedRadio = document.querySelector('input[name="sourceType"]:checked');
    const type = selectedRadio ? selectedRadio.value : 'keyword';
    const rawVal = document.getElementById('newSourceInput')?.value?.trim();
    const rawLabel = document.getElementById('newSourceLabel')?.value?.trim();

    if (!rawVal) return;

    const cleanVal = type === 'subreddit' ? rawVal.replace(/^\/?r\//i, '') : rawVal;
    const defaultLabel =
      type === 'subreddit'
        ? `r/${cleanVal}`
        : type === 'keyword'
        ? `Topic: ${cleanVal}`
        : cleanVal;

    sources.unshift({
      id: 'src-' + Date.now(),
      type,
      value: cleanVal,
      label: rawLabel || defaultLabel,
      enabled: true,
      builtIn: false
    });

    saveSources();
    renderSourcesList();
    e.target.reset();
    showToast('Added source to your list!');
  });

  // TAB 3: Toggle / Delete Source
  document.getElementById('sourcesList')?.addEventListener('click', (e) => {
    const toggle = e.target.closest('input[data-action="toggle-source"]');
    if (toggle) {
      const src = sources.find((s) => s.id === toggle.dataset.id);
      if (src) {
        src.enabled = toggle.checked;
        saveSources();
      }
      return;
    }

    const delBtn = e.target.closest('button[data-action="delete-source"]');
    if (delBtn) {
      sources = sources.filter((s) => s.id !== delBtn.dataset.id);
      saveSources();
      renderSourcesList();
      showToast('Source removed');
    }
  });

  document.getElementById('enableAllSourcesBtn')?.addEventListener('click', () => {
    sources.forEach((s) => (s.enabled = true));
    saveSources();
    renderSourcesList();
  });

  document.getElementById('disableAllSourcesBtn')?.addEventListener('click', () => {
    sources.forEach((s) => (s.enabled = false));
    saveSources();
    renderSourcesList();
  });

  // Settings Toggles
  nsfwToggle?.addEventListener('change', () => {
    settings.allowNsfw = nsfwToggle.checked;
    saveSettings();
    showToast(settings.allowNsfw ? '18+ search filter enabled' : '18+ search filter disabled');
  });

  autoPlayToggle?.addEventListener('change', () => {
    settings.autoPlay = autoPlayToggle.checked;
    saveSettings();
  });

  document.getElementById('resetSourcesBtn')?.addEventListener('click', () => {
    sources = structuredClone(DEFAULT_SOURCES);
    settings = { allowNsfw: false, autoPlay: true };
    if (nsfwToggle) nsfwToggle.checked = false;
    if (autoPlayToggle) autoPlayToggle.checked = true;
    videoQueue = [];
    currentIndex = -1;
    seenUrls.clear();
    saveSources();
    saveSettings();
    renderSourcesList();
    showToast('Reset to default sources & cleared session history');
  });

  // TAB 4: Vault Actions
  document.getElementById('vaultList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const all = await getAllVaultVideos();
    const item = all.find((v) => v.id === id);
    if (!item) return;

    if (btn.dataset.action === 'play-vault-item') {
      videoQueue.push(item);
      currentIndex = videoQueue.length - 1;
      switchTab('view-discover');
      updatePlayerUI();
    } else if (btn.dataset.action === 'download-vault-item') {
      await downloadVideoToIphone(item);
    } else if (btn.dataset.action === 'delete-vault-item') {
      await deleteVaultVideoDB(id);
      await renderVaultList();
      showToast('Removed from Vault');
    }
  });

  document.getElementById('clearVaultBtn')?.addEventListener('click', async () => {
    await clearVaultDB();
    await renderVaultList();
    showToast('Vault cleared');
  });

  // Install Modal
  const installModal = document.getElementById('installModal');
  document.getElementById('installGuideBtn')?.addEventListener('click', () => {
    installModal?.classList.remove('hidden');
  });
  document.getElementById('closeInstallModalBtn')?.addEventListener('click', () => {
    installModal?.classList.add('hidden');
  });
  document.getElementById('gotItModalBtn')?.addEventListener('click', () => {
    installModal?.classList.add('hidden');
  });
});
