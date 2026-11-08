// ReelVault — iPhone Random Video Discovery, Multi-Format Puller, Auto-Converter, Reels Mode & Offline Vault PWA

const STORAGE_KEYS = {
  SOURCES: 'reelvault_sources_v1',
  SETTINGS: 'reelvault_settings_v1'
};

// Comprehensive catalog of 19 video extensions across the internet:
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
const VIDEO_EXT_END_REGEX = new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})$`, 'i');
const DIRECT_VIDEO_URL_REGEX = new RegExp(`\\.(${VIDEO_EXT_REGEX_PATTERN})([?#].*)?$`, 'i');
const GIFV_REPLACE_REGEX = /\.gifv([?#].*)?$/i;

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
    label: 'Prelinger & Vintage Cartoons',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-kw-space',
    type: 'keyword',
    value: 'nasa space launch',
    label: 'NASA Space & Science Library',
    enabled: true,
    builtIn: true
  },
  {
    id: 'src-kw-nature',
    type: 'keyword',
    value: 'ocean wildlife nature',
    label: 'Ocean & Wildlife Footage',
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

// Reliable public-domain / CC0 fallback clips so the player never fails offline/rate-limited
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
  autoConvert: true,
  autoAdvance: true,
  prebuffer: true,
  offlineVaultCache: true
};
let videoQueue = [];
let currentIndex = -1;
let seenUrls = new Set();
let lastSearchResults = [];
let isReelsFullscreen = false;
let isBackgroundRefilling = false;
let prebufferVideoEl = null;

// ==========================================
// FORMAT DETECTION & AUTO-CONVERSION HELPERS
// ==========================================

function detectVideoFormat(urlOrName, fallbackExt = 'mp4') {
  const fallback = (fallbackExt && VIDEO_FORMAT_CATALOG[fallbackExt.toLowerCase()]) || VIDEO_FORMAT_CATALOG.mp4;
  if (!urlOrName || typeof urlOrName !== 'string') {
    return fallback;
  }
  const clean = urlOrName.trim().split('?')[0].split('#')[0].toLowerCase();
  const match = clean.match(VIDEO_EXT_END_REGEX);
  if (match && match[1]) {
    const ext = match[1].toLowerCase();
    if (VIDEO_FORMAT_CATALOG[ext]) {
      return VIDEO_FORMAT_CATALOG[ext];
    }
  }
  return fallback;
}

function isFormatAllowedBySettings(ext) {
  if (!ext || typeof ext !== 'string') return false;
  const cleanExt = ext.toLowerCase().trim().replace(/^\./, '');
  if (!cleanExt) return false;
  const info = VIDEO_FORMAT_CATALOG[cleanExt];
  if (!info) return false;

  if (settings.formatMode === 'mp4') {
    return cleanExt === 'mp4' || cleanExt === 'gifv';
  }
  if (settings.formatMode === 'native') {
    return Boolean(info.iphoneNative);
  }
  return true; // 'all' allows all 19 supported extensions
}

function normalizeAndAutoRewriteVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleaned = rawUrl.replace(/&amp;/g, '&').trim();
  const fmtInfo = detectVideoFormat(cleaned);

  // Auto-convert .gifv (Imgur / web GIF-video wrappers) directly into .mp4
  if (fmtInfo.ext === 'gifv') {
    const mp4Url = cleaned.replace(GIFV_REPLACE_REGEX, '.mp4$1');
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
  if (videoItem.convertedBlobUrl || videoItem.offlineBlob) return false;
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
    await Promise.all([
      loadScriptOnce('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'),
      loadScriptOnce('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js')
    ]);

    const FFmpegWasm = window.FFmpegWASM?.FFmpeg;
    const toBlobURL = window.FFmpegUtil?.toBlobURL;
    if (!FFmpegWasm || !toBlobURL) {
      throw new Error('FFmpeg UMD globals not available');
    }

    const ffmpeg = new FFmpegWasm();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    const [workerURL, coreURL, wasmURL] = await Promise.all([
      toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js', 'text/javascript'),
      toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    ]);

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
  if (!videoItem || typeof videoItem !== 'object') {
    throw new Error('Invalid video item');
  }
  // 0. If the item has a cached offline Blob in IndexedDB Vault, use it immediately (0 network requests!)
  if (videoItem.offlineBlob instanceof Blob) {
    onProgress?.('Loaded from Offline Vault cache!', 100, '100%');
    return {
      blob: videoItem.offlineBlob,
      ext: videoItem.offlineExt || 'mp4',
      mime: videoItem.offlineMime || 'video/mp4',
      wasConverted: Boolean(videoItem.isAutoConverted)
    };
  }

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

  // 2. If a server-transcoded .mp4 derivative URL is available (Archive.org / Wikimedia / NASA / PeerTube / Reddit / .gifv)
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
// INDEXEDDB VAULT (WITH TRUE OFFLINE VIDEO BLOB CACHING)
// ==========================================

const DB_NAME = 'ReelVaultDB';
const DB_VERSION = 1;
const VAULT_STORE = 'vault_videos';
let cachedDbPromise = null;
let lastIndexedDbRef = null;

function openVaultDB() {
  if (cachedDbPromise && lastIndexedDbRef === indexedDB) {
    return cachedDbPromise;
  }
  lastIndexedDbRef = indexedDB;
  cachedDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      cachedDbPromise = null;
      reject(req.error);
    };
  });
  return cachedDbPromise;
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

async function saveVideoToVaultDB(videoItem, offlineBlobData = null) {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const copy = { ...videoItem };
    delete copy.convertedBlob;
    delete copy.convertedBlobUrl;
    delete copy.offlineObjectUrl;

    if (offlineBlobData?.blob instanceof Blob) {
      copy.offlineBlob = offlineBlobData.blob;
      copy.offlineMime = offlineBlobData.mime || 'video/mp4';
      copy.offlineExt = offlineBlobData.ext || 'mp4';
      copy.offlineSize = offlineBlobData.blob.size;
      copy.hasOfflineBlob = true;
    } else if (copy.offlineBlob instanceof Blob) {
      copy.offlineSize = copy.offlineBlob.size;
      copy.hasOfflineBlob = true;
    }

    const record = {
      ...copy,
      id: copy.id || 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      savedAt: copy.savedAt || Date.now()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

// Save video to Vault and optionally cache its full .MP4 bytes in IndexedDB for Airplane-Mode playback
async function saveAndCacheVideoToVault(videoItem, forceOfflineDownload = false) {
  const savedRecord = await saveVideoToVaultDB(videoItem);
  await renderVaultList();

  if (!forceOfflineDownload && !settings.offlineVaultCache) {
    showToast('Saved link to Vault!');
    return savedRecord;
  }

  // If we already have the blob in memory, store it immediately
  if (videoItem.convertedBlob instanceof Blob) {
    await saveVideoToVaultDB(savedRecord, {
      blob: videoItem.convertedBlob,
      ext: 'mp4',
      mime: 'video/mp4'
    });
    await renderVaultList();
    showToast('Saved & cached offline in Vault!');
    return savedRecord;
  }

  showToast('Saved to Vault! Caching video for offline playback...');
  try {
    const blobResult = await obtainIphoneReadyVideoBlob(videoItem, false);
    if (blobResult?.blob instanceof Blob) {
      await saveVideoToVaultDB(savedRecord, blobResult);
      await renderVaultList();
      const mb = (blobResult.blob.size / (1024 * 1024)).toFixed(1);
      showToast(`Cached offline in Vault (${mb} MB)!`);
    }
  } catch {
    // Metadata/link is still saved even if CORS prevented raw blob caching
  }
  return savedRecord;
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
  toastTimeout.unref?.();
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

function syncAgeGateUI() {
  const isAllowed = Boolean(settings.allowNsfw);
  const headerBtn = document.getElementById('ageGateToggleBtn');
  if (headerBtn) {
    headerBtn.textContent = isAllowed ? '🔞 18+ On' : '🔞 18+ Off';
    headerBtn.classList.toggle('active', isAllowed);
    headerBtn.setAttribute?.('aria-pressed', isAllowed ? 'true' : 'false');
  }
  const nsfwToggle = document.getElementById('allowNsfwToggle');
  if (nsfwToggle) {
    nsfwToggle.checked = isAllowed;
  }
}

function openAgeGateModal() {
  const modal = document.getElementById('ageGateModal');
  modal?.classList.remove('hidden');
}

function closeAgeGateModal() {
  const modal = document.getElementById('ageGateModal');
  modal?.classList.add('hidden');
  syncAgeGateUI();
}

function setAdultContentEnabled(enabled) {
  settings.allowNsfw = Boolean(enabled);
  sourcePoolCache.clear();
  saveSettings();
  syncAgeGateUI();
  showToast(
    settings.allowNsfw
      ? '🔞 18+ Adult Content Enabled'
      : '🔒 18+ Adult Content Disabled (Safe Mode)'
  );
}

// Fast fetch helper with timeout
async function fetchWithTimeout(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Fetch helper with parallel CORS proxy race for Reddit / third-party pages
async function fetchWithCorsFallback(url, asText = false) {
  try {
    const directRes = await fetchWithTimeout(url, 3500);
    if (directRes.ok) {
      return asText ? await directRes.text() : await directRes.json();
    }
  } catch {
    // Direct fetch blocked by CORS or timed out; race CORS proxies in parallel
  }

  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  const controllers = proxies.map(() => new AbortController());
  const timer = setTimeout(() => controllers.forEach((c) => c.abort()), 4500);
  timer.unref?.();

  try {
    return await Promise.any(
      proxies.map(async (candidate, idx) => {
        const res = await fetch(candidate, { signal: controllers[idx].signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = asText ? await res.text() : await res.json();
        // Cancel the slower proxy once the winner finishes
        controllers.forEach((c, i) => {
          if (i !== idx) c.abort();
        });
        return payload;
      })
    );
  } catch {
    throw new Error('Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// MULTI-ENGINE & MULTI-FORMAT VIDEO DISCOVERY
// ==========================================

function encodeArchiveFilePath(fileName) {
  return String(fileName || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

// 1. Internet Archive Engine (Supports all 19 video extensions + auto-derivative pairing)
async function searchInternetArchive(keyword, limit = 6, extraQueryFilter = '') {
  const safeQuery = keyword.replace(/["()]/g, ' ').trim();
  const nsfwFilter = settings.allowNsfw ? '' : ' AND NOT collection:(adult)';
  const collectionClause = extraQueryFilter ? ` AND ${extraQueryFilter}` : '';
  const q = `(${safeQuery}) AND mediatype:(movies)${collectionClause}${nsfwFilter}`;
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title&sort[]=downloads+desc&rows=25&page=1&output=json`;

  const res = await fetchWithTimeout(searchUrl, 4500);
  if (!res.ok) return [];

  const data = await res.json();
  const docs = data?.response?.docs || [];
  if (!docs.length) return [];

  const shuffled = [...docs].sort(() => Math.random() - 0.5).slice(0, Math.min(3, limit));
  const results = [];

  await Promise.all(
    shuffled.map(async (doc) => {
      try {
        const metaRes = await fetchWithTimeout(
          `https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`,
          3500
        );
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        const files = meta?.files || [];

        const videoFiles = files
          .filter((f) => {
            if (!f?.name || f.name.toLowerCase().includes('.ia.mp4')) return false;
            const m = f.name.toLowerCase().match(VIDEO_EXT_END_REGEX);
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

        const sizedPool = videoFiles.filter((vf) => !vf.size || vf.size < 95_000_000);
        const candidatePool = sizedPool.length > 0 ? sizedPool : videoFiles;
        const chosenEntry = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        if (!chosenEntry) return;

        const chosenUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeArchiveFilePath(
          chosenEntry.file.name
        )}`;

        const sourcePrefix = extraQueryFilter.includes('prelinger') ? 'Prelinger Archive' : 'Archive.org';
        results.push({
          id: `ia-${doc.identifier}-${chosenEntry.ext}`,
          title: doc.title || doc.identifier,
          videoUrl: chosenUrl,
          originalUrl: chosenUrl,
          convertedUrl: chosenEntry.ext !== 'mp4' ? mp4DerivativeUrl : null,
          format: chosenEntry.ext,
          sourceName: `${sourcePrefix} (${keyword})`,
          pageUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`
        });
      } catch {
        // ignore individual metadata error
      }
    })
  );

  return results;
}

// 2. Prelinger Retro Archives Engine (Vintage commercials, retro cartoons, ephemeral films)
async function searchPrelingerArchives(keyword, limit = 4) {
  return await searchInternetArchive(keyword, limit, 'collection:(prelinger)');
}

// 3. Wikimedia Commons Video Search Engine (Pulls .webm, .ogv, .ogg, .mpeg, .mpg, .mov, .mp4 + server derivatives)
async function searchWikimediaVideos(keyword, limit = 8) {
  const query = `${keyword} filetype:video`;
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrnamespace=6&gsrlimit=${limit}&prop=videoinfo&viprop=url|mime|size|derivatives&format=json&origin=*`;

  const res = await fetchWithTimeout(apiUrl, 4000);
  if (!res.ok) return [];

  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  const results = [];

  for (const page of pages) {
    const info = page?.videoinfo?.[0] || page?.imageinfo?.[0];
    if (!info || !info.url) continue;

    const fmt = detectVideoFormat(info.url, 'webm');
    if (!isFormatAllowedBySettings(fmt.ext)) continue;

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
      .replace(VIDEO_EXT_END_REGEX, '')
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

// 4. Reddit Subreddit or Global Keyword Video Search
function extractRedditVideosFromListing(json, sourceLabel) {
  const children = json?.data?.children || [];
  const results = [];

  for (const child of children) {
    const post = child?.data;
    if (!post) continue;
    if (post.over_18 && !settings.allowNsfw) continue;

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

    const candidateDirectUrl = mediaPost.url_overridden_by_dest || mediaPost.url;
    if (!rawVideoUrl && typeof candidateDirectUrl === 'string') {
      if (DIRECT_VIDEO_URL_REGEX.test(candidateDirectUrl)) {
        rawVideoUrl = candidateDirectUrl;
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
  const nsfwFlag = settings.allowNsfw ? '1' : '0';
  const sorts = ['hot', 'top', 'new'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
  const url = `https://www.reddit.com/r/${encodeURIComponent(cleanSub)}/${randomSort}.json?limit=35&include_over_18=${nsfwFlag}&raw_json=1`;

  const json = await fetchWithCorsFallback(url, false);
  return extractRedditVideosFromListing(json, `r/${cleanSub}`);
}

async function searchRedditVideosByKeyword(keyword) {
  const nsfwFlag = settings.allowNsfw ? '1' : '0';
  const sorts = ['relevance', 'hot', 'top'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
    keyword
  )}&type=link&sort=${randomSort}&include_over_18=${nsfwFlag}&limit=35&raw_json=1`;

  const json = await fetchWithCorsFallback(url, false);
  return extractRedditVideosFromListing(json, `Reddit (${keyword})`);
}

// 5. PeerTube Global Federated Search Engine (via SepiaSearch API + PeerTube Instance Video API)
async function searchPeerTubeVideos(keyword, limit = 4) {
  const nsfwParam = settings.allowNsfw ? 'both' : 'false';
  const searchUrl = `https://sepiasearch.org/api/v1/search/videos?search=${encodeURIComponent(
    keyword
  )}&count=12&nsfw=${nsfwParam}&sort=-match`;

  const res = await fetchWithTimeout(searchUrl, 4000);
  if (!res.ok) return [];

  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  if (!data.length) return [];

  const picked = [...data].sort(() => Math.random() - 0.5).slice(0, Math.min(3, limit));
  const results = [];

  await Promise.all(
    picked.map(async (item) => {
      try {
        const host = item?.account?.host || item?.channel?.host || (item?.url ? new URL(item.url).host : null);
        const uuid = item?.uuid || item?.shortUUID;
        if (!host || !uuid) return;

        const detailRes = await fetchWithTimeout(
          `https://${host}/api/v1/videos/${encodeURIComponent(uuid)}`,
          3500
        );
        if (!detailRes.ok) return;

        const detail = await detailRes.json();
        const directFiles = [
          ...(Array.isArray(detail?.files) ? detail.files : []),
          ...(Array.isArray(detail?.streamingPlaylists?.[0]?.files) ? detail.streamingPlaylists[0].files : [])
        ];

        const mp4File =
          directFiles.find((f) => (f?.fileDownloadUrl || f?.fileUrl) && Number(f.size || 0) < 90_000_000) ||
          directFiles[0];

        const hlsPlaylistUrl = detail?.streamingPlaylists?.[0]?.playlistUrl || null;
        const primaryUrl = mp4File?.fileDownloadUrl || mp4File?.fileUrl || hlsPlaylistUrl;
        if (!primaryUrl) return;

        const fmt = detectVideoFormat(primaryUrl, hlsPlaylistUrl === primaryUrl ? 'm3u8' : 'mp4');
        if (!isFormatAllowedBySettings(fmt.ext)) return;

        results.push({
          id: `pt-${uuid}`,
          title: item.name || detail.name || 'PeerTube Video',
          videoUrl: primaryUrl,
          originalUrl: primaryUrl,
          convertedUrl: fmt.ext !== 'mp4' && mp4File ? mp4File.fileDownloadUrl || mp4File.fileUrl : null,
          format: fmt.ext,
          sourceName: `PeerTube (${host})`,
          pageUrl: item.url || `https://${host}/w/${uuid}`
        });
      } catch {
        // ignore instance error
      }
    })
  );

  return results;
}

// 6. Lemmy & Mastodon Open Fediverse Video Feeds
async function searchFediverseVideos(keyword) {
  const cleanTag = keyword.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const results = [];

  const tasks = [
    // Mastodon Public Tag Timeline
    (async () => {
      if (!cleanTag) return;
      const mastoUrl = `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(cleanTag)}?limit=20`;
      const res = await fetchWithTimeout(mastoUrl, 4000);
      if (!res.ok) return;
      const statuses = await res.json();
      if (!Array.isArray(statuses)) return;

      for (const st of statuses) {
        if (st?.sensitive && !settings.allowNsfw) continue;
        const attachments = Array.isArray(st?.media_attachments) ? st.media_attachments : [];
        for (const att of attachments) {
          if ((att.type === 'video' || att.type === 'gifv') && att.url) {
            const fmt = detectVideoFormat(att.url, 'mp4');
            if (!isFormatAllowedBySettings(fmt.ext)) continue;
            const plainText = String(st.content || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            results.push({
              id: `masto-${att.id || st.id}`,
              title: plainText.slice(0, 75) || `Mastodon #${cleanTag} Clip`,
              videoUrl: att.url,
              originalUrl: att.url,
              convertedUrl: null,
              format: fmt.ext,
              sourceName: `Mastodon (#${cleanTag})`,
              pageUrl: st.url || att.url
            });
          }
        }
      }
    })(),
    // Lemmy Global Post Search
    (async () => {
      const lemmyUrl = `https://lemmy.world/api/v3/search?q=${encodeURIComponent(
        keyword
      )}&type_=Posts&sort=TopAll&limit=20`;
      const res = await fetchWithTimeout(lemmyUrl, 4000);
      if (!res.ok) return;
      const data = await res.json();
      const posts = Array.isArray(data?.posts) ? data.posts : [];

      for (const entry of posts) {
        const post = entry?.post;
        if (!post) continue;
        if (post.nsfw && !settings.allowNsfw) continue;
        const candidateUrl = post.url || post.embed_video_url;
        if (!candidateUrl || typeof candidateUrl !== 'string') continue;

        if (DIRECT_VIDEO_URL_REGEX.test(candidateUrl)) {
          const normalized = normalizeAndAutoRewriteVideoUrl(candidateUrl);
          if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;
          results.push({
            id: `lemmy-${post.id}`,
            title: post.name || 'Lemmy Video Post',
            videoUrl: normalized.videoUrl,
            originalUrl: normalized.originalUrl,
            convertedUrl: normalized.convertedUrl,
            format: normalized.format,
            isAutoConverted: normalized.isAutoConverted,
            sourceName: `Lemmy (${entry?.community?.name || 'fediverse'})`,
            pageUrl: post.ap_id || candidateUrl
          });
        }
      }
    })()
  ];

  await Promise.allSettled(tasks);
  return results;
}

// 7. NASA Image & Video Library API (Direct .mp4 / .mov / .m4v / .m3u8 space & science footage)
async function searchNasaVideos(keyword, limit = 4) {
  const apiUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(keyword)}&media_type=video`;
  const res = await fetchWithTimeout(apiUrl, 4000);
  if (!res.ok) return [];

  const json = await res.json();
  const items = Array.isArray(json?.collection?.items) ? json.collection.items : [];
  if (!items.length) return [];

  const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, Math.min(3, limit));
  const results = [];

  await Promise.all(
    shuffled.map(async (item) => {
      try {
        const meta = item?.data?.[0];
        const manifestUrl = item?.href;
        if (!meta || !manifestUrl) return;

        const mRes = await fetchWithTimeout(manifestUrl, 3000);
        if (!mRes.ok) return;
        const assetList = await mRes.json();
        if (!Array.isArray(assetList)) return;

        const videoAssets = assetList.filter(
          (u) =>
            typeof u === 'string' &&
            VIDEO_EXT_END_REGEX.test(u) &&
            isFormatAllowedBySettings(detectVideoFormat(u).ext)
        );
        if (!videoAssets.length) return;

        // Prefer mobile/medium mp4 for fast loading, or whatever allowed format is present
        const mp4Asset =
          videoAssets.find((u) => u.endsWith('~mobile.mp4')) ||
          videoAssets.find((u) => u.endsWith('~medium.mp4')) ||
          videoAssets.find((u) => u.toLowerCase().endsWith('.mp4'));

        const chosenAsset =
          settings.formatMode === 'all'
            ? videoAssets[Math.floor(Math.random() * videoAssets.length)]
            : mp4Asset || videoAssets[0];

        const secureChosen = chosenAsset.replace(/^http:\/\//i, 'https://');
        const secureMp4 = mp4Asset ? mp4Asset.replace(/^http:\/\//i, 'https://') : null;
        const fmt = detectVideoFormat(secureChosen, 'mp4');

        results.push({
          id: `nasa-${meta.nasa_id}`,
          title: meta.title || 'NASA Archival Video',
          videoUrl: secureChosen,
          originalUrl: secureChosen,
          convertedUrl: fmt.ext !== 'mp4' ? secureMp4 : null,
          format: fmt.ext,
          sourceName: 'NASA Video Library',
          pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`
        });
      } catch {
        // ignore individual asset error
      }
    })
  );

  return results;
}

// 8. Custom URL / Webpage Multi-Format Video Scanner
async function scanUrlForVideos(targetUrl, customLabel = 'Web Scanner') {
  const trimmed = targetUrl.trim();

  if (DIRECT_VIDEO_URL_REGEX.test(trimmed)) {
    const normalized = normalizeAndAutoRewriteVideoUrl(trimmed);
    const fileName = trimmed.split('/').pop().split('?')[0].split('#')[0] || 'Direct Video';
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

  if (trimmed.includes('reddit.com/r/')) {
    const match = trimmed.match(/reddit\.com\/r\/([^/?#]+)/i);
    if (match?.[1]) {
      return await fetchSubredditVideos(match[1]);
    }
  }

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

// In-memory source pool cache (3-minute TTL) for instant 0ms subsequent pulls
const sourcePoolCache = new Map();
const SOURCE_CACHE_TTL_MS = 180_000;

function getSourceCacheKey(source) {
  return `${source.type}:${String(source.value || '').toLowerCase()}:${settings.formatMode}:${settings.allowNsfw}`;
}

// Pull videos from a single source object with fast-first resolution & background pool caching
async function pullFromSource(source) {
  const cacheKey = getSourceCacheKey(source);
  const cached = sourcePoolCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SOURCE_CACHE_TTL_MS) {
    const unseen = cached.items.filter((item) => item?.videoUrl && !seenUrls.has(item.videoUrl));
    if (unseen.length >= 2) {
      return unseen;
    }
  }

  if (source.type === 'subreddit') {
    const items = await fetchSubredditVideos(source.value);
    if (items.length > 0) {
      sourcePoolCache.set(cacheKey, { items, timestamp: Date.now() });
    }
    return items;
  }
  if (source.type === 'url') {
    return await scanUrlForVideos(source.value, source.label || 'Custom URL');
  }

  // Default: 'keyword' -> race all 7 engines in parallel and resolve as soon as fast engines respond
  const combined = [];
  const cacheRecord = { items: combined, timestamp: Date.now() };
  sourcePoolCache.set(cacheKey, cacheRecord);

  const enginePromises = [
    searchWikimediaVideos(source.value, 5),
    searchNasaVideos(source.value, 3),
    searchRedditVideosByKeyword(source.value),
    searchInternetArchive(source.value, 3),
    searchPrelingerArchives(source.value, 2),
    searchPeerTubeVideos(source.value, 3),
    searchFediverseVideos(source.value)
  ];

  return new Promise((resolve) => {
    let remaining = enginePromises.length;
    let resolved = false;
    let graceTimer = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (graceTimer) clearTimeout(graceTimer);
      resolve([...combined]);
    };

    for (const p of enginePromises) {
      Promise.resolve(p)
        .then((items) => {
          if (Array.isArray(items) && items.length > 0) {
            combined.push(...items);
            cacheRecord.timestamp = Date.now();
            // As soon as the fastest engine yields videos, give a short 350ms grace window
            // for other fast engines, then resolve immediately without waiting for slow APIs
            if (!resolved && !graceTimer) {
              graceTimer = setTimeout(finish, 350);
              graceTimer.unref?.();
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          remaining--;
          if (remaining === 0) {
            finish();
          }
        });
    }
  });
}

// ==========================================
// PLAYER, BACKGROUND PRE-BUFFER & REELS MODE CONTROLLER
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
  if (videoItem.offlineObjectUrl) return videoItem.offlineObjectUrl;
  if (videoItem.offlineBlob instanceof Blob) {
    videoItem.offlineObjectUrl = URL.createObjectURL(videoItem.offlineBlob);
    return videoItem.offlineObjectUrl;
  }
  if (videoItem.convertedBlobUrl) return videoItem.convertedBlobUrl;

  const ext = (videoItem.format || detectVideoFormat(videoItem.videoUrl).ext).toLowerCase();
  const fmtInfo = VIDEO_FORMAT_CATALOG[ext] || VIDEO_FORMAT_CATALOG.mp4;

  if (settings.autoConvert && !fmtInfo.iphoneNative && videoItem.convertedUrl) {
    return videoItem.convertedUrl;
  }

  return videoItem.videoUrl;
}

// Silently pre-buffer the next video in the queue and top up the queue in the background
async function scheduleBackgroundQueuePrebuffer() {
  if (!settings.prebuffer) {
    document.getElementById('prebufferBadge')?.classList.add('hidden');
    return;
  }

  // 1. If fewer than 2 videos remain ahead of currentIndex, silently pull 2 more in the background
  const remainingAhead = videoQueue.length - 1 - currentIndex;
  if (remainingAhead < 2 && !isBackgroundRefilling && sources.some((s) => s.enabled)) {
    isBackgroundRefilling = true;
    try {
      const activeSources = sources.filter((s) => s.enabled);
      const randomSource = activeSources[Math.floor(Math.random() * activeSources.length)];
      if (randomSource) {
        const fetched = await pullFromSource(randomSource);
        const fresh = fetched.filter((item) => item?.videoUrl && !seenUrls.has(item.videoUrl));
        const picks = fresh.sort(() => Math.random() - 0.5).slice(0, 2);
        for (const p of picks) {
          seenUrls.add(p.videoUrl);
          videoQueue.push(p);
        }
        const queueEl = document.getElementById('queueCounter');
        if (queueEl && videoQueue.length > 0) {
          queueEl.textContent = `Video ${currentIndex + 1} of ${videoQueue.length}`;
        }
      }
    } catch {
      // silent background refill
    } finally {
      isBackgroundRefilling = false;
    }
  }

  // 2. Warm up the next video in the queue using an offscreen <video preload="auto"> element
  const nextItem = videoQueue[currentIndex + 1];
  const prebufferBadge = document.getElementById('prebufferBadge');
  if (!nextItem) {
    prebufferBadge?.classList.add('hidden');
    return;
  }

  const nextUrl = getEffectivePlaybackUrl(nextItem);
  if (!nextUrl) return;

  if (!prebufferVideoEl) {
    prebufferVideoEl = document.createElement('video');
    prebufferVideoEl.muted = true;
    prebufferVideoEl.playsInline = true;
    prebufferVideoEl.preload = 'auto';
    prebufferVideoEl.style.display = 'none';
    document.body.appendChild(prebufferVideoEl);
  }

  if (prebufferVideoEl.src !== nextUrl) {
    prebufferVideoEl.src = nextUrl;
    prebufferVideoEl.load();
  }
  nextItem.isPrebuffered = true;
  prebufferBadge?.classList.remove('hidden');
}

function toggleReelsFullscreen(forceState) {
  const stage = document.getElementById('videoStage');
  const hud = document.getElementById('reelsHudOverlay');
  if (!stage || !hud) return;

  isReelsFullscreen = typeof forceState === 'boolean' ? forceState : !isReelsFullscreen;
  stage.classList.toggle('reels-fullscreen', isReelsFullscreen);
  hud.classList.toggle('hidden', !isReelsFullscreen);

  if (isReelsFullscreen && currentIndex < 0 && videoQueue.length === 0) {
    pullRandomVideos(1);
  } else {
    updatePlayerUI();
  }
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
  const reelsHudBadge = document.getElementById('reelsHudBadge');
  const reelsHudTitle = document.getElementById('reelsHudTitle');

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

  const fMeta = getFormatBadgeInfo(current);
  titleEl.textContent = current.title || 'Untitled Video';
  badgeEl.textContent = current.sourceName || 'Random Feed';

  if (reelsHudBadge) {
    reelsHudBadge.textContent = `${current.sourceName || 'Reel'} • ${fMeta.text}`;
  }
  if (reelsHudTitle) {
    reelsHudTitle.textContent = current.title || 'Untitled Video';
  }

  if (formatBadgeEl) {
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

  // Trigger background pre-buffering for the upcoming video
  scheduleBackgroundQueuePrebuffer();
}

function advanceToNextVideo() {
  if (currentIndex < videoQueue.length - 1) {
    currentIndex++;
    updatePlayerUI();
  } else {
    pullRandomVideos(1);
  }
}

function goToPrevVideo() {
  if (currentIndex > 0) {
    currentIndex--;
    updatePlayerUI();
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
    const hideTimer = setTimeout(() => {
      statusBox?.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }, 1000);
    hideTimer.unref?.();
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

    let fresh = pool.filter((item) => item?.videoUrl && !seenUrls.has(item.videoUrl));
    if (fresh.length === 0 && pool.length > 0) {
      seenUrls.clear();
      fresh = pool;
    }

    if (fresh.length === 0) {
      if (customKeyword) {
        showToast(`No matching videos found for "${customKeyword}". Try another keyword!`);
        setPlayerLoading(false);
        return;
      }
      fresh = [...FALLBACK_VIDEOS];
    }

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
  if (!videoItem?.videoUrl && !videoItem?.offlineBlob) return;

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
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cleanFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      const revokeTimer = setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      revokeTimer.unref?.();
      showToast(
        wasConverted
          ? 'Auto-converted to .MP4 and downloaded!'
          : 'Video downloaded to your device!'
      );
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      showToast('Share menu closed');
    } else {
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
    const hideTimer = setTimeout(() => {
      statusBox?.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }, 1200);
    hideTimer.unref?.();
  }
}

// ==========================================
// RENDER SOURCES, SEARCH RESULTS & OFFLINE VAULT
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
  const summaryEl = document.getElementById('vaultStorageSummary');

  if (badgeEl) {
    if (items.length > 0) {
      badgeEl.textContent = String(items.length);
      badgeEl.classList.remove('hidden');
    } else {
      badgeEl.classList.add('hidden');
    }
  }

  const totalOfflineBytes = items.reduce((acc, item) => acc + (Number(item.offlineSize) || 0), 0);
  const totalOfflineMb = (totalOfflineBytes / (1024 * 1024)).toFixed(1);
  if (summaryEl) {
    summaryEl.textContent =
      totalOfflineBytes > 0
        ? `${items.length} saved • ${totalOfflineMb} MB cached offline`
        : `${items.length} video${items.length === 1 ? '' : 's'} saved`;
  }

  if (!listEl) return;
  if (items.length === 0) {
    listEl.innerHTML = `<p class="muted-center">No videos saved in your Vault yet. Tap "📥 Vault" (or double-tap any video) to save it here for offline replay.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const fMeta = getFormatBadgeInfo(item);
      const isOfflineReady = Boolean(item.hasOfflineBlob || item.offlineBlob);
      const sizeMb = item.offlineSize ? `${(item.offlineSize / (1024 * 1024)).toFixed(1)} MB` : '';
      const offlineBadgeHtml = isOfflineReady
        ? `<span class="offline-badge">✅ Offline ${sizeMb}</span>`
        : `<button class="btn-inline-convert" data-action="cache-vault-item" data-id="${escapeHtml(item.id)}">☁️ Cache Offline</button>`;

      return `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <div class="vli-badges">
            ${offlineBadgeHtml}
            <span class="${fMeta.className}">${escapeHtml(fMeta.text)}</span>
            <span class="source-badge">${escapeHtml(item.sourceName || 'Saved')}</span>
          </div>
        </div>
        <div class="vli-actions">
          <button class="btn-primary btn-mini" data-action="play-vault-item" data-id="${escapeHtml(item.id)}">
            ▶ Watch ${isOfflineReady ? '(Offline)' : ''}
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
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// SAFARI "SEND TO REELVAULT" BOOKMARKLET & URL PARAMS
// ==========================================

function initBookmarkletAndUrlParams() {
  const baseAppUrl = `${window.location.origin}${window.location.pathname}`;
  const bookmarkletCode = `javascript:(function(){window.location.href='${baseAppUrl}?scan='+encodeURIComponent(window.location.href);})();`;

  const codeInput = document.getElementById('bookmarkletCodeInput');
  if (codeInput) {
    codeInput.value = bookmarkletCode;
  }

  document.getElementById('copyBookmarkletBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      showToast('Copied Safari Bookmarklet code!');
    } catch {
      if (codeInput) {
        codeInput.select();
        document.execCommand('copy');
        showToast('Copied Safari Bookmarklet code!');
      }
    }
  });

  // Check if launched via Safari Bookmarklet (?scan=URL or ?url=URL) or quick query (?q=keyword)
  const params = new URLSearchParams(window.location.search);
  const scanTarget = params.get('scan') || params.get('url');
  const queryTarget = params.get('q');

  if (scanTarget) {
    switchTab('view-search');
    const urlScanInput = document.getElementById('urlScanInput');
    if (urlScanInput) urlScanInput.value = scanTarget;
    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
      listEl.innerHTML = `<p class="muted-center">Scanning "${escapeHtml(scanTarget)}" for downloadable videos...</p>`;
    }
    scanUrlForVideos(scanTarget, 'Safari Bookmarklet')
      .then((found) => {
        renderSearchResults(found);
        showToast(`Found ${found.length} video(s) from Safari page!`);
      })
      .catch(() => {
        renderSearchResults([]);
        showToast('Could not scan that URL due to site security restrictions.');
      });
  } else if (queryTarget) {
    pullRandomVideos(1, queryTarget);
  }
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  updateHeaderSummary();
  renderSourcesList();
  await renderVaultList();
  initBookmarkletAndUrlParams();

  // Sync settings controls
  const nsfwToggle = document.getElementById('allowNsfwToggle');
  const autoPlayToggle = document.getElementById('autoPlayToggle');
  const formatModeSelect = document.getElementById('formatModeSelect');
  const autoConvertToggle = document.getElementById('autoConvertToggle');
  const autoAdvanceToggle = document.getElementById('autoAdvanceToggle');
  const prebufferToggle = document.getElementById('prebufferToggle');
  const offlineVaultToggle = document.getElementById('offlineVaultToggle');

  if (nsfwToggle) nsfwToggle.checked = Boolean(settings.allowNsfw);
  syncAgeGateUI();
  if (autoPlayToggle) autoPlayToggle.checked = Boolean(settings.autoPlay);
  if (formatModeSelect) formatModeSelect.value = settings.formatMode || 'all';
  if (autoConvertToggle) autoConvertToggle.checked = settings.autoConvert !== false;
  if (autoAdvanceToggle) autoAdvanceToggle.checked = settings.autoAdvance !== false;
  if (prebufferToggle) prebufferToggle.checked = settings.prebuffer !== false;
  if (offlineVaultToggle) offlineVaultToggle.checked = settings.offlineVaultCache !== false;

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const mainVideoEl = document.getElementById('mainVideo');

  // Auto-Advance on Video End
  mainVideoEl?.addEventListener('ended', () => {
    if (settings.autoAdvance) {
      advanceToNextVideo();
    }
  });

  // Auto-convert on playback error if a non-native format fails to decode directly on iPhone Safari
  mainVideoEl?.addEventListener('error', async () => {
    const current = videoQueue[currentIndex];
    if (!current || mainVideoEl.dataset.autoConvertAttempted === 'true') return;
    mainVideoEl.dataset.autoConvertAttempted = 'true';

    if (current.convertedUrl && mainVideoEl.src !== current.convertedUrl) {
      mainVideoEl.src = current.convertedUrl;
      mainVideoEl.load();
      if (settings.autoPlay) mainVideoEl.play().catch(() => {});
      return;
    }

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

  // Fullscreen Vertical Swipe (Reels) Mode Controls
  document.getElementById('reelsModeBtn')?.addEventListener('click', () => {
    toggleReelsFullscreen(true);
  });
  document.getElementById('exitReelsModeBtn')?.addEventListener('click', () => {
    toggleReelsFullscreen(false);
  });
  document.getElementById('reelsNextBtn')?.addEventListener('click', () => {
    advanceToNextVideo();
  });
  document.getElementById('reelsSavePhoneBtn')?.addEventListener('click', () => {
    const current = videoQueue[currentIndex];
    if (current) downloadVideoToIphone(current);
  });
  document.getElementById('reelsVaultBtn')?.addEventListener('click', async () => {
    const current = videoQueue[currentIndex];
    if (current) await saveAndCacheVideoToVault(current);
  });

  // Bottom Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isReelsFullscreen) toggleReelsFullscreen(false);
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
    advanceToNextVideo();
  });

  document.getElementById('prevVideoBtn')?.addEventListener('click', () => {
    goToPrevVideo();
  });

  // Swipe Left/Right AND Vertical Swipe Up/Down (in Reels Mode) + Double-Tap to Vault on Video Stage
  const stage = document.getElementById('videoStage');
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTapTime = 0;

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
    async (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;

      // Horizontal Swipe (Left = Next, Right = Prev)
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          advanceToNextVideo();
        } else {
          goToPrevVideo();
        }
        return;
      }

      // Vertical Swipe in Fullscreen Reels Mode (Swipe Up = Next, Swipe Down = Prev)
      if (isReelsFullscreen && Math.abs(dy) > 65 && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) {
          advanceToNextVideo();
        } else {
          goToPrevVideo();
        }
        return;
      }

      // Double-tap on video stage to save to Offline Vault
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && !e.target.closest('button')) {
        const now = Date.now();
        if (now - lastTapTime < 280) {
          const current = videoQueue[currentIndex];
          if (current) {
            const fb = document.getElementById('doubleTapFeedback');
            fb?.classList.remove('hidden');
            setTimeout(() => fb?.classList.add('hidden'), 1100);
            await saveAndCacheVideoToVault(current);
          }
        }
        lastTapTime = now;
      }
    },
    { passive: true }
  );

  // Batch Pull 5 Random Videos
  document.getElementById('batchPullBtn')?.addEventListener('click', () => {
    pullRandomVideos(5);
  });

  // Save to iPhone & Save to Offline Vault
  document.getElementById('saveToPhoneBtn')?.addEventListener('click', () => {
    const current = videoQueue[currentIndex];
    if (current) downloadVideoToIphone(current);
  });

  document.getElementById('saveToVaultBtn')?.addEventListener('click', async () => {
    const current = videoQueue[currentIndex];
    if (!current) return;
    await saveAndCacheVideoToVault(current);
  });

  // TAB 2: Multi-Engine Search Form (All 7 Open Networks)
  document.getElementById('deepSearchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('deepSearchInput')?.value?.trim();
    if (!query) return;

    const useArchive = document.getElementById('engArchive')?.checked;
    const usePrelinger = document.getElementById('engPrelinger')?.checked;
    const useWiki = document.getElementById('engWikimedia')?.checked;
    const useReddit = document.getElementById('engReddit')?.checked;
    const usePeerTube = document.getElementById('engPeerTube')?.checked;
    const useFediverse = document.getElementById('engFediverse')?.checked;
    const useNasa = document.getElementById('engNasa')?.checked;

    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
      listEl.innerHTML = `<p class="muted-center">Searching selected open video networks for "${escapeHtml(query)}"...</p>`;
    }

    const tasks = [];
    if (useArchive) tasks.push(searchInternetArchive(query, 6));
    if (usePrelinger) tasks.push(searchPrelingerArchives(query, 5));
    if (useWiki) tasks.push(searchWikimediaVideos(query, 8));
    if (useReddit) tasks.push(searchRedditVideosByKeyword(query));
    if (usePeerTube) tasks.push(searchPeerTubeVideos(query, 6));
    if (useFediverse) tasks.push(searchFediverseVideos(query));
    if (useNasa) tasks.push(searchNasaVideos(query, 6));

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
      await saveAndCacheVideoToVault(item);
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

  autoAdvanceToggle?.addEventListener('change', () => {
    settings.autoAdvance = autoAdvanceToggle.checked;
    saveSettings();
    showToast(settings.autoAdvance ? 'Auto-advance on video end enabled' : 'Auto-advance disabled');
  });

  prebufferToggle?.addEventListener('change', () => {
    settings.prebuffer = prebufferToggle.checked;
    saveSettings();
    if (settings.prebuffer) {
      scheduleBackgroundQueuePrebuffer();
      showToast('Background queue pre-buffering enabled');
    } else {
      document.getElementById('prebufferBadge')?.classList.add('hidden');
      showToast('Background pre-buffering disabled');
    }
  });

  offlineVaultToggle?.addEventListener('change', () => {
    settings.offlineVaultCache = offlineVaultToggle.checked;
    saveSettings();
    showToast(
      settings.offlineVaultCache
        ? 'Offline video file caching enabled for Vault'
        : 'Vault will save lightweight links only'
    );
  });

  // 18+ Age Verification Toggle Button (Top Header) & Settings Switch
  document.getElementById('ageGateToggleBtn')?.addEventListener('click', () => {
    if (settings.allowNsfw) {
      setAdultContentEnabled(false);
    } else {
      openAgeGateModal();
    }
  });

  nsfwToggle?.addEventListener('change', () => {
    if (nsfwToggle.checked) {
      nsfwToggle.checked = false;
      openAgeGateModal();
    } else {
      setAdultContentEnabled(false);
    }
  });

  document.getElementById('confirmAgeGateBtn')?.addEventListener('click', () => {
    setAdultContentEnabled(true);
    closeAgeGateModal();
  });

  document.getElementById('cancelAgeGateBtn')?.addEventListener('click', () => {
    setAdultContentEnabled(false);
    closeAgeGateModal();
  });

  document.getElementById('closeAgeGateModalBtn')?.addEventListener('click', () => {
    closeAgeGateModal();
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
      autoConvert: true,
      autoAdvance: true,
      prebuffer: true,
      offlineVaultCache: true
    };
    if (nsfwToggle) nsfwToggle.checked = false;
    if (autoPlayToggle) autoPlayToggle.checked = true;
    if (formatModeSelect) formatModeSelect.value = 'all';
    if (autoConvertToggle) autoConvertToggle.checked = true;
    if (autoAdvanceToggle) autoAdvanceToggle.checked = true;
    if (prebufferToggle) prebufferToggle.checked = true;
    if (offlineVaultToggle) offlineVaultToggle.checked = true;
    videoQueue = [];
    currentIndex = -1;
    seenUrls.clear();
    saveSources();
    saveSettings();
    syncAgeGateUI();
    renderSourcesList();
    updatePlayerUI();
    showToast('Reset to default sources & settings');
  });

  // TAB 4: Vault Actions (Play Offline, Export, Cache Offline on demand, Delete)
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
    } else if (btn.dataset.action === 'cache-vault-item') {
      btn.disabled = true;
      btn.textContent = '⏳ Caching...';
      await saveAndCacheVideoToVault(item, true);
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    VIDEO_FORMAT_CATALOG,
    ALL_VIDEO_EXTENSIONS,
    VIDEO_EXT_REGEX_PATTERN,
    DEFAULT_SOURCES,
    FALLBACK_VIDEOS,
    settings,
    detectVideoFormat,
    isFormatAllowedBySettings,
    normalizeAndAutoRewriteVideoUrl,
    getFormatBadgeInfo,
    getEffectivePlaybackUrl,
    needsMp4Conversion,
    encodeArchiveFilePath,
    extractRedditVideosFromListing,
    escapeHtml,
    obtainIphoneReadyVideoBlob,
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
    syncAgeGateUI,
    openAgeGateModal,
    closeAgeGateModal,
    setAdultContentEnabled,
    showToast,
    getAppState: () => ({
      sources,
      settings,
      videoQueue,
      currentIndex,
      isReelsFullscreen,
      lastSearchResults
    }),
    setAppState: (patch = {}) => {
      if (Array.isArray(patch.sources)) sources = patch.sources;
      if (Array.isArray(patch.videoQueue)) videoQueue = patch.videoQueue;
      if (typeof patch.currentIndex === 'number') currentIndex = patch.currentIndex;
      if (typeof patch.isReelsFullscreen === 'boolean') isReelsFullscreen = patch.isReelsFullscreen;
      if (Array.isArray(patch.lastSearchResults)) lastSearchResults = patch.lastSearchResults;
    }
  };
}
