// ReelVault — iPhone Random Video Discovery, Multi-Format Puller, Auto-Converter & Downloader PWA

const STORAGE_KEYS = {
  SOURCES: 'reelvault_sources_v1',
  SETTINGS: 'reelvault_settings_v1'
};

// Comprehensive catalog of video extensions across the internet:
// - iphoneNative: Plays directly in iPhone Safari <video>
// - photosNative: Accepted directly by iOS Share Sheet -> "Save Video" (Camera Roll) without conversion
const VIDEO_FORMAT_CATALOG = {
  mp4:  { ext: 'mp4',  mime: 'video/mp4',                      iphoneNative: true,  photosNative: true,  label: 'MP4' },
  mov:  { ext: 'mov',  mime: 'video/quicktime',                iphoneNative: true,  photosNative: true,  label: 'MOV' },
  m4v:  { ext: 'm4v',  mime: 'video/x-m4v',                    iphoneNative: true,  photosNative: true,  label: 'M4V' },
  '3gp':{ ext: '3gp',  mime: 'video/3gpp',                     iphoneNative: true,  photosNative: false, label: '3GP' },
  '3g2':{ ext: '3g2',  mime: 'video/3gpp2',                    iphoneNative: true,  photosNative: false, label: '3G2' },
  m3u8: { ext: 'm3u8', mime: 'application/vnd.apple.mpegurl',  iphoneNative: true,  photosNative: false, label: 'M3U8' },
  webm: { ext: 'webm', mime: 'video/webm',                     iphoneNative: true,  photosNative: false, label: 'WEBM' },
  ogv:  { ext: 'ogv',  mime: 'video/ogg',                      iphoneNative: false, photosNative: false, label: 'OGV' },
  ogg:  { ext: 'ogg',  mime: 'video/ogg',                      iphoneNative: false, photosNative: false, label: 'OGG' },
  mkv:  { ext: 'mkv',  mime: 'video/x-matroska',               iphoneNative: false, photosNative: false, label: 'MKV' },
  avi:  { ext: 'avi',  mime: 'video/x-msvideo',                iphoneNative: false, photosNative: false, label: 'AVI' },
  mpeg: { ext: 'mpeg', mime: 'video/mpeg',                     iphoneNative: false, photosNative: false, label: 'MPEG' },
  mpg:  { ext: 'mpg',  mime: 'video/mpeg',                     iphoneNative: false, photosNative: false, label: 'MPG' },
  flv:  { ext: 'flv',  mime: 'video/x-flv',                    iphoneNative: false, photosNative: false, label: 'FLV' },
  f4v:  { ext: 'f4v',  mime: 'video/mp4',                      iphoneNative: false, photosNative: false, label: 'F4V' },
  wmv:  { ext: 'wmv',  mime: 'video/x-ms-wmv',                 iphoneNative: false, photosNative: false, label: 'WMV' },
  ts:   { ext: 'ts',   mime: 'video/mp2t',                     iphoneNative: false, photosNative: false, label: 'TS' },
  m2ts: { ext: 'm2ts', mime: 'video/mp2t',                     iphoneNative: false, photosNative: false, label: 'M2TS' },
  gifv: { ext: 'gifv', mime: 'video/mp4',                      iphoneNative: true,  photosNative: true,  label: 'GIFV→MP4' }
};

const ALL_VIDEO_EXTENSIONS = Object.keys(VIDEO_FORMAT_CATALOG);
const VIDEO_EXT_REGEX_PATTERN = ALL_VIDEO_EXTENSIONS.join('|');

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

// Reliable public-domain / CC0 fallback clips across multiple formats so the player never fails offline/rate-limited
const FALLBACK_VIDEOS = [
  {
    id: 'fb-apollo11',
    title: 'Apollo 11 Saturn V Launch (NASA Archive)',
    videoUrl: 'https://archive.org/download/Apollo11Audio/Apollo11Launch.mp4',
    format: 'mp4',
    sourceName: 'Internet Archive (NASA)',
    pageUrl: 'https://archive.org/details/Apollo11Audio'
  },
  {
    id: 'fb-bigbuck',
    title: 'Big Buck Bunny — Open Movie Short Clip',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    format: 'mp4',
    sourceName: 'Open Movie Archive',
    pageUrl: 'https://peach.blender.org/'
  },
  {
    id: 'fb-forbiggerblazes',
    title: 'High Speed Nature & Fire Reel',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    format: 'mp4',
    sourceName: 'Open Media Stream',
    pageUrl: 'https://commondatastorage.googleapis.com/'
  },
  {
    id: 'fb-forbiggerescapes',
    title: 'Scenic Mountain & Alpine Escape Reel',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    format: 'mp4',
    sourceName: 'Open Media Stream',
    pageUrl: 'https://commondatastorage.googleapis.com/'
  },
  {
    id: 'fb-wearegoingonbullrun',
    title: 'Rally & Roadtrip Action Clip',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    format: 'mp4',
    sourceName: 'Open Media Stream',
    pageUrl: 'https://commondatastorage.googleapis.com/'
  }
];

// App State
let sources = [];
let settings = {
  allowNsfw: false,
  autoPlay: true,
  formatMode: 'all', // 'all' | 'native' | 'mp4'
  autoConvert: true
};
let videoQueue = [];
let currentIndex = -1;
let seenUrls = new Set();
let lastSearchResults = [];

// ==========================================
// FORMAT DETECTION & AUTO-CONVERSION HELPERS
// ==========================================

function detectVideoFormat(urlOrName, fallbackExt = 'mp4') {
  if (!urlOrName || typeof urlOrName !== 'string') {
    return VIDEO_FORMAT_CATALOG[fallbackExt] || VIDEO_FORMAT_CATALOG.mp4;
  }
  const clean = urlOrName.split('?')[0].split('#')[0].toLowerCase();
  const match = clean.match(new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})$`, 'i'));
  if (match && match[1]) {
    const ext = match[1].toLowerCase();
    if (VIDEO_FORMAT_CATALOG[ext]) {
      return VIDEO_FORMAT_CATALOG[ext];
    }
  }
  return VIDEO_FORMAT_CATALOG[fallbackExt] || VIDEO_FORMAT_CATALOG.mp4;
}

function isFormatAllowedBySettings(ext) {
  const cleanExt = (ext || 'mp4').toLowerCase().replace(/^\./, '');
  const info = VIDEO_FORMAT_CATALOG[cleanExt];
  if (!info) return false;

  if (settings.formatMode === 'mp4') {
    return cleanExt === 'mp4' || cleanExt === 'gifv';
  }
  if (settings.formatMode === 'native') {
    return Boolean(info.iphoneNative);
  }
  return true; // 'all' allows all supported extensions
}

function normalizeAndAutoRewriteVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleaned = rawUrl.replace(/&amp;/g, '&').trim();
  const fmtInfo = detectVideoFormat(cleaned);

  // Auto-convert .gifv (Imgur / web GIF-video wrappers) directly into .mp4
  if (fmtInfo.ext === 'gifv') {
    const mp4Url = cleaned.replace(/\.gifv(\?.*)?$/i, '.mp4$1');
    return {
      videoUrl: mp4Url,
      originalUrl: cleaned,
      convertedUrl: mp4Url,
      format: 'gifv',
      isAutoConverted: true
    };
  }

  return {
    videoUrl: cleaned,
    originalUrl: cleaned,
    convertedUrl: null,
    format: fmtInfo.ext,
    isAutoConverted: false
  };
}

function getFormatBadgeInfo(videoItem) {
  if (!videoItem) {
    return { text: 'MP4', className: 'format-badge hidden' };
  }
  const ext = (videoItem.format || detectVideoFormat(videoItem.originalUrl || videoItem.videoUrl).ext).toLowerCase();
  const info = VIDEO_FORMAT_CATALOG[ext] || VIDEO_FORMAT_CATALOG.mp4;

  if (videoItem.convertedBlobUrl || videoItem.isAutoConverted || ext === 'gifv') {
    const srcLabel = ext === 'gifv' ? 'GIFV' : info.label;
    return {
      text: `${srcLabel} → MP4 ✓`,
      className: 'format-badge converted'
    };
  }

  if (videoItem.convertedUrl && !info.photosNative && settings.autoConvert) {
    return {
      text: `${info.label} → MP4`,
      className: 'format-badge converted'
    };
  }

  if (info.photosNative) {
    return {
      text: `${info.label} • iPhone Native`,
      className: 'format-badge'
    };
  }

  if (info.iphoneNative) {
    return {
      text: settings.autoConvert ? `${info.label} • Auto-MP4` : `${info.label} • Stream`,
      className: 'format-badge convert'
    };
  }

  return {
    text: `${info.label} • Auto-Convert`,
    className: 'format-badge convert'
  };
}

function needsMp4Conversion(videoItem) {
  if (!videoItem) return false;
  if (videoItem.convertedBlobUrl) return false;
  const ext = (videoItem.format || detectVideoFormat(videoItem.videoUrl).ext).toLowerCase();
  const info = VIDEO_FORMAT_CATALOG[ext] || VIDEO_FORMAT_CATALOG.mp4;
  return !info.photosNative;
}

// ==========================================
// ON-DEVICE VIDEO AUTO-CONVERTER ENGINE
// (Derivative Resolution -> FFmpeg.wasm -> Native iOS MediaRecorder)
// ==========================================

let ffmpegInstance = null;
let ffmpegLoadingPromise = null;

async function loadFfmpegConverter(onStatus) {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = (async () => {
    if (onStatus) onStatus('Loading auto-converter engine...');
    // Load @ffmpeg/ffmpeg & @ffmpeg/util UMD scripts from jsDelivr CDN
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');

    const FFmpegWasm = window.FFmpegWASM?.FFmpeg;
    const toBlobURL = window.FFmpegUtil?.toBlobURL;
    if (!FFmpegWasm || !toBlobURL) {
      throw new Error('FFmpeg UMD globals not available');
    }

    const ffmpeg = new FFmpegWasm();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    const workerURL = await toBlobURL(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js',
      'text/javascript'
    );
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL: workerURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoadingPromise;
  } catch (err) {
    ffmpegLoadingPromise = null;
    throw err;
  }
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// Convert a downloaded video Blob into an iPhone-native .mp4 Blob using FFmpeg.wasm
async function transcodeBlobWithFfmpegWasm(sourceBlob, inputExt, onProgress) {
  const ffmpeg = await loadFfmpegConverter((msg) => onProgress?.(msg, 15));
  const safeExt = (inputExt || 'webm').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webm';
  const inputName = `input_${Date.now()}.${safeExt}`;
  const outputName = `output_${Date.now()}.mp4`;

  const progressHandler = ({ progress }) => {
    if (typeof progress === 'number' && isFinite(progress)) {
      const pct = Math.min(98, Math.max(20, Math.round(20 + progress * 78)));
      onProgress?.(`Auto-converting .${safeExt.toUpperCase()} to iPhone .MP4...`, pct);
    }
  };

  ffmpeg.on('progress', progressHandler);

  try {
    const uint8 = new Uint8Array(await sourceBlob.arrayBuffer());
    await ffmpeg.writeFile(inputName, uint8);

    // Try fast container stream copy first (instant for MKV/MOV/TS/FLV/AVI containing H.264)
    let remuxSucceeded = false;
    if (['mkv', 'mov', 'm4v', 'ts', 'm2ts', 'flv', 'f4v', 'avi'].includes(safeExt)) {
      onProgress?.(`Remuxing .${safeExt.toUpperCase()} container to .MP4...`, 35);
      const copyExitCode = await ffmpeg.exec([
        '-i', inputName,
        '-c', 'copy',
        '-movflags', '+faststart',
        outputName
      ]);
      if (copyExitCode === 0) {
        try {
          const copiedData = await ffmpeg.readFile(outputName);
          if (copiedData && copiedData.byteLength > 1024) {
            remuxSucceeded = true;
            return new Blob([copiedData.buffer], { type: 'video/mp4' });
          }
        } catch {
          remuxSucceeded = false;
        }
      }
    }

    // Full transcode to iPhone-compatible MP4 (MPEG-4 / H.264 + AAC with yuv420p)
    if (!remuxSucceeded) {
      onProgress?.(`Transcoding .${safeExt.toUpperCase()} to iPhone .MP4...`, 25);
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'mpeg4',
        '-q:v', '5',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName
      ]);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg transcode exited with code ${exitCode}`);
      }
      const data = await ffmpeg.readFile(outputName);
      if (!data || data.byteLength < 512) {
        throw new Error('FFmpeg produced empty output');
      }
      return new Blob([data.buffer], { type: 'video/mp4' });
    }
  } finally {
    ffmpeg.off('progress', progressHandler);
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
  }
}

// Native iOS Safari Hardware MediaRecorder('video/mp4') fallback converter
async function transcodeBlobWithMediaRecorder(sourceBlob, onProgress) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder not supported');
  }

  const supportedMp4Type = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/quicktime'
  ].find((t) => MediaRecorder.isTypeSupported(t));

  if (!supportedMp4Type) {
    throw new Error('Native video/mp4 MediaRecorder not supported on this browser');
  }

  return new Promise((resolve, reject) => {
    const srcUrl = URL.createObjectURL(sourceBlob);
    const tempVideo = document.createElement('video');
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.preload = 'auto';
    tempVideo.src = srcUrl;

    const cleanup = () => {
      try {
        tempVideo.pause();
        tempVideo.removeAttribute('src');
        tempVideo.load();
      } catch {}
      URL.revokeObjectURL(srcUrl);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Hardware conversion timed out'));
    }, 45000);

    tempVideo.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Browser could not decode source video for MediaRecorder'));
    };

    tempVideo.onloadedmetadata = async () => {
      try {
        const width = Math.min(1280, tempVideo.videoWidth || 640);
        const height = Math.min(720, tempVideo.videoHeight || 360);
        const canvas = document.createElement('canvas');
        canvas.width = width % 2 === 0 ? width : width - 1;
        canvas.height = height % 2 === 0 ? height : height - 1;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream ? canvas.captureStream(30) : null;
        if (!stream) {
          throw new Error('Canvas captureStream unavailable');
        }

        const chunks = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: supportedMp4Type,
          videoBitsPerSecond: 2_500_000
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          clearTimeout(timeout);
          cleanup();
          if (chunks.length === 0) {
            reject(new Error('No data recorded'));
            return;
          }
          resolve(new Blob(chunks, { type: 'video/mp4' }));
        };

        const drawFrame = () => {
          if (!tempVideo.paused && !tempVideo.ended) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            if (tempVideo.duration && isFinite(tempVideo.duration)) {
              const pct = Math.min(98, Math.round((tempVideo.currentTime / tempVideo.duration) * 100));
              onProgress?.('Hardware converting to iPhone .MP4...', pct);
            }
            requestAnimationFrame(drawFrame);
          }
        };

        tempVideo.onended = () => {
          if (recorder.state !== 'inactive') recorder.stop();
        };

        recorder.start(250);
        await tempVideo.play();
        drawFrame();
      } catch (err) {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      }
    };
  });
}

// Fetch video bytes with CORS proxy fallback and live progress
async function fetchVideoBlobWithProgress(targetUrl, mimeType, onProgress, progressLabel = 'Downloading video...') {
  let response = null;
  const candidateUrls = [
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        response = res;
        break;
      }
    } catch {
      // try next candidate
    }
  }

  if (!response) {
    throw new Error('Direct stream requires browser fallback');
  }

  const contentLength = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();

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
        onProgress?.(progressLabel, pct, `${pct}%`);
      } else {
        const mb = (received / (1024 * 1024)).toFixed(1);
        onProgress?.(progressLabel, 65, `${mb} MB`);
      }
    }
    return new Blob(chunks, { type: mimeType || 'video/mp4' });
  }

  const blob = await response.blob();
  return new Blob([blob], { type: mimeType || blob.type || 'video/mp4' });
}

// Unified pipeline: takes any videoItem and returns { blob, ext, mime, wasConverted } ready for iPhone
async function obtainIphoneReadyVideoBlob(videoItem, forceMp4Conversion = false, onProgress = null) {
  const ext = (videoItem.format || detectVideoFormat(videoItem.videoUrl).ext).toLowerCase();
  const fmtInfo = VIDEO_FORMAT_CATALOG[ext] || VIDEO_FORMAT_CATALOG.mp4;
  const shouldConvert = forceMp4Conversion || (settings.autoConvert && !fmtInfo.photosNative);

  // 1. If already converted on-device in this session, reuse the cached MP4 blob
  if (videoItem.convertedBlob instanceof Blob) {
    onProgress?.('Ready (.MP4 converted)', 100, '100%');
    return {
      blob: videoItem.convertedBlob,
      ext: 'mp4',
      mime: 'video/mp4',
      wasConverted: true
    };
  }

  // 2. If a server-transcoded .mp4 derivative URL is available (Archive.org / Wikimedia / Reddit / Imgur .gifv)
  if (shouldConvert && videoItem.convertedUrl) {
    try {
      const mp4Blob = await fetchVideoBlobWithProgress(
        videoItem.convertedUrl,
        'video/mp4',
        onProgress,
        `Pulling auto-converted .MP4 (from .${fmtInfo.label})...`
      );
      videoItem.convertedBlob = mp4Blob;
      videoItem.convertedBlobUrl = URL.createObjectURL(mp4Blob);
      return {
        blob: mp4Blob,
        ext: 'mp4',
        mime: 'video/mp4',
        wasConverted: true
      };
    } catch {
      // Fall through to on-device conversion of originalUrl/videoUrl
    }
  }

  // 3. Download the primary file
  const rawBlob = await fetchVideoBlobWithProgress(
    videoItem.videoUrl,
    fmtInfo.mime,
    onProgress,
    `Downloading .${fmtInfo.label} video...`
  );

  if (!shouldConvert) {
    return {
      blob: rawBlob,
      ext: fmtInfo.ext === 'gifv' ? 'mp4' : fmtInfo.ext,
      mime: fmtInfo.mime,
      wasConverted: false
    };
  }

  // 4. On-device conversion to .mp4 (FFmpeg.wasm -> Native iOS MediaRecorder fallback)
  let mp4Blob = null;
  try {
    mp4Blob = await transcodeBlobWithFfmpegWasm(rawBlob, fmtInfo.ext, (msg, pct) => {
      onProgress?.(msg, pct, `${pct}%`);
    });
  } catch {
    try {
      mp4Blob = await transcodeBlobWithMediaRecorder(rawBlob, (msg, pct) => {
        onProgress?.(msg, pct, `${pct}%`);
      });
    } catch {
      mp4Blob = null;
    }
  }

  if (mp4Blob) {
    videoItem.convertedBlob = mp4Blob;
    videoItem.convertedBlobUrl = URL.createObjectURL(mp4Blob);
    return {
      blob: mp4Blob,
      ext: 'mp4',
      mime: 'video/mp4',
      wasConverted: true
    };
  }

  // 5. Graceful fallback: if on-device transcode wasn't possible, return original or MP4-wrapped blob
  return {
    blob: rawBlob,
    ext: fmtInfo.iphoneNative ? fmtInfo.ext : 'mp4',
    mime: fmtInfo.iphoneNative ? fmtInfo.mime : 'video/mp4',
    wasConverted: false
  };
}

// ==========================================
// INDEXEDDB VAULT
// ==========================================

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
    // Avoid storing ephemeral blob URLs in IndexedDB
    const copy = { ...videoItem };
    delete copy.convertedBlob;
    delete copy.convertedBlobUrl;
    const record = {
      ...copy,
      id: copy.id || 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
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
  updateHeaderSummary();
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
    const modeLabel =
      settings.formatMode === 'mp4'
        ? '.mp4 only'
        : settings.formatMode === 'native'
        ? 'iPhone native formats'
        : 'All formats + Auto-Convert';
    el.textContent = `${enabledCount} source${enabledCount === 1 ? '' : 's'} • ${modeLabel}`;
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
// MULTI-FORMAT VIDEO DISCOVERY ENGINES
// ==========================================

function encodeArchiveFilePath(fileName) {
  return String(fileName || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

// 1. Internet Archive Engine (Supports .mp4, .mov, .m4v, .webm, .ogv, .mkv, .avi, .mpeg, .mpg, .3gp, .flv, .wmv + auto-derivative pairing)
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

  // Shuffle docs and inspect metadata of up to 6 items in parallel
  const shuffled = [...docs].sort(() => Math.random() - 0.5).slice(0, Math.min(6, limit));
  const results = [];

  await Promise.all(
    shuffled.map(async (doc) => {
      try {
        const metaRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        const files = meta?.files || [];

        // Collect all recognized video files in the item
        const videoFiles = files
          .filter((f) => {
            if (!f?.name || f.name.toLowerCase().includes('.ia.mp4')) return false;
            const clean = f.name.toLowerCase();
            const m = clean.match(new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})$`, 'i'));
            if (!m) return false;
            return isFormatAllowedBySettings(m[1]);
          })
          .map((f) => {
            const fmt = detectVideoFormat(f.name);
            return {
              file: f,
              ext: fmt.ext,
              size: Number(f.size) || 0
            };
          });

        if (videoFiles.length === 0) return;

        // Also locate a lightweight .mp4 derivative if present (for instant auto-conversion of .ogv/.avi/.mkv/.mpeg/.mov)
        const mp4Candidate =
          files.find(
            (f) =>
              f?.name &&
              f.name.toLowerCase().endsWith('.mp4') &&
              !f.name.toLowerCase().includes('.ia.mp4') &&
              (!f.size || Number(f.size) < 90_000_000)
          ) ||
          files.find((f) => f?.name && f.name.toLowerCase().endsWith('.mp4'));

        const mp4DerivativeUrl = mp4Candidate
          ? `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeArchiveFilePath(mp4Candidate.name)}`
          : null;

        // Filter to reasonable sizes (< 95MB when size metadata exists)
        const sizedPool = videoFiles.filter((vf) => !vf.size || vf.size < 95_000_000);
        const candidatePool = sizedPool.length > 0 ? sizedPool : videoFiles;

        // Pick a file: in 'all' mode, allow variety across formats (.mov, .webm, .ogv, .mkv, .mp4, .avi, .mpeg)
        const chosenEntry = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        if (!chosenEntry) return;

        const chosenUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeArchiveFilePath(
          chosenEntry.file.name
        )}`;

        results.push({
          id: `ia-${doc.identifier}-${chosenEntry.ext}`,
          title: doc.title || doc.identifier,
          videoUrl: chosenUrl,
          originalUrl: chosenUrl,
          convertedUrl: chosenEntry.ext !== 'mp4' ? mp4DerivativeUrl : null,
          format: chosenEntry.ext,
          sourceName: `Archive.org (${keyword})`,
          pageUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`
        });
      } catch {
        // ignore individual metadata error
      }
    })
  );

  return results;
}

// 2. Wikimedia Commons Video Search Engine (Pulls .webm, .ogv, .ogg, .mpeg, .mpg, .mov, .mp4 + auto-transcoded derivatives via videoinfo API)
async function searchWikimediaVideos(keyword, limit = 10) {
  const query = `${keyword} filetype:video`;
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrnamespace=6&gsrlimit=${limit}&prop=videoinfo&viprop=url|mime|size|derivatives&format=json&origin=*`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  const res = await fetch(apiUrl, { signal: controller.signal });
  clearTimeout(timer);
  if (!res.ok) return [];

  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  const results = [];

  for (const page of pages) {
    const info = page?.videoinfo?.[0] || page?.imageinfo?.[0];
    if (!info || !info.url) continue;

    const fmt = detectVideoFormat(info.url, 'webm');
    if (!isFormatAllowedBySettings(fmt.ext)) continue;

    // Inspect Wikimedia's pre-transcoded derivatives for an iPhone-ready MP4 or WebM stream
    const derivatives = Array.isArray(info.derivatives) ? info.derivatives : [];
    const mp4Deriv = derivatives.find(
      (d) => d?.src && (d.type?.includes('mp4') || d.src.toLowerCase().endsWith('.mp4'))
    );
    const webmDeriv = derivatives.find(
      (d) =>
        d?.src &&
        !d.src.endsWith('.ogv') &&
        (d.type?.includes('webm') || d.src.toLowerCase().endsWith('.webm')) &&
        Number(d.height || 0) <= 720
    );

    const cleanTitle = (page.title || 'Wikimedia Video')
      .replace(/^File:/i, '')
      .replace(new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})$`, 'i'), '')
      .replace(/_/g, ' ');

    results.push({
      id: `wiki-${page.pageid}`,
      title: cleanTitle,
      videoUrl: info.url,
      originalUrl: info.url,
      convertedUrl: mp4Deriv?.src || (!fmt.iphoneNative && webmDeriv?.src ? webmDeriv.src : null),
      format: fmt.ext,
      sourceName: `Wikimedia (${keyword})`,
      pageUrl: info.descriptionurl || info.url
    });
  }

  return results;
}

// 3. Reddit Subreddit or Global Keyword Video Search (Supports Reddit MP4, HLS .m3u8, GIF->MP4 variants, .gifv, .mov, .webm, .m4v, .mkv, etc.)
function extractRedditVideosFromListing(json, sourceLabel) {
  const children = json?.data?.children || [];
  const results = [];

  for (const child of children) {
    const post = child?.data;
    if (!post) continue;
    if (post.over_18 && !settings.allowNsfw) continue;

    // Check crosspost parent too
    const mediaPost = post.crosspost_parent_list?.[0] || post;

    let rawVideoUrl =
      mediaPost?.secure_media?.reddit_video?.fallback_url ||
      mediaPost?.media?.reddit_video?.fallback_url ||
      mediaPost?.preview?.reddit_video_preview?.fallback_url ||
      mediaPost?.preview?.images?.[0]?.variants?.mp4?.source?.url ||
      null;

    const hlsUrl =
      mediaPost?.secure_media?.reddit_video?.hls_url ||
      mediaPost?.media?.reddit_video?.hls_url ||
      null;

    // Check direct link to any video extension (.mp4, .mov, .m4v, .webm, .gifv, .ogv, .mkv, .avi, .3gp, .m3u8, etc.)
    if (!rawVideoUrl && typeof mediaPost.url === 'string') {
      const directMatch = mediaPost.url.match(
        new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})(\\?.*)?$`, 'i')
      );
      if (directMatch) {
        rawVideoUrl = mediaPost.url;
      }
    }

    if (!rawVideoUrl && hlsUrl && isFormatAllowedBySettings('m3u8')) {
      rawVideoUrl = hlsUrl;
    }

    if (rawVideoUrl) {
      const normalized = normalizeAndAutoRewriteVideoUrl(rawVideoUrl);
      if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;

      results.push({
        id: `rd-${post.id}`,
        title: post.title || 'Reddit Video Clip',
        videoUrl: normalized.videoUrl,
        originalUrl: normalized.originalUrl,
        convertedUrl: normalized.convertedUrl,
        format: normalized.format,
        isAutoConverted: normalized.isAutoConverted,
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

// 4. Custom URL / Webpage Multi-Format Video Scanner
async function scanUrlForVideos(targetUrl, customLabel = 'Web Scanner') {
  const trimmed = targetUrl.trim();

  // Direct video URL across any supported video extension
  const directRegex = new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})(\\?.*)?$`, 'i');
  if (directRegex.test(trimmed)) {
    const normalized = normalizeAndAutoRewriteVideoUrl(trimmed);
    const fileName = trimmed.split('/').pop().split('?')[0] || 'Direct Video';
    return [
      {
        id: `url-${Date.now()}`,
        title: decodeURIComponent(fileName),
        videoUrl: normalized.videoUrl,
        originalUrl: normalized.originalUrl,
        convertedUrl: normalized.convertedUrl,
        format: normalized.format,
        isAutoConverted: normalized.isAutoConverted,
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

  // Otherwise fetch raw text/JSON and extract all video links across all supported extensions
  const rawText = await fetchWithCorsFallback(trimmed, true);
  const foundUrls = new Set();

  // Absolute video URLs for all 19 extensions
  const absRegex = new RegExp(
    `https?:\\/\\/[^\\s"'<>\\\\]+\\.(?:${VIDEO_EXT_REGEX_PATTERN})(?:\\?[^\\s"'<>\\\\]*)?`,
    'gi'
  );
  let m;
  while ((m = absRegex.exec(rawText)) !== null) {
    foundUrls.add(m[0].replace(/&amp;/g, '&'));
  }

  // Relative video src/href/data-src/content attributes
  const relRegex = new RegExp(
    `(?:src|href|data-src|data-video|content)=["']([^"']+\\.(?:${VIDEO_EXT_REGEX_PATTERN})(?:\\?[^"']*)?)["']`,
    'gi'
  );
  while ((m = relRegex.exec(rawText)) !== null) {
    try {
      const resolved = new URL(m[1].replace(/&amp;/g, '&'), trimmed).href;
      foundUrls.add(resolved);
    } catch {
      // ignore invalid relative URL
    }
  }

  const results = [];
  let idx = 0;
  for (const vUrl of foundUrls) {
    const normalized = normalizeAndAutoRewriteVideoUrl(vUrl);
    if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;
    const shortName = vUrl.split('/').pop().split('?')[0] || `Video #${idx + 1}`;
    results.push({
      id: `scan-${Date.now()}-${idx}`,
      title: decodeURIComponent(shortName),
      videoUrl: normalized.videoUrl,
      originalUrl: normalized.originalUrl,
      convertedUrl: normalized.convertedUrl,
      format: normalized.format,
      isAutoConverted: normalized.isAutoConverted,
      sourceName: customLabel,
      pageUrl: trimmed
    });
    idx++;
  }

  return results;
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

function getEffectivePlaybackUrl(videoItem) {
  if (!videoItem) return '';
  if (videoItem.convertedBlobUrl) return videoItem.convertedBlobUrl;

  const ext = (videoItem.format || detectVideoFormat(videoItem.videoUrl).ext).toLowerCase();
  const fmtInfo = VIDEO_FORMAT_CATALOG[ext] || VIDEO_FORMAT_CATALOG.mp4;

  // If the original format isn't iPhone-native (e.g. .ogv, .mkv, .avi, .mpeg, .flv, .wmv) and a converted stream URL exists, use it automatically
  if (settings.autoConvert && !fmtInfo.iphoneNative && videoItem.convertedUrl) {
    return videoItem.convertedUrl;
  }

  return videoItem.videoUrl;
}

function updatePlayerUI() {
  const videoEl = document.getElementById('mainVideo');
  const titleEl = document.getElementById('videoTitle');
  const badgeEl = document.getElementById('videoSourceBadge');
  const formatBadgeEl = document.getElementById('videoFormatBadge');
  const convertNowBtn = document.getElementById('convertNowBtn');
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
    formatBadgeEl?.classList.add('hidden');
    convertNowBtn?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  savePhoneBtn.disabled = false;
  saveVaultBtn.disabled = false;

  titleEl.textContent = current.title || 'Untitled Video';
  badgeEl.textContent = current.sourceName || 'Random Feed';

  // Update Format Badge & Convert Button
  if (formatBadgeEl) {
    const fMeta = getFormatBadgeInfo(current);
    formatBadgeEl.textContent = fMeta.text;
    formatBadgeEl.className = fMeta.className;
  }

  if (convertNowBtn) {
    if (needsMp4Conversion(current)) {
      convertNowBtn.classList.remove('hidden');
      const extLabel = (current.format || 'video').toUpperCase();
      convertNowBtn.textContent = `🔄 Convert .${extLabel} to .MP4`;
    } else {
      convertNowBtn.classList.add('hidden');
    }
  }

  if (current.pageUrl) {
    origLink.href = current.pageUrl;
    origLink.classList.remove('hidden');
  } else {
    origLink.classList.add('hidden');
  }

  const targetPlayUrl = getEffectivePlaybackUrl(current);
  if (videoEl.src !== targetPlayUrl) {
    videoEl.dataset.autoConvertAttempted = 'false';
    videoEl.src = targetPlayUrl;
    videoEl.load();
    if (settings.autoPlay) {
      videoEl.play().catch(() => {
        // iOS may require user tap if unmuted; user can tap play on controls
      });
    }
  }
}

// Convert the currently active video in-place to .MP4 and reload the player
async function convertCurrentVideoForPlayer(videoItem) {
  if (!videoItem || videoItem.convertedBlobUrl) return;

  const statusBox = document.getElementById('downloadStatusBox');
  const statusText = document.getElementById('downloadStatusText');
  const statusPercent = document.getElementById('downloadStatusPercent');
  const progressBar = document.getElementById('downloadProgressBar');
  const convertNowBtn = document.getElementById('convertNowBtn');

  statusBox?.classList.remove('hidden');
  if (convertNowBtn) convertNowBtn.disabled = true;

  try {
    const result = await obtainIphoneReadyVideoBlob(videoItem, true, (label, pct, rightText) => {
      if (statusText) statusText.textContent = label;
      if (statusPercent) statusPercent.textContent = rightText || `${pct}%`;
      if (progressBar) progressBar.style.width = `${pct}%`;
    });

    if (!videoItem.convertedBlobUrl && result.blob) {
      videoItem.convertedBlob = result.blob;
      videoItem.convertedBlobUrl = URL.createObjectURL(result.blob);
    }
    videoItem.isAutoConverted = true;
    updatePlayerUI();
    showToast('Converted to iPhone-native .MP4!');
  } catch {
    showToast('Could not auto-convert this stream in browser.');
  } finally {
    if (convertNowBtn) convertNowBtn.disabled = false;
    setTimeout(() => {
      statusBox?.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }, 1000);
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
        showToast(`No matching videos found for "${customKeyword}". Try another keyword!`);
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
// DOWNLOAD TO IPHONE (PHOTOS / FILES) WITH AUTO-CONVERSION
// ==========================================

async function downloadVideoToIphone(videoItem) {
  if (!videoItem?.videoUrl) return;

  const statusBox = document.getElementById('downloadStatusBox');
  const statusText = document.getElementById('downloadStatusText');
  const statusPercent = document.getElementById('downloadStatusPercent');
  const progressBar = document.getElementById('downloadProgressBar');
  const saveBtn = document.getElementById('saveToPhoneBtn');

  statusBox?.classList.remove('hidden');
  if (statusText) statusText.textContent = 'Preparing video for iPhone...';
  if (statusPercent) statusPercent.textContent = '0%';
  if (progressBar) progressBar.style.width = '8%';
  if (saveBtn) saveBtn.disabled = true;

  const baseSlug = (videoItem.title || 'reelvault-video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'reelvault-video';

  try {
    const { blob, ext, mime, wasConverted } = await obtainIphoneReadyVideoBlob(
      videoItem,
      false,
      (label, pct, rightText) => {
        if (statusText) statusText.textContent = label;
        if (statusPercent) statusPercent.textContent = rightText || `${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;
      }
    );

    if (wasConverted) {
      videoItem.isAutoConverted = true;
      updatePlayerUI();
    }

    if (statusPercent) statusPercent.textContent = '100%';
    if (progressBar) progressBar.style.width = '100%';

    const cleanFileName = `${baseSlug}.${ext || 'mp4'}`;
    const file = new File([blob], cleanFileName, { type: mime || 'video/mp4' });

    // On iPhone Safari, navigator.share({ files }) opens the native sheet with "Save Video" (to Photos) & "Save to Files"
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      if (statusText) statusText.textContent = 'Opening iPhone Save menu...';
      await navigator.share({
        files: [file],
        title: videoItem.title || 'ReelVault Video'
      });
      showToast(
        wasConverted
          ? 'Auto-converted to .MP4! Tap "Save Video" for Photos.'
          : 'Saved! Choose "Save Video" for Photos app.'
      );
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
      showToast(
        wasConverted
          ? 'Auto-converted to .MP4 and downloaded!'
          : 'Video downloaded to your device!'
      );
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      // User dismissed iOS share sheet
      showToast('Share menu closed');
    } else {
      // Fallback: open direct link (prefer convertedUrl if present)
      const fallbackUrl = videoItem.convertedUrl || videoItem.videoUrl;
      const fallbackExt = detectVideoFormat(fallbackUrl).ext;
      const a = document.createElement('a');
      a.href = fallbackUrl;
      a.download = `${baseSlug}.${fallbackExt}`;
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
    listEl.innerHTML = `<p class="muted-center">No matching videos found for that query. Try another keyword or enable more engines/formats.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map((item, idx) => {
      const fMeta = getFormatBadgeInfo(item);
      return `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <div class="vli-badges">
            <span class="${fMeta.className}">${escapeHtml(fMeta.text)}</span>
            <span class="source-badge">${escapeHtml(item.sourceName)}</span>
          </div>
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
    `;
    })
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
    .map((item) => {
      const fMeta = getFormatBadgeInfo(item);
      return `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <div class="vli-badges">
            <span class="${fMeta.className}">${escapeHtml(fMeta.text)}</span>
            <span class="source-badge">${escapeHtml(item.sourceName || 'Saved')}</span>
          </div>
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
    `;
    })
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

  // Sync settings controls
  const nsfwToggle = document.getElementById('allowNsfwToggle');
  const autoPlayToggle = document.getElementById('autoPlayToggle');
  const formatModeSelect = document.getElementById('formatModeSelect');
  const autoConvertToggle = document.getElementById('autoConvertToggle');

  if (nsfwToggle) nsfwToggle.checked = Boolean(settings.allowNsfw);
  if (autoPlayToggle) autoPlayToggle.checked = Boolean(settings.autoPlay);
  if (formatModeSelect) formatModeSelect.value = settings.formatMode || 'all';
  if (autoConvertToggle) autoConvertToggle.checked = settings.autoConvert !== false;

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Auto-convert on playback error if a non-native format fails to decode directly on iPhone Safari
  const mainVideoEl = document.getElementById('mainVideo');
  mainVideoEl?.addEventListener('error', async () => {
    const current = videoQueue[currentIndex];
    if (!current || mainVideoEl.dataset.autoConvertAttempted === 'true') return;
    mainVideoEl.dataset.autoConvertAttempted = 'true';

    // If a pre-transcoded derivative URL exists and wasn't tried yet, switch to it immediately
    if (current.convertedUrl && mainVideoEl.src !== current.convertedUrl) {
      mainVideoEl.src = current.convertedUrl;
      mainVideoEl.load();
      if (settings.autoPlay) mainVideoEl.play().catch(() => {});
      return;
    }

    // Otherwise run on-device auto-conversion if enabled
    if (settings.autoConvert && !current.convertedBlobUrl) {
      showToast(`Auto-converting .${(current.format || 'video').toUpperCase()} for iPhone playback...`);
      await convertCurrentVideoForPlayer(current);
    }
  });

  // Manual / 1-Tap Convert to .MP4 button in Player
  document.getElementById('convertNowBtn')?.addEventListener('click', async () => {
    const current = videoQueue[currentIndex];
    if (current) {
      await convertCurrentVideoForPlayer(current);
    }
  });

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

  // TAB 2: Multi-Format Webpage Video Scanner Form
  document.getElementById('urlScanForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlInput = document.getElementById('urlScanInput')?.value?.trim();
    if (!urlInput) return;

    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
      listEl.innerHTML = `<p class="muted-center">Scanning page for downloadable video files (.mp4, .mov, .webm, .mkv, .ogv, etc.)...</p>`;
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
          sourceInput.placeholder = 'https://example.com/video.mov, .webm, .mkv, .mp4 or feed URL';
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

  // Settings Controls
  formatModeSelect?.addEventListener('change', () => {
    settings.formatMode = formatModeSelect.value || 'all';
    saveSettings();
    showToast(
      settings.formatMode === 'all'
        ? 'Pulling all video formats + auto-convert'
        : settings.formatMode === 'native'
        ? 'Pulling iPhone-native formats only'
        : 'Pulling strict .MP4 only'
    );
  });

  autoConvertToggle?.addEventListener('change', () => {
    settings.autoConvert = autoConvertToggle.checked;
    saveSettings();
    updatePlayerUI();
    showToast(
      settings.autoConvert
        ? 'Auto-convert to .MP4 enabled for iPhone'
        : 'Auto-convert disabled (saving original formats)'
    );
  });

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
    settings = {
      allowNsfw: false,
      autoPlay: true,
      formatMode: 'all',
      autoConvert: true
    };
    if (nsfwToggle) nsfwToggle.checked = false;
    if (autoPlayToggle) autoPlayToggle.checked = true;
    if (formatModeSelect) formatModeSelect.value = 'all';
    if (autoConvertToggle) autoConvertToggle.checked = true;
    videoQueue = [];
    currentIndex = -1;
    seenUrls.clear();
    saveSources();
    saveSettings();
    renderSourcesList();
    updatePlayerUI();
    showToast('Reset to default sources & settings');
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
