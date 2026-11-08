// ReelVault — iPhone Random Video Discovery, Multi-Format Puller, Auto-Converter, Reels Mode & Offline Vault PWA

const STORAGE_KEYS = {
  SOURCES: 'reelvault_sources_v1',
  SETTINGS: 'reelvault_settings_v1',
  PLAYBACK_STATE: 'reelvault_playback_state_v1'
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

// Curated 18+ source pack that unlocks when 18+ mode is enabled and hides in Safe Mode
const ADULT_PRESET_SOURCES = [
  {
    id: 'src-nsfw-redgifs',
    type: 'keyword',
    value: 'redgifs',
    label: '🔞 RedGIFs HD Trending',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-sub-nsfw',
    type: 'subreddit',
    value: 'nsfw',
    label: '🔞 r/NSFW Highlights',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-sub-gifs',
    type: 'subreddit',
    value: 'NSFW_GIF',
    label: '🔞 r/NSFW_GIF Loops',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-tube-hd',
    type: 'keyword',
    value: 'amateur hd',
    label: '🔞 Free Tube HD Picks',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-vintage',
    type: 'keyword',
    value: 'vintage erotica',
    label: '🔞 Vintage 18+ Archive',
    enabled: true,
    builtIn: true,
    isNsfw: true
  }
];

const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Expandable 18+ Subreddit & Niche Directory Catalog
const ADULT_DIRECTORY_CATALOG = [
  {
    category: '🔥 Popular 18+ Subreddits',
    items: [
      { id: 'dir-sub-nsfw', type: 'subreddit', value: 'nsfw', label: 'r/nsfw — Top Adult Feed', isNsfw: true },
      { id: 'dir-sub-nsfw-gif', type: 'subreddit', value: 'NSFW_GIF', label: 'r/NSFW_GIF — HD Loops', isNsfw: true },
      { id: 'dir-sub-realgirls', type: 'subreddit', value: 'RealGirls', label: 'r/RealGirls — Verified', isNsfw: true },
      { id: 'dir-sub-amateur', type: 'subreddit', value: 'Amateur', label: 'r/Amateur — Homemade', isNsfw: true },
      { id: 'dir-sub-gonewild', type: 'subreddit', value: 'gonewild', label: 'r/gonewild — Community', isNsfw: true },
      { id: 'dir-sub-sensual', type: 'subreddit', value: 'sensual', label: 'r/sensual — Romantic 18+', isNsfw: true }
    ]
  },
  {
    category: '🎬 RedGIFs HD & Loop Niches',
    items: [
      { id: 'dir-rg-trending', type: 'keyword', value: 'redgifs trending', label: 'RedGIFs Trending HD', isNsfw: true },
      { id: 'dir-rg-amateur', type: 'keyword', value: 'redgifs amateur hd', label: 'RedGIFs Amateur Clips', isNsfw: true },
      { id: 'dir-rg-solo', type: 'keyword', value: 'redgifs solo tease', label: 'RedGIFs Solo & Tease', isNsfw: true },
      { id: 'dir-rg-cosplay', type: 'keyword', value: 'redgifs cosplay', label: 'RedGIFs Cosplay 18+', isNsfw: true }
    ]
  },
  {
    category: '📺 Full-Length 18+ Tube & Archive',
    items: [
      { id: 'dir-tube-romantic', type: 'keyword', value: 'romantic sensual hd', label: 'Romantic & Couples HD', isNsfw: true },
      { id: 'dir-tube-amateur', type: 'keyword', value: 'amateur homemade hd', label: 'Full-Length Amateur HD', isNsfw: true },
      { id: 'dir-tube-vintage', type: 'keyword', value: 'vintage erotica classic', label: 'Vintage & Classic Erotica', isNsfw: true },
      { id: 'dir-tube-massage', type: 'keyword', value: 'sensual massage hd', label: 'Sensual Massage HD', isNsfw: true }
    ]
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
  nsfwMode: 'mixed', // 'safe' | 'mixed' | 'strict'
  autoMuteNsfw: true,
  resumePlayback: true,
  discreetFilenames: true,
  nsfwPin: '',
  nsfwBiometricId: '',
  tubeDurationFilter: 'all', // 'all' | 'short' | 'medium' | 'long'
  tubeQualityFilter: 'all', // 'all' | 'hd'
  vaultFilter: 'all', // 'all' | 'favorites' | 'nsfw' | 'nsfw_favorites' | 'sfw'
  playbackSpeed: 1,
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
let playbackPositions = {};
let isReelsFullscreen = false;
let isAdultDirectoryExpanded = false;
let isBackgroundRefilling = false;
let prebufferVideoEl = null;
let cachedRedgifsToken = null;
let cachedRedgifsTokenExpiry = 0;

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

// Parse an HLS .m3u8 manifest (Master Playlist or Media Segment Playlist)
function parseM3u8Manifest(manifestText, baseUrl) {
  if (!manifestText || typeof manifestText !== 'string') {
    return { type: 'invalid', variants: [], preferredVariantUrl: null, initSegmentUrl: null, segments: [] };
  }

  const lines = manifestText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const resolveUrl = (rawUri) => {
    try {
      return new URL(rawUri, baseUrl).href;
    } catch {
      return rawUri;
    }
  };

  // 1. Check if this is a Master Playlist (#EXT-X-STREAM-INF)
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const infoLine = lines[i];
      const bwMatch = infoLine.match(/BANDWIDTH=(\d+)/i);
      const bandwidth = bwMatch ? Number(bwMatch[1]) : 0;
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].startsWith('#')) {
          variants.push({
            url: resolveUrl(lines[j]),
            bandwidth
          });
          i = j;
          break;
        }
      }
    }
  }

  if (variants.length > 0) {
    const sorted = [...variants].sort((a, b) => b.bandwidth - a.bandwidth);
    const preferred = sorted.find((v) => v.bandwidth > 0 && v.bandwidth <= 6_000_000) || sorted[0];
    return {
      type: 'master',
      variants: sorted,
      preferredVariantUrl: preferred.url,
      initSegmentUrl: null,
      segments: []
    };
  }

  // 2. Media Playlist: extract optional #EXT-X-MAP init header (fMP4) + all segment URLs (.ts / .m4s / .mp4)
  let initSegmentUrl = null;
  const segments = [];

  for (const line of lines) {
    if (line.startsWith('#EXT-X-MAP:')) {
      const uriMatch = line.match(/URI=["']([^"']+)["']/i);
      if (uriMatch?.[1]) {
        initSegmentUrl = resolveUrl(uriMatch[1]);
      }
      continue;
    }
    if (!line.startsWith('#')) {
      segments.push(resolveUrl(line));
    }
  }

  return {
    type: 'media',
    variants: [],
    preferredVariantUrl: null,
    initSegmentUrl,
    segments
  };
}

// Crawl an HLS .m3u8 playlist, download its .ts / .m4s snippets in batches, and stitch them into a single binary Blob
async function downloadAndAssembleM3u8Stream(m3u8Url, onProgress) {
  onProgress?.('Reading .M3U8 stream manifest...', 5, '5%');
  const masterText = await fetchWithCorsFallback(m3u8Url, true);
  let parsed = parseM3u8Manifest(masterText, m3u8Url);

  if (parsed.type === 'master' && parsed.preferredVariantUrl) {
    onProgress?.('Selecting best .M3U8 quality stream...', 10, '10%');
    const variantText = await fetchWithCorsFallback(parsed.preferredVariantUrl, true);
    parsed = parseM3u8Manifest(variantText, parsed.preferredVariantUrl);
  }

  const segmentUrls = [
    ...(parsed.initSegmentUrl ? [parsed.initSegmentUrl] : []),
    ...parsed.segments.slice(0, 80)
  ];

  if (segmentUrls.length === 0) {
    throw new Error('No downloadable segments found in .m3u8 manifest');
  }

  const total = segmentUrls.length;
  const orderedBuffers = new Array(total);
  let completed = 0;
  const BATCH_SIZE = 4;

  for (let start = 0; start < total; start += BATCH_SIZE) {
    const slice = segmentUrls.slice(start, start + BATCH_SIZE);
    await Promise.all(
      slice.map(async (segUrl, offset) => {
        const idx = start + offset;
        const segBlob = await fetchVideoBlobWithProgress(segUrl, 'video/mp2t', null);
        orderedBuffers[idx] = new Uint8Array(await segBlob.arrayBuffer());
        completed++;
        const pct = Math.min(85, Math.max(12, Math.round(12 + (completed / total) * 73)));
        onProgress?.(`Stitching .M3U8 snippet ${completed} of ${total}...`, pct, `${pct}%`);
      })
    );
  }

  const totalBytes = orderedBuffers.reduce((sum, arr) => sum + (arr ? arr.byteLength : 0), 0);
  const stitched = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buf of orderedBuffers) {
    if (buf) {
      stitched.set(buf, offset);
      offset += buf.byteLength;
    }
  }

  const firstSeg = (parsed.segments[0] || '').toLowerCase();
  const isFmp4 = Boolean(parsed.initSegmentUrl || firstSeg.includes('.m4s') || firstSeg.includes('.mp4'));
  return {
    blob: new Blob([stitched], { type: isFmp4 ? 'video/mp4' : 'video/mp2t' }),
    ext: isFmp4 ? 'mp4' : 'ts',
    mime: isFmp4 ? 'video/mp4' : 'video/mp2t'
  };
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

  // 3. Download the primary file (or crawl & stitch snippets if it is an HLS .m3u8 playlist)
  let rawBlob = null;
  let effectiveInputExt = fmtInfo.ext;

  if (fmtInfo.ext === 'm3u8') {
    const assembled = await downloadAndAssembleM3u8Stream(videoItem.videoUrl, onProgress);
    rawBlob = assembled.blob;
    effectiveInputExt = assembled.ext;
  } else {
    rawBlob = await fetchVideoBlobWithProgress(
      videoItem.videoUrl,
      fmtInfo.mime,
      onProgress,
      `Downloading .${fmtInfo.label} video...`
    );
  }

  if (!shouldConvert && fmtInfo.ext !== 'm3u8') {
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
    mp4Blob = await transcodeBlobWithFfmpegWasm(rawBlob, effectiveInputExt, (msg, pct) => {
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

    const isNsfwItem =
      typeof copy.isNsfw === 'boolean'
        ? copy.isNsfw
        : Boolean(copy.over_18 || settings.allowNsfw);

    const record = {
      ...copy,
      isNsfw: isNsfwItem,
      isFavorite: Boolean(copy.isFavorite),
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

async function toggleVaultFavorite(id) {
  const all = await getAllVaultVideos();
  const target = all.find((v) => v.id === id);
  if (!target) return null;
  target.isFavorite = !target.isFavorite;
  const updated = await saveVideoToVaultDB(target);

  for (const qItem of videoQueue) {
    if (qItem && (qItem.id === id || (qItem.videoUrl && qItem.videoUrl === target.videoUrl))) {
      qItem.isFavorite = updated.isFavorite;
    }
  }

  await renderVaultList();
  if (typeof document !== 'undefined' && document.getElementById('mainVideo')) {
    updatePlayerUI();
  }
  showToast(updated.isFavorite ? '❤️ Added to Vault Favorites!' : 'Removed from Favorites');
  return updated;
}

async function toggleCurrentVideoFavorite() {
  const current = videoQueue[currentIndex];
  if (!current) return null;
  current.isFavorite = !current.isFavorite;
  try {
    const saved = await saveVideoToVaultDB(current);
    if (saved?.id) current.id = saved.id;
    await renderVaultList();
  } catch {
    // keep in-memory favorite state even if IndexedDB is unavailable
  }
  if (typeof document !== 'undefined' && document.getElementById('mainVideo')) {
    updatePlayerUI();
  }
  showToast(current.isFavorite ? '❤️ Saved to Vault Favorites!' : 'Removed from Favorites');
  return current.isFavorite;
}

async function shuffleVaultToPlayer(options = {}) {
  const { favoritesOnly = false, nsfwOnly = false, startReels = false } = options;
  const allItems = await getAllVaultVideos();

  const matching = allItems.filter((item) => {
    if (!settings.allowNsfw && item.isNsfw) return false;
    if (favoritesOnly || settings.vaultFilter === 'favorites' || settings.vaultFilter === 'nsfw_favorites') {
      if (!item.isFavorite) return false;
    }
    if (nsfwOnly || settings.vaultFilter === 'nsfw' || settings.vaultFilter === 'nsfw_favorites') {
      if (!item.isNsfw) return false;
    }
    if (!nsfwOnly && settings.vaultFilter === 'sfw') {
      if (item.isNsfw) return false;
    }
    return true;
  });

  if (matching.length === 0) {
    showToast('No matching videos in your Vault to shuffle!');
    return [];
  }

  const shuffled = [...matching].sort(() => Math.random() - 0.5);
  videoQueue = shuffled;
  currentIndex = 0;
  for (const item of shuffled) {
    if (item?.videoUrl) seenUrls.add(item.videoUrl);
  }

  if (typeof document !== 'undefined') {
    switchTab('view-discover');
    updatePlayerUI();
    if (startReels) {
      toggleReelsFullscreen(true);
    }
  }
  showToast(`🎲 Shuffling ${shuffled.length} Vault video${shuffled.length === 1 ? '' : 's'}!`);
  return shuffled;
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

// Unlock built-in 18+ source presets into the user's sources list (without duplicating)
function unlockAdultPresetSources() {
  const existingIds = new Set(sources.map((s) => s.id));
  let added = 0;
  for (const preset of ADULT_PRESET_SOURCES) {
    if (!existingIds.has(preset.id)) {
      sources.push(structuredClone(preset));
      existingIds.add(preset.id);
      added++;
    }
  }
  if (added > 0) {
    saveSources();
  }
  return added;
}

// ==========================================
// EXPANDABLE 18+ SUBREDDIT & NICHE DIRECTORY
// ==========================================

function findDirectoryEntry(dirIdOrValue) {
  if (!dirIdOrValue) return null;
  const target = String(dirIdOrValue).trim().toLowerCase();
  for (const group of ADULT_DIRECTORY_CATALOG) {
    for (const item of group.items || []) {
      if (
        String(item.id).toLowerCase() === target ||
        String(item.value).toLowerCase() === target
      ) {
        return item;
      }
    }
  }
  return null;
}

function findMatchingSourceForDirectoryEntry(entry) {
  if (!entry) return null;
  return (
    sources.find(
      (s) =>
        s.id === entry.id ||
        (s.type === entry.type &&
          String(s.value || '').toLowerCase() === String(entry.value || '').toLowerCase())
    ) || null
  );
}

function toggleDirectorySource(dirIdOrValue) {
  const entry = findDirectoryEntry(dirIdOrValue);
  if (!entry) return null;

  let existing = findMatchingSourceForDirectoryEntry(entry);
  if (existing) {
    existing.enabled = !existing.enabled;
    existing.isNsfw = true;
  } else {
    existing = {
      id: entry.id,
      type: entry.type,
      value: entry.value,
      label: entry.label,
      enabled: true,
      builtIn: false,
      isNsfw: true
    };
    sources.unshift(existing);
  }

  saveSources();
  if (typeof document !== 'undefined') {
    if (document.getElementById('sourcesList')) renderSourcesList();
    if (document.getElementById('adultDirectoryList')) renderAdultDirectory();
  }
  return existing;
}

function enableAllDirectorySources() {
  let addedOrEnabled = 0;
  for (const group of ADULT_DIRECTORY_CATALOG) {
    for (const entry of group.items || []) {
      const existing = findMatchingSourceForDirectoryEntry(entry);
      if (existing) {
        if (!existing.enabled) {
          existing.enabled = true;
          addedOrEnabled++;
        }
        existing.isNsfw = true;
      } else {
        sources.push({
          id: entry.id,
          type: entry.type,
          value: entry.value,
          label: entry.label,
          enabled: true,
          builtIn: false,
          isNsfw: true
        });
        addedOrEnabled++;
      }
    }
  }
  if (addedOrEnabled > 0) {
    saveSources();
  }
  if (typeof document !== 'undefined') {
    if (document.getElementById('sourcesList')) renderSourcesList();
    if (document.getElementById('adultDirectoryList')) renderAdultDirectory();
  }
  return addedOrEnabled;
}

function toggleAdultDirectory(forceExpand) {
  isAdultDirectoryExpanded =
    typeof forceExpand === 'boolean' ? forceExpand : !isAdultDirectoryExpanded;
  if (typeof document !== 'undefined') {
    const bodyEl = document.getElementById('adultDirectoryBody');
    const btnEl = document.getElementById('toggleAdultDirectoryBtn');
    bodyEl?.classList.toggle('hidden', !isAdultDirectoryExpanded);
    if (btnEl) {
      btnEl.textContent = isAdultDirectoryExpanded ? '▲ Hide Directory' : '▼ Expand Directory';
      btnEl.setAttribute?.('aria-expanded', isAdultDirectoryExpanded ? 'true' : 'false');
    }
    if (isAdultDirectoryExpanded) {
      renderAdultDirectory();
    }
  }
  return isAdultDirectoryExpanded;
}

function renderAdultDirectory() {
  if (typeof document === 'undefined') return;
  const listEl = document.getElementById('adultDirectoryList');
  if (!listEl) return;

  listEl.innerHTML = ADULT_DIRECTORY_CATALOG.map((group) => {
    const cardsHtml = (group.items || [])
      .map((entry) => {
        const matched = findMatchingSourceForDirectoryEntry(entry);
        const isActive = Boolean(matched && matched.enabled);
        const subText =
          entry.type === 'subreddit' ? `Subreddit: r/${entry.value}` : `Niche: ${entry.value}`;
        return `
          <div class="directory-card ${isActive ? 'active' : ''}">
            <div class="directory-card-info">
              <div class="directory-card-title">${escapeHtml(entry.label)}</div>
              <div class="directory-card-sub">${escapeHtml(subText)}</div>
            </div>
            <div class="directory-card-actions">
              <button
                type="button"
                class="btn-dir-toggle ${isActive ? 'active' : ''}"
                data-action="toggle-dir-source"
                data-dir-id="${escapeHtml(entry.id)}"
              >
                ${isActive ? '✓ Active' : '+ Enable'}
              </button>
              <button
                type="button"
                class="btn-dir-pull"
                data-action="pull-dir-source"
                data-dir-id="${escapeHtml(entry.id)}"
                title="Pull video from this niche now"
              >
                ▶ Pull
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="directory-category">
        <div class="directory-category-title">${escapeHtml(group.category)}</div>
        <div class="directory-grid">${cardsHtml}</div>
      </div>
    `;
  }).join('');
}

// Return the active sources filtered by Safe Mode vs Mixed vs Strict 18+ Only Mode
function getEffectiveActiveSources() {
  if (!settings.allowNsfw) {
    return sources.filter((s) => s.enabled && !s.isNsfw);
  }
  if (settings.nsfwMode === 'strict') {
    const strictSources = sources.filter((s) => s.enabled && s.isNsfw);
    return strictSources.length > 0 ? strictSources : structuredClone(ADULT_PRESET_SOURCES);
  }
  const enabledAll = sources.filter((s) => s.enabled);
  return enabledAll;
}

// 4-Digit PIN & WebAuthn FaceID / TouchID Lock Helpers
function syncNsfwLockUI() {
  const badgeEl = document.getElementById('nsfwLockStatusBadge');
  if (!badgeEl) return;
  const hasPin = Boolean(settings.nsfwPin);
  const hasBio = Boolean(settings.nsfwBiometricId);
  if (hasPin && hasBio) {
    badgeEl.textContent = '🔒 Protected by 4-Digit PIN + FaceID';
  } else if (hasPin) {
    badgeEl.textContent = '🔒 Protected by 4-Digit PIN';
  } else if (hasBio) {
    badgeEl.textContent = '🔒 Protected by FaceID / TouchID';
  } else {
    badgeEl.textContent = '🔓 No PIN or FaceID lock set';
  }
}

function setNsfwPin(rawPin) {
  const clean = String(rawPin ?? '').trim();
  if (!/^\d{4}$/.test(clean)) {
    return false;
  }
  settings.nsfwPin = clean;
  saveSettings();
  syncNsfwLockUI();
  return true;
}

function clearNsfwPin() {
  settings.nsfwPin = '';
  settings.nsfwBiometricId = '';
  saveSettings();
  syncNsfwLockUI();
}

function verifyNsfwPin(inputPin) {
  if (!settings.nsfwPin) return true;
  return String(inputPin ?? '').trim() === String(settings.nsfwPin);
}

async function registerNsfwBiometric() {
  if (typeof navigator === 'undefined' || !navigator.credentials?.create) {
    throw new Error('FaceID / TouchID WebAuthn not available on this browser');
  }
  const challenge = new Uint8Array(16);
  const userId = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(challenge);
    globalThis.crypto.getRandomValues(userId);
  }
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'ReelVault 18+ Lock' },
      user: { id: userId, name: 'reelvault-user', displayName: 'ReelVault User' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      },
      timeout: 30000
    }
  });
  if (cred?.id) {
    settings.nsfwBiometricId = String(cred.id);
    saveSettings();
    syncNsfwLockUI();
    return true;
  }
  return false;
}

async function authenticateNsfwBiometric() {
  if (typeof navigator === 'undefined' || !navigator.credentials?.get || !settings.nsfwBiometricId) {
    return false;
  }
  const challenge = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(challenge);
  }
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      userVerification: 'required',
      timeout: 30000
    }
  });
  return Boolean(assertion);
}

// Instant Safe-Mode Scrub: purges 18+ videos from active player, queue, search results, sources & Vault view
function scrubNsfwFromActiveSession() {
  const isItemNsfw = (item) => Boolean(item?.isNsfw || item?.over_18);
  const current = videoQueue[currentIndex];
  const wasPlayingNsfw = isItemNsfw(current);

  videoQueue = videoQueue.filter((item) => !isItemNsfw(item));
  if (videoQueue.length === 0) {
    currentIndex = -1;
  } else if (currentIndex >= videoQueue.length) {
    currentIndex = videoQueue.length - 1;
  }

  if (wasPlayingNsfw) {
    const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
    if (videoEl) {
      try {
        videoEl.pause?.();
        videoEl.src = '';
        videoEl.load?.();
      } catch {}
    }
    if (videoQueue.length === 0 && typeof document !== 'undefined') {
      document.getElementById('playerEmpty')?.classList.remove('hidden');
    }
  }

  if (lastSearchResults.some(isItemNsfw)) {
    lastSearchResults = lastSearchResults.filter((item) => !isItemNsfw(item));
    if (typeof document !== 'undefined' && document.getElementById('searchResultsList')) {
      renderSearchResults(lastSearchResults);
    }
  }

  // Scrub 18+ video from persisted playback resume state if Safe Mode is enabled
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYBACK_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isItemNsfw(parsed?.currentVideo)) {
          if (videoQueue.length > 0 && currentIndex >= 0) {
            savePlaybackState();
          } else {
            localStorage.removeItem(STORAGE_KEYS.PLAYBACK_STATE);
          }
        }
      }
    }
  } catch {}

  if (typeof document !== 'undefined') {
    if (document.getElementById('sourcesList')) renderSourcesList();
    if (document.getElementById('mainVideo')) updatePlayerUI();
    if (document.getElementById('vaultList')) {
      renderVaultList().catch?.(() => {});
    }
  }
}

// Panic / "Boss Key": immediately drops into Safe Mode, exits fullscreen, and loads a safe NASA space clip
function triggerPanicSafeMode() {
  if (isReelsFullscreen) {
    toggleReelsFullscreen(false);
  }
  setAdultContentEnabled(false);

  const safeClip = structuredClone(FALLBACK_VIDEOS[0]);
  videoQueue = [safeClip];
  currentIndex = 0;

  if (typeof document !== 'undefined') {
    const videoEl = document.getElementById('mainVideo');
    if (videoEl) {
      videoEl.muted = true;
      try {
        videoEl.pause?.();
      } catch {}
    }
    switchTab('view-discover');
    updatePlayerUI();
  }
  showToast('🛡️ Safe Mode Active');
}

// ==========================================
// RESUME PLAYBACK WHERE YOU LEFT OFF HELPERS
// ==========================================

function getPlaybackItemKey(videoItem) {
  if (!videoItem) return '';
  return String(videoItem.videoUrl || videoItem.originalUrl || videoItem.id || '');
}

function sanitizeVideoItemForStorage(videoItem) {
  if (!videoItem || typeof videoItem !== 'object') return null;
  const copy = { ...videoItem };
  delete copy.offlineBlob;
  delete copy.convertedBlob;
  delete copy.convertedBlobUrl;
  delete copy.offlineObjectUrl;
  return copy;
}

function getSavedPlaybackTime(videoItem) {
  if (!settings.resumePlayback || !videoItem) return 0;
  if (typeof videoItem.resumeTime === 'number' && isFinite(videoItem.resumeTime) && videoItem.resumeTime > 0) {
    return videoItem.resumeTime;
  }
  const key = getPlaybackItemKey(videoItem);
  if (key && typeof playbackPositions[key] === 'number' && isFinite(playbackPositions[key]) && playbackPositions[key] > 0) {
    return playbackPositions[key];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYBACK_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (key && typeof parsed?.positions?.[key] === 'number' && parsed.positions[key] > 0) {
          return parsed.positions[key];
        }
        if (getPlaybackItemKey(parsed?.currentVideo) === key && typeof parsed?.currentTime === 'number' && parsed.currentTime > 0) {
          return parsed.currentTime;
        }
      }
    }
  } catch {}
  return 0;
}

function savePlaybackState(overrideTime = null) {
  if (!settings.resumePlayback) return null;
  const current = videoQueue[currentIndex];
  if (!current) return null;

  const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
  let time = 0;
  if (typeof overrideTime === 'number' && isFinite(overrideTime) && overrideTime >= 0) {
    time = overrideTime;
  } else if (videoEl && typeof videoEl.currentTime === 'number' && isFinite(videoEl.currentTime) && videoEl.currentTime > 0) {
    time = videoEl.currentTime;
  } else if (typeof current.resumeTime === 'number' && isFinite(current.resumeTime) && current.resumeTime > 0) {
    time = current.resumeTime;
  } else {
    const key = getPlaybackItemKey(current);
    if (key && typeof playbackPositions[key] === 'number' && playbackPositions[key] > 0) {
      time = playbackPositions[key];
    }
  }

  current.resumeTime = time;
  const key = getPlaybackItemKey(current);
  if (key) {
    playbackPositions[key] = time;
  }

  const snapshot = {
    currentVideo: sanitizeVideoItemForStorage(current),
    videoQueue: videoQueue.slice(0, 25).map(sanitizeVideoItemForStorage).filter(Boolean),
    currentIndex,
    currentTime: time,
    wasPlaying: Boolean(videoEl && !videoEl.paused),
    positions: { ...playbackPositions },
    updatedAt: Date.now()
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.PLAYBACK_STATE, JSON.stringify(snapshot));
    }
  } catch {}

  return snapshot;
}

function restorePlaybackState() {
  if (!settings.resumePlayback) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYBACK_STATE);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;

    if (parsed.positions && typeof parsed.positions === 'object') {
      playbackPositions = { ...playbackPositions, ...parsed.positions };
    }

    const isItemNsfw = (item) => Boolean(item?.isNsfw || item?.over_18);
    let restoredQueue = Array.isArray(parsed.videoQueue) && parsed.videoQueue.length > 0
      ? parsed.videoQueue
      : parsed.currentVideo
      ? [parsed.currentVideo]
      : [];

    if (!settings.allowNsfw) {
      restoredQueue = restoredQueue.filter((item) => !isItemNsfw(item));
    }
    if (restoredQueue.length === 0) return false;

    const targetKey = getPlaybackItemKey(parsed.currentVideo);
    let restoredIndex = restoredQueue.findIndex((item) => getPlaybackItemKey(item) === targetKey);
    if (restoredIndex < 0) {
      restoredIndex =
        typeof parsed.currentIndex === 'number' &&
        parsed.currentIndex >= 0 &&
        parsed.currentIndex < restoredQueue.length
          ? parsed.currentIndex
          : 0;
    }

    const activeItem = restoredQueue[restoredIndex];
    const activeKey = getPlaybackItemKey(activeItem);
    const savedTime =
      activeKey === targetKey && typeof parsed.currentTime === 'number' && parsed.currentTime > 0
        ? parsed.currentTime
        : Number(playbackPositions[activeKey] || activeItem?.resumeTime || 0);

    if (activeItem && savedTime > 0) {
      activeItem.resumeTime = savedTime;
      if (activeKey) {
        playbackPositions[activeKey] = savedTime;
      }
    }

    videoQueue = restoredQueue;
    currentIndex = restoredIndex;
    for (const item of videoQueue) {
      if (item?.videoUrl) seenUrls.add(item.videoUrl);
    }

    if (typeof document !== 'undefined' && document.getElementById('mainVideo')) {
      updatePlayerUI();
    }
    return true;
  } catch {
    return false;
  }
}

// Save exact video position when backgrounded and pick up right where you left off when returning
function handleVisibilityPlaybackChange() {
  if (!settings.resumePlayback) return;
  const isHidden = typeof document !== 'undefined' && Boolean(document.hidden || document.visibilityState === 'hidden');
  if (isHidden) {
    savePlaybackState();
  } else {
    if (videoQueue.length === 0 || currentIndex < 0) {
      restorePlaybackState();
      return;
    }
    const current = videoQueue[currentIndex];
    const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
    if (current && videoEl) {
      const savedTime = getSavedPlaybackTime(current);
      if (savedTime > 0 && (!videoEl.currentTime || Math.abs(videoEl.currentTime - savedTime) > 1.5)) {
        try {
          videoEl.currentTime = savedTime;
        } catch {}
      }
    }
  }
}

// ==========================================
// QUICK SKIP (-10S / +15S / +30S), VIDEO SEEKER & PLAYBACK SPEED HELPERS
// ==========================================

let isScrubbingReelsSeeker = false;

function formatVideoTime(seconds) {
  const num = Number(seconds);
  if (!Number.isFinite(num) || num < 0) return '0:00';
  const totalSec = Math.floor(num);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateReelsSeekerUI() {
  if (typeof document === 'undefined') return;
  const videoEl = document.getElementById('mainVideo');
  const sliderEl = document.getElementById('reelsSeekSlider');
  const curTimeEl = document.getElementById('reelsCurrentTime');
  const durTimeEl = document.getElementById('reelsDuration');
  const playPauseBtn = document.getElementById('reelsPlayPauseBtn');
  const muteBtn = document.getElementById('reelsMuteBtn');

  const current = videoQueue[currentIndex];
  const curTime =
    videoEl && typeof videoEl.currentTime === 'number' && Number.isFinite(videoEl.currentTime)
      ? videoEl.currentTime
      : Number(current?.resumeTime) || 0;
  const dur =
    videoEl && typeof videoEl.duration === 'number' && Number.isFinite(videoEl.duration) && videoEl.duration > 0
      ? videoEl.duration
      : Number(current?.duration) || 0;

  if (curTimeEl) {
    curTimeEl.textContent = formatVideoTime(curTime);
  }
  if (durTimeEl) {
    durTimeEl.textContent = formatVideoTime(dur);
  }

  const pct = dur > 0 ? Math.min(100, Math.max(0, (curTime / dur) * 100)) : 0;
  if (sliderEl && !isScrubbingReelsSeeker) {
    sliderEl.value = String(Math.round(pct * 10) / 10);
    if (sliderEl.style && typeof sliderEl.style.setProperty === 'function') {
      sliderEl.style.setProperty('--seek-pct', `${pct.toFixed(1)}%`);
    }
  }

  if (playPauseBtn && videoEl) {
    const isPaused = videoEl.paused !== false;
    playPauseBtn.textContent = isPaused ? '▶' : '⏸';
    playPauseBtn.setAttribute?.('aria-label', isPaused ? 'Play Video' : 'Pause Video');
  }

  if (muteBtn && videoEl) {
    const isMuted = Boolean(videoEl.muted);
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.setAttribute?.('aria-label', isMuted ? 'Unmute Audio' : 'Mute Audio');
  }
}

function seekVideoToPercent(percent) {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
  const current = videoQueue[currentIndex];
  const dur =
    videoEl && typeof videoEl.duration === 'number' && Number.isFinite(videoEl.duration) && videoEl.duration > 0
      ? videoEl.duration
      : Number(current?.duration) || 0;

  const targetTime = dur > 0 ? (pct / 100) * dur : 0;
  if (videoEl && dur > 0) {
    try {
      videoEl.currentTime = targetTime;
    } catch {}
  }
  if (current && dur > 0) {
    current.resumeTime = targetTime;
    savePlaybackState(targetTime);
  }

  if (typeof document !== 'undefined') {
    const sliderEl = document.getElementById('reelsSeekSlider');
    const curTimeEl = document.getElementById('reelsCurrentTime');
    if (sliderEl) {
      sliderEl.value = String(Math.round(pct * 10) / 10);
      if (sliderEl.style && typeof sliderEl.style.setProperty === 'function') {
        sliderEl.style.setProperty('--seek-pct', `${pct.toFixed(1)}%`);
      }
    }
    if (curTimeEl) {
      curTimeEl.textContent = formatVideoTime(targetTime);
    }
  }
  return targetTime;
}

function skipVideoTime(deltaSeconds) {
  const delta = Number(deltaSeconds) || 0;
  const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
  const current = videoQueue[currentIndex];

  const baseTime =
    videoEl && typeof videoEl.currentTime === 'number' && isFinite(videoEl.currentTime)
      ? videoEl.currentTime
      : Number(current?.resumeTime) || 0;

  let targetTime = Math.max(0, baseTime + delta);
  if (
    videoEl &&
    typeof videoEl.duration === 'number' &&
    isFinite(videoEl.duration) &&
    videoEl.duration > 0
  ) {
    targetTime = Math.min(videoEl.duration, targetTime);
  }

  if (videoEl) {
    try {
      videoEl.currentTime = targetTime;
    } catch {}
  }
  if (current) {
    current.resumeTime = targetTime;
  }
  savePlaybackState(targetTime);
  updateReelsSeekerUI();
  return targetTime;
}

function setPlaybackSpeed(rate) {
  const numeric = Number(rate);
  const validRate = PLAYBACK_SPEED_OPTIONS.includes(numeric) ? numeric : 1;
  settings.playbackSpeed = validRate;
  saveSettings();

  if (typeof document !== 'undefined') {
    const videoEl = document.getElementById('mainVideo');
    if (videoEl) {
      videoEl.playbackRate = validRate;
    }
    const speedSelect = document.getElementById('playbackSpeedSelect');
    if (speedSelect) {
      speedSelect.value = String(validRate);
    }
  }
  return validRate;
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

  // Sync Panic Safe button, 18+ Quick Category Chips, Directory, Mode Selectors & Preset Pack button
  document.getElementById('panicSafeBtn')?.classList.toggle('hidden', !isAllowed);
  document.getElementById('nsfwQuickChipsBar')?.classList.toggle('hidden', !isAllowed);
  document.getElementById('searchNsfwChipsBar')?.classList.toggle('hidden', !isAllowed);
  document.getElementById('loadAdultPresetsBtn')?.classList.toggle('hidden', !isAllowed);
  document.getElementById('adultDirectorySection')?.classList.toggle('hidden', !isAllowed);
  document.getElementById('vaultFilterSelect')?.classList.toggle('hidden', !isAllowed);

  if (isAllowed && typeof document !== 'undefined' && document.getElementById('adultDirectoryList')) {
    renderAdultDirectory();
  }

  const nsfwModeSelect = document.getElementById('nsfwModeSelect');
  if (nsfwModeSelect) {
    nsfwModeSelect.value = isAllowed ? (settings.nsfwMode === 'strict' ? 'strict' : 'mixed') : 'safe';
  }

  const quickModeBtn = document.getElementById('nsfwQuickModeBtn');
  if (quickModeBtn) {
    quickModeBtn.textContent = settings.nsfwMode === 'strict' ? '🔥 Strict 18+' : '🔞 Mixed 18+';
  }

  syncNsfwLockUI();
}

function openAgeGateModal() {
  const modal = document.getElementById('ageGateModal');
  const pinSection = document.getElementById('ageGatePinSection');
  const pinInput = document.getElementById('ageGatePinInput');
  const pinError = document.getElementById('ageGatePinError');
  const bioBtn = document.getElementById('ageGateBiometricBtn');
  const modeSelect = document.getElementById('ageGateModeSelect');

  if (modeSelect) {
    modeSelect.value = settings.nsfwMode === 'strict' ? 'strict' : 'mixed';
  }
  if (pinSection) {
    const needsLock = Boolean(settings.nsfwPin || settings.nsfwBiometricId);
    pinSection.classList.toggle('hidden', !needsLock);
  }
  if (pinInput) pinInput.value = '';
  pinError?.classList.add('hidden');
  if (bioBtn) {
    bioBtn.classList.toggle('hidden', !settings.nsfwBiometricId);
  }

  modal?.classList.remove('hidden');
}

function closeAgeGateModal() {
  const modal = document.getElementById('ageGateModal');
  modal?.classList.add('hidden');
  syncAgeGateUI();
}

function setAdultContentEnabled(enabled, explicitMode = null) {
  settings.allowNsfw = Boolean(enabled);
  if (settings.allowNsfw) {
    if (explicitMode === 'strict' || explicitMode === 'mixed') {
      settings.nsfwMode = explicitMode;
    } else if (!settings.nsfwMode || settings.nsfwMode === 'safe') {
      settings.nsfwMode = 'mixed';
    }
    if (sources.length > 0) {
      unlockAdultPresetSources();
    }
  } else {
    scrubNsfwFromActiveSession();
  }
  sourcePoolCache.clear();
  saveSettings();
  syncAgeGateUI();
  if (typeof document !== 'undefined') {
    if (document.getElementById('sourcesList')) renderSourcesList();
    if (document.getElementById('vaultList')) {
      renderVaultList().catch?.(() => {});
    }
  }
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

// ==========================================
// REDGIFS API V2 HD .MP4 RESOLVER & SEARCH ENGINE
// ==========================================

function extractRedgifsId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const watchMatch = rawUrl.match(/redgifs\.com\/(?:watch|ifr|detail|gifs\/detail)\/([a-zA-Z0-9_-]+)/i);
  if (watchMatch?.[1]) {
    return watchMatch[1].toLowerCase();
  }
  const thumbMatch = rawUrl.match(
    /thumbs\d*\.redgifs\.com\/([a-zA-Z0-9_-]+?)(?:-mobile|-silent|-size_restricted|-poster)?\.(?:mp4|webm|gif|jpg)/i
  );
  if (thumbMatch?.[1]) {
    return thumbMatch[1];
  }
  return null;
}

async function getRedgifsTempToken() {
  if (cachedRedgifsToken && Date.now() < cachedRedgifsTokenExpiry) {
    return cachedRedgifsToken;
  }
  try {
    const res = await fetchWithTimeout('https://api.redgifs.com/v2/auth/temporary', 3500);
    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        cachedRedgifsToken = data.token;
        cachedRedgifsTokenExpiry = Date.now() + 45 * 60 * 1000;
        return cachedRedgifsToken;
      }
    }
  } catch {
    // fallback if blocked
  }
  return null;
}

async function resolveRedgifsUrlToMp4(rawUrl, fallbackTitle = 'RedGIFs HD Clip') {
  const rgId = extractRedgifsId(rawUrl);
  if (!rgId) return null;

  // 1. Try RedGIFs API v2 with temporary guest bearer token
  try {
    const token = await getRedgifsTempToken();
    const apiUrl = `https://api.redgifs.com/v2/gifs/${encodeURIComponent(rgId.toLowerCase())}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      const gif = data?.gif;
      const mp4Url = gif?.urls?.hd || gif?.urls?.sd;
      if (mp4Url) {
        return {
          id: `rg-${gif.id || rgId.toLowerCase()}`,
          title: (Array.isArray(gif.tags) && gif.tags.length ? `RedGIFs: ${gif.tags.slice(0, 4).join(', ')}` : fallbackTitle),
          videoUrl: mp4Url,
          originalUrl: rawUrl,
          convertedUrl: mp4Url,
          format: 'mp4',
          duration: Number(gif.duration) || 0,
          tags: Array.isArray(gif.tags) ? gif.tags.slice(0, 6) : [],
          isHd: Boolean(gif?.urls?.hd),
          isNsfw: true,
          sourceName: 'RedGIFs HD',
          pageUrl: `https://www.redgifs.com/watch/${encodeURIComponent(rgId.toLowerCase())}`
        };
      }
    }
  } catch {
    // Fall back to embed HTML scraping
  }

  // 2. Fallback: scrape RedGIFs embed / watch page HTML for direct .mp4 stream
  try {
    const embedUrl = `https://www.redgifs.com/ifr/${encodeURIComponent(rgId.toLowerCase())}`;
    const html = await fetchWithCorsFallback(embedUrl, true);
    const streams = extractVideoUrlsFromHtml(html, embedUrl);
    const bestMp4 = streams.find((u) => /\.mp4(\?|$)/i.test(u)) || streams[0];
    if (bestMp4) {
      return {
        id: `rg-${rgId.toLowerCase()}`,
        title: fallbackTitle,
        videoUrl: bestMp4,
        originalUrl: rawUrl,
        convertedUrl: bestMp4,
        format: 'mp4',
        isHd: true,
        isNsfw: true,
        sourceName: 'RedGIFs HD',
        pageUrl: `https://www.redgifs.com/watch/${encodeURIComponent(rgId.toLowerCase())}`
      };
    }
  } catch {
    // ignore
  }

  return null;
}

async function searchRedgifsVideos(keyword, limit = 6) {
  if (!settings.allowNsfw) return [];
  const results = [];

  try {
    const token = await getRedgifsTempToken();
    const cleanKw = String(keyword || '').replace(/\b(redgifs|nsfw|18\+)\b/gi, '').trim() || 'trending';
    const searchUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(
      cleanKw
    )}&order=trending&count=${limit}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(searchUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      const gifs = Array.isArray(data?.gifs) ? data.gifs : [];
      for (const g of gifs) {
        const mp4Url = g?.urls?.hd || g?.urls?.sd;
        if (!mp4Url || !isFormatAllowedBySettings('mp4')) continue;
        const tagLabel = Array.isArray(g.tags) && g.tags.length ? g.tags.slice(0, 4).join(', ') : cleanKw;
        results.push({
          id: `rg-${g.id}`,
          title: `RedGIFs HD — ${tagLabel}`,
          videoUrl: mp4Url,
          originalUrl: mp4Url,
          convertedUrl: null,
          format: 'mp4',
          duration: Number(g.duration) || 0,
          tags: Array.isArray(g.tags) ? g.tags.slice(0, 6) : [],
          isHd: Boolean(g?.urls?.hd),
          isNsfw: true,
          sourceName: `RedGIFs (${cleanKw})`,
          pageUrl: `https://www.redgifs.com/watch/${encodeURIComponent(g.id)}`
        });
      }
    }
  } catch {
    // ignore API error
  }

  return filterAndSortTubeResults(results);
}

// 4. Reddit Subreddit or Global Keyword Video Search
function extractRedditVideosFromListing(json, sourceLabel) {
  const children = json?.data?.children || [];
  const results = [];

  for (const child of children) {
    const post = child?.data;
    if (!post) continue;
    if (post.over_18 && !settings.allowNsfw) continue;
    if (settings.allowNsfw && settings.nsfwMode === 'strict' && post.over_18 === false) continue;

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
      } else if (/redgifs\.com/i.test(candidateDirectUrl)) {
        // Extract RedGIFs direct .mp4 from oembed thumbnail pattern or slug
        const oembedThumb =
          mediaPost?.secure_media?.oembed?.thumbnail_url ||
          mediaPost?.media?.oembed?.thumbnail_url ||
          '';
        const thumbSlugMatch = String(oembedThumb).match(
          /(https?:\/\/thumbs\d*\.redgifs\.com\/[a-zA-Z0-9_-]+?)(?:-poster|-mobile|-size_restricted)?\.(?:jpg|png|gif|mp4)/i
        );
        if (thumbSlugMatch?.[1]) {
          rawVideoUrl = `${thumbSlugMatch[1]}.mp4`;
        } else {
          const rgId = extractRedgifsId(candidateDirectUrl);
          if (rgId) {
            rawVideoUrl = `https://thumbs4.redgifs.com/${rgId}.mp4`;
          }
        }
      }
    }

    if (!rawVideoUrl && hlsUrl && isFormatAllowedBySettings('m3u8')) {
      rawVideoUrl = hlsUrl;
    }

    if (rawVideoUrl) {
      const normalized = normalizeAndAutoRewriteVideoUrl(rawVideoUrl);
      if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;

      const durationSec =
        Number(mediaPost?.secure_media?.reddit_video?.duration) ||
        Number(mediaPost?.preview?.reddit_video_preview?.duration) ||
        0;
      const heightPx =
        Number(mediaPost?.secure_media?.reddit_video?.height) ||
        Number(mediaPost?.preview?.reddit_video_preview?.height) ||
        0;

      const postTags = [];
      if (post.subreddit) postTags.push(`r/${post.subreddit}`);
      if (post.link_flair_text && typeof post.link_flair_text === 'string') {
        postTags.push(post.link_flair_text.trim());
      }

      results.push({
        id: `rd-${post.id}`,
        title: post.title || 'Reddit Video Clip',
        videoUrl: normalized.videoUrl,
        originalUrl: normalized.originalUrl,
        convertedUrl: normalized.convertedUrl,
        format: normalized.format,
        isAutoConverted: normalized.isAutoConverted,
        isNsfw: Boolean(post.over_18),
        over_18: Boolean(post.over_18),
        duration: durationSec,
        tags: postTags,
        isHd: heightPx >= 720 || /720|1080/i.test(normalized.videoUrl),
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
  const effectiveQuery =
    settings.allowNsfw && settings.nsfwMode === 'strict' && !/\bnsfw:yes\b/i.test(keyword)
      ? `${keyword} nsfw:yes`
      : keyword;
  const sorts = ['relevance', 'hot', 'top'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
    effectiveQuery
  )}&type=link&sort=${randomSort}&include_over_18=${nsfwFlag}&limit=35&raw_json=1`;

  const json = await fetchWithCorsFallback(url, false);
  return extractRedditVideosFromListing(json, `Reddit (${keyword})`);
}

// 5. PeerTube Global Federated Search Engine (via SepiaSearch API + PeerTube Instance Video API)
async function searchPeerTubeVideos(keyword, limit = 4) {
  const nsfwParam = !settings.allowNsfw
    ? 'false'
    : settings.nsfwMode === 'strict'
    ? 'true'
    : 'both';
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
          isNsfw: Boolean(item.nsfw || detail.nsfw),
          duration: Number(detail.duration || item.duration) || 0,
          isHd: Number(mp4File?.resolution?.id || 0) >= 720,
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
        if (settings.allowNsfw && settings.nsfwMode === 'strict' && !st?.sensitive) continue;
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
              isNsfw: Boolean(st?.sensitive),
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
        const isPostNsfw = Boolean(post.nsfw || entry?.community?.nsfw);
        if (isPostNsfw && !settings.allowNsfw) continue;
        if (settings.allowNsfw && settings.nsfwMode === 'strict' && !isPostNsfw) continue;
        let candidateUrl = post.url || post.embed_video_url;
        if (!candidateUrl || typeof candidateUrl !== 'string') continue;

        if (/redgifs\.com/i.test(candidateUrl)) {
          const rgId = extractRedgifsId(candidateUrl);
          if (rgId) {
            candidateUrl = `https://thumbs4.redgifs.com/${rgId}.mp4`;
          }
        }

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
            isNsfw: isPostNsfw,
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

// Helper: Decode JSON/JS-escaped URLs in raw HTML/script blocks and extract all playable video stream URLs
function extractVideoUrlsFromHtml(rawText, baseUrl) {
  if (!rawText || typeof rawText !== 'string') return [];

  // Unescape JSON-escaped forward slashes (https:\/\/...) and unicode escapes (\u002F, \u0026, &amp;)
  const decodedText = rawText
    .replace(/\\\\\//g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&');

  const foundUrls = new Set();

  // 1. Absolute video URLs across all 19 extensions (including inside inline <script> player configs)
  const absRegex = new RegExp(
    `https?:\\/\\/[^\\s"'<>\\\\()]+\\.(?:${VIDEO_EXT_REGEX_PATTERN})(?:\\?[^\\s"'<>\\\\()]*)?`,
    'gi'
  );
  let m;
  while ((m = absRegex.exec(decodedText)) !== null) {
    foundUrls.add(m[0]);
  }

  // 2. Relative video src/href/data-src/content/file attributes & JSON player keys
  const relRegex = new RegExp(
    `(?:src|href|data-src|data-video|content|video_url|mp4_url|hls_url|contentUrl|file)\\s*[:=]\\s*["']([^"']+\\.(?:${VIDEO_EXT_REGEX_PATTERN})(?:\\?[^"']*)?)["']`,
    'gi'
  );
  while ((m = relRegex.exec(decodedText)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl).href;
      foundUrls.add(resolved);
    } catch {
      // ignore invalid relative URL
    }
  }

  // Sort full streams ahead of tiny hover-preview clips if both exist on a page
  const all = [...foundUrls];
  const nonPreview = all.filter((u) => !/(?:preview|thumb|trailer|sprite)/i.test(u));
  return nonPreview.length > 0 ? [...nonPreview, ...all.filter((u) => !nonPreview.includes(u))] : all;
}

// 8. Custom URL / Webpage & Free Tube Site Multi-Format Video Scanner
async function scanUrlForVideos(targetUrl, customLabel = 'Web Scanner', allowSubpageCrawl = true) {
  const trimmed = targetUrl.trim();

  // Direct RedGIFs watch/embed link resolver
  if (/redgifs\.com\/(?:watch|ifr|detail)\//i.test(trimmed)) {
    const resolvedRg = await resolveRedgifsUrlToMp4(trimmed, customLabel);
    if (resolvedRg) {
      return [resolvedRg];
    }
  }

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
  const titleMatch = String(rawText || '').match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch?.[1]?.replace(/\s+/g, ' ')?.trim() || null;

  const extractedUrls = extractVideoUrlsFromHtml(rawText, trimmed);
  const results = [];
  let idx = 0;

  for (const vUrl of extractedUrls) {
    const normalized = normalizeAndAutoRewriteVideoUrl(vUrl);
    if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;
    const shortName = vUrl.split('/').pop().split('?')[0] || `Video #${idx + 1}`;
    results.push({
      id: `scan-${Date.now()}-${idx}`,
      title: idx === 0 && pageTitle ? pageTitle : decodeURIComponent(shortName),
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

  // Two-Hop Tube Listing Crawler: if this was a tube search/category page with watch-page links, crawl up to 3 watch pages
  if (allowSubpageCrawl && results.length < 2 && typeof rawText === 'string') {
    const watchLinks = [];
    const linkRegex = /href=["']([^"']*(?:\/video[^"']*|\bviewkey=[^"']+|\/watch\/[^"']+|\/videos\/[^"']+|\/v\/[^"']+))["']/gi;
    let lm;
    while ((lm = linkRegex.exec(rawText)) !== null && watchLinks.length < 3) {
      try {
        const fullLink = new URL(lm[1].replace(/&amp;/g, '&'), trimmed).href;
        if (fullLink !== trimmed && !watchLinks.includes(fullLink)) {
          watchLinks.push(fullLink);
        }
      } catch {
        // ignore invalid subpage URL
      }
    }

    if (watchLinks.length > 0) {
      const subSettled = await Promise.allSettled(
        watchLinks.map((wUrl) => scanUrlForVideos(wUrl, customLabel, false))
      );
      for (const s of subSettled) {
        if (s.status === 'fulfilled' && Array.isArray(s.value)) {
          results.push(...s.value.slice(0, 2));
        }
      }
    }
  }

  return results;
}

// Filter & sort tube results by duration ('all' | 'short' | 'medium' | 'long') and quality ('all' | 'hd')
function filterAndSortTubeResults(
  items,
  durationFilter = settings.tubeDurationFilter,
  qualityFilter = settings.tubeQualityFilter
) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item) return false;
    if (qualityFilter === 'hd') {
      const looksHd =
        Boolean(item.isHd) ||
        /(?:720p|1080p|1440p|2160p|4k|_hd|hd\.mp4)/i.test(`${item.videoUrl || ''} ${item.title || ''}`);
      if (!looksHd) return false;
    }
    const dur = Number(item.duration) || 0;
    if (dur > 0 && durationFilter && durationFilter !== 'all') {
      if (durationFilter === 'short' && dur > 120) return false;
      if (durationFilter === 'medium' && (dur < 120 || dur > 600)) return false;
      if (durationFilter === 'long' && dur < 300) return false;
    }
    return true;
  });
}

// 9. Automatic Free Tube Sites Search Engine (Dailymotion, Eporner Public API v2, RedGIFs API v2, 18+ Tube Feeds)
async function searchFreeTubeSites(keyword, limit = 6) {
  const results = [];
  const tasks = [];

  // A. Dailymotion Public Tube API (Supports both Safe Mode & 18+ Unfiltered Mode)
  if (!settings.allowNsfw || settings.nsfwMode !== 'strict') {
    tasks.push(
      (async () => {
        const nsfwFilter = settings.allowNsfw ? 'true' : 'false';
        const dmUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(
          keyword
        )}&fields=id,title,url,stream_h264_url,duration&explicit=${nsfwFilter}&limit=${limit}`;
        const res = await fetchWithTimeout(dmUrl, 4000);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.list) ? data.list : [];
        for (const item of list) {
          const directStream = item?.stream_h264_url;
          if (directStream && typeof directStream === 'string') {
            const normalized = normalizeAndAutoRewriteVideoUrl(directStream);
            if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;
            results.push({
              id: `dm-${item.id}`,
              title: item.title || 'Dailymotion Tube Clip',
              videoUrl: normalized.videoUrl,
              originalUrl: normalized.originalUrl,
              convertedUrl: normalized.convertedUrl,
              format: normalized.format,
              duration: Number(item.duration) || 0,
              isHd: /720|1080|hd/i.test(directStream),
              sourceName: 'Dailymotion Tube',
              pageUrl: item.url || `https://www.dailymotion.com/video/${item.id}`
            });
          }
        }
      })()
    );
  }

  // B. When 18+ Adult Content is Enabled: Query Free 18+ Tube APIs (Eporner API v2 + RedGIFs v2 + 18+ Tube Feeds)
  if (settings.allowNsfw) {
    // 1. Eporner Public Video JSON API v2 (Zero API Key) + Stream Extractor
    tasks.push(
      (async () => {
        const epOrder = settings.tubeDurationFilter === 'long' ? 'longest' : 'most-popular';
        const epApiUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(
          keyword
        )}&per_page=6&thumbsize=medium&order=${epOrder}&format=json`;
        const data = await fetchWithCorsFallback(epApiUrl, false);
        const videos = Array.isArray(data?.videos) ? data.videos.slice(0, 3) : [];

        await Promise.allSettled(
          videos.map(async (v) => {
            if (!v?.id) return;
            const embedUrl = v.embed || `https://www.eporner.com/embed/${v.id}/`;
            const pageHtml = await fetchWithCorsFallback(embedUrl, true);
            const streams = extractVideoUrlsFromHtml(pageHtml, embedUrl);
            const bestStream =
              streams.find((u) => /(?:1080p|720p).*\.mp4(\?|$)/i.test(u)) ||
              streams.find((u) => /\.mp4(\?|$)/i.test(u)) ||
              streams[0];
            if (!bestStream) return;

            const normalized = normalizeAndAutoRewriteVideoUrl(bestStream);
            if (!normalized || !isFormatAllowedBySettings(normalized.format)) return;

            results.push({
              id: `ep-${v.id}`,
              title: v.title || 'Free Tube 18+ Video',
              videoUrl: normalized.videoUrl,
              originalUrl: normalized.originalUrl,
              convertedUrl: normalized.convertedUrl,
              format: normalized.format,
              duration: Number(v.length_sec) || 0,
              isHd: /720|1080|hd/i.test(bestStream) || Boolean(v.hd),
              isNsfw: true,
              sourceName: `Free Tube (${keyword})`,
              pageUrl: v.url || embedUrl
            });
          })
        );
      })()
    );

    // 2. RedGIFs API v2 HD Short Tube Clips
    tasks.push(
      (async () => {
        const rgItems = await searchRedgifsVideos(keyword, 4);
        results.push(...rgItems);
      })()
    );

    // 3. Direct 18+ Tube Stream Search (RedGIFs / v.redd.it NSFW video streams)
    tasks.push(
      (async () => {
        const nsfwTubeUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
          `${keyword} nsfw:yes`
        )}&type=link&sort=hot&include_over_18=1&limit=25&raw_json=1`;
        const json = await fetchWithCorsFallback(nsfwTubeUrl, false);
        const extracted = extractRedditVideosFromListing(json, `18+ Tube (${keyword})`);
        results.push(...extracted.slice(0, limit));
      })()
    );
  }

  await Promise.allSettled(tasks);
  return filterAndSortTubeResults(results);
}

// In-memory source pool cache (3-minute TTL) for instant 0ms subsequent pulls
const sourcePoolCache = new Map();
const SOURCE_CACHE_TTL_MS = 180_000;

function getSourceCacheKey(source) {
  return `${source.type}:${String(source.value || '').toLowerCase()}:${settings.formatMode}:${settings.allowNsfw}:${settings.nsfwMode}`;
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

  // Default: 'keyword' -> race open engines in parallel (or 18+-focused engines when Strict 18+ Mode is active)
  const combined = [];
  const cacheRecord = { items: combined, timestamp: Date.now() };
  sourcePoolCache.set(cacheKey, cacheRecord);

  const isStrictNsfw = Boolean(settings.allowNsfw && (settings.nsfwMode === 'strict' || source.isNsfw));
  const enginePromises = isStrictNsfw
    ? [
        searchRedgifsVideos(source.value, 5),
        searchFreeTubeSites(source.value, 5),
        searchRedditVideosByKeyword(source.value),
        searchPeerTubeVideos(source.value, 4),
        searchFediverseVideos(source.value),
        searchInternetArchive(source.value, 3, 'collection:(adult) OR mediatype:(movies)')
      ]
    : [
        searchWikimediaVideos(source.value, 5),
        searchNasaVideos(source.value, 3),
        searchRedditVideosByKeyword(source.value),
        searchInternetArchive(source.value, 3),
        searchPrelingerArchives(source.value, 2),
        searchPeerTubeVideos(source.value, 3),
        searchFediverseVideos(source.value),
        searchFreeTubeSites(source.value, 4)
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
  const effectiveSources = getEffectiveActiveSources();
  if (remainingAhead < 2 && !isBackgroundRefilling && effectiveSources.length > 0) {
    isBackgroundRefilling = true;
    try {
      const randomSource = effectiveSources[Math.floor(Math.random() * effectiveSources.length)];
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
  if (typeof document !== 'undefined') {
    document.body?.classList?.toggle('reels-mode-active', isReelsFullscreen);
    document.querySelector?.('.app-container')?.classList?.toggle('reels-mode-active', isReelsFullscreen);
    document.querySelector?.('.app-main')?.classList?.toggle('reels-mode-active', isReelsFullscreen);
    document.getElementById('appHeader')?.classList?.toggle('hidden', isReelsFullscreen);
    document.querySelector?.('.bottom-nav')?.classList?.toggle('hidden', isReelsFullscreen);
    const videoEl = document.getElementById('mainVideo');
    if (videoEl) {
      if (videoEl.style) {
        videoEl.style.transition = '';
        videoEl.style.transform = '';
        videoEl.style.opacity = '';
      }
      videoEl.controls = !isReelsFullscreen;
      if (isReelsFullscreen) {
        videoEl.removeAttribute?.('controls');
      } else {
        videoEl.setAttribute?.('controls', '');
      }
    }
  }
  updateReelsSeekerUI();

  if (isReelsFullscreen && currentIndex < 0 && videoQueue.length === 0) {
    pullRandomVideos(3);
  } else {
    updatePlayerUI();
  }
}

function animateReelsSlide(direction = 'next') {
  const isNext = direction !== 'prev';
  if (!isNext && currentIndex <= 0) {
    const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
    if (videoEl?.style) {
      videoEl.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease';
      videoEl.style.transform = 'translate3d(0, 0, 0)';
      videoEl.style.opacity = '1';
    }
    showToast('Top of feed — swipe up for next video');
    return false;
  }

  if (isNext) {
    advanceToNextVideo();
  } else {
    goToPrevVideo();
  }

  const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
  if (isReelsFullscreen && videoEl?.style) {
    const startOffset = isNext ? '82%' : '-82%';
    videoEl.style.transition = 'none';
    videoEl.style.transform = `translate3d(0, ${startOffset}, 0)`;
    videoEl.style.opacity = '0.45';
    const runSlideIn = () => {
      if (!videoEl?.style) return;
      videoEl.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease';
      videoEl.style.transform = 'translate3d(0, 0, 0)';
      videoEl.style.opacity = '1';
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(runSlideIn));
    } else {
      const t = setTimeout(runSlideIn, 16);
      t.unref?.();
    }
  }
  return true;
}

// ==========================================
// SMARTER 18+ DISCOVERY: INTERACTIVE TAGS & "MORE LIKE THIS"
// ==========================================

const TAG_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'you', 'are',
  'was', 'were', 'have', 'has', 'had', 'not', 'but', 'what', 'all', 'when',
  'can', 'more', 'out', 'into', 'just', 'like', 'some', 'time', 'very',
  'video', 'videos', 'clip', 'clips', 'redgifs', 'reddit', 'free', 'tube',
  'watch', 'stream', 'mp4', 'mov', 'webm', 'open', 'media', 'feed', 'random',
  'saved', 'archive', 'highlights', 'picks'
]);

function extractSmartVideoTags(videoItem, maxTags = 5) {
  if (!videoItem || typeof videoItem !== 'object') return [];
  const collected = [];
  const seen = new Set();

  const addCandidate = (raw) => {
    if (!raw || typeof raw !== 'string') return;
    const clean = raw
      .trim()
      .replace(/^[#]+/, '')
      .replace(/^\/?r\//i, 'r/')
      .replace(/[^\w\s/+-]/g, '')
      .trim();
    if (!clean || clean.length < 2) return;
    const key = clean.toLowerCase();
    if (TAG_STOPWORDS.has(key) || seen.has(key)) return;
    seen.add(key);
    collected.push(clean);
  };

  if (Array.isArray(videoItem.tags)) {
    for (const t of videoItem.tags) {
      addCandidate(String(t));
      if (collected.length >= maxTags) return collected.slice(0, maxTags);
    }
  }

  const src = String(videoItem.sourceName || '');
  const subMatch = src.match(/\br\/([a-zA-Z0-9_]+)/i);
  if (subMatch?.[1]) {
    addCandidate(`r/${subMatch[1]}`);
  }
  const parenMatch = src.match(/\(([^)]+)\)/);
  if (parenMatch?.[1]) {
    addCandidate(parenMatch[1]);
  }

  const titleWords = String(videoItem.title || '')
    .replace(/RedGIFs(?:\s+HD)?\s*[:—-]?/gi, ' ')
    .split(/[\s,;|•—–-]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
    .filter((w) => w.length >= 3 && !TAG_STOPWORDS.has(w) && !/^\d+$/.test(w));

  for (const word of titleWords) {
    addCandidate(word);
    if (collected.length >= maxTags) break;
  }

  return collected.slice(0, maxTags);
}

function buildMoreLikeThisQuery(videoItem) {
  if (!videoItem || typeof videoItem !== 'object') return '';
  const tags = extractSmartVideoTags(videoItem, 4);
  const nonSubTags = tags.filter((t) => !/^r\//i.test(t));
  if (nonSubTags.length >= 2) {
    return `${nonSubTags[0]} ${nonSubTags[1]}`.trim();
  }
  if (nonSubTags.length === 1) {
    return nonSubTags[0].trim();
  }
  const subTag = tags.find((t) => /^r\//i.test(t));
  if (subTag) {
    return subTag.replace(/^r\//i, '').trim();
  }
  return String(videoItem.title || '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TAG_STOPWORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .join(' ')
    .trim();
}

async function pullMoreLikeThis(videoItem = videoQueue[currentIndex]) {
  const target = videoItem || videoQueue[currentIndex];
  if (!target) return null;
  const query = buildMoreLikeThisQuery(target);
  if (!query) return null;

  if (typeof document !== 'undefined') {
    const qInput = document.getElementById('quickSearchInput');
    if (qInput) qInput.value = query;
  }
  showToast(`🔥 Pulling more like "${query}"...`);
  await pullRandomVideos(1, query);
  return query;
}

function updatePlayerUI() {
  const videoEl = document.getElementById('mainVideo');
  const titleEl = document.getElementById('videoTitle');
  const badgeEl = document.getElementById('videoSourceBadge');
  const formatBadgeEl = document.getElementById('videoFormatBadge');
  const convertNowBtn = document.getElementById('convertNowBtn');
  const moreLikeBtn = document.getElementById('moreLikeThisBtn');
  const favCurrentBtn = document.getElementById('favoriteCurrentBtn');
  const tagsBarEl = document.getElementById('videoTagsBar');
  const skipBack10Btn = document.getElementById('skipBack10Btn');
  const skipFwd15Btn = document.getElementById('skipFwd15Btn');
  const skipFwd30Btn = document.getElementById('skipFwd30Btn');
  const speedSelectEl = document.getElementById('playbackSpeedSelect');
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
    if (moreLikeBtn) moreLikeBtn.disabled = true;
    if (favCurrentBtn) {
      favCurrentBtn.disabled = true;
      favCurrentBtn.textContent = '🤍 Favorite';
      favCurrentBtn.classList?.remove('active');
    }
    if (skipBack10Btn) skipBack10Btn.disabled = true;
    if (skipFwd15Btn) skipFwd15Btn.disabled = true;
    if (skipFwd30Btn) skipFwd30Btn.disabled = true;
    tagsBarEl?.classList.add('hidden');
    if (tagsBarEl) tagsBarEl.innerHTML = '';
    formatBadgeEl?.classList.add('hidden');
    convertNowBtn?.classList.add('hidden');
    updateReelsSeekerUI();
    return;
  }

  emptyEl?.classList.add('hidden');
  savePhoneBtn.disabled = false;
  saveVaultBtn.disabled = false;
  if (moreLikeBtn) moreLikeBtn.disabled = false;
  if (favCurrentBtn) {
    favCurrentBtn.disabled = false;
    favCurrentBtn.textContent = current.isFavorite ? '❤️ Favorited' : '🤍 Favorite';
    favCurrentBtn.classList?.toggle('active', Boolean(current.isFavorite));
  }
  if (skipBack10Btn) skipBack10Btn.disabled = false;
  if (skipFwd15Btn) skipFwd15Btn.disabled = false;
  if (skipFwd30Btn) skipFwd30Btn.disabled = false;
  if (speedSelectEl) {
    speedSelectEl.value = String(settings.playbackSpeed || 1);
  }

  if (tagsBarEl) {
    const smartTags = extractSmartVideoTags(current, 5);
    if (smartTags.length > 0) {
      tagsBarEl.innerHTML = smartTags
        .map(
          (tag) =>
            `<button type="button" class="video-tag-chip" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`
        )
        .join('');
      tagsBarEl.classList.remove('hidden');
    } else {
      tagsBarEl.innerHTML = '';
      tagsBarEl.classList.add('hidden');
    }
  }

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
  const savedTime = getSavedPlaybackTime(current);
  if (videoEl.src !== targetPlayUrl) {
    videoEl.dataset.autoConvertAttempted = 'false';
    if ((current.isNsfw || current.over_18 || settings.allowNsfw) && settings.autoMuteNsfw) {
      videoEl.muted = true;
    }
    videoEl.src = targetPlayUrl;
    videoEl.load();
    videoEl.playbackRate = settings.playbackSpeed || 1;
    if (savedTime > 0) {
      try {
        videoEl.currentTime = savedTime;
      } catch {}
      videoEl.addEventListener?.(
        'loadedmetadata',
        () => {
          try {
            if (!videoEl.duration || savedTime < videoEl.duration - 0.5) {
              videoEl.currentTime = savedTime;
            }
          } catch {}
        },
        { once: true }
      );
    }
    if (settings.autoPlay) {
      videoEl.play().catch(() => {
        // iOS may require user tap if unmuted; user can tap play on controls
      });
    }
  } else if (savedTime > 0 && (!videoEl.currentTime || Math.abs(videoEl.currentTime - savedTime) > 1.5)) {
    try {
      videoEl.currentTime = savedTime;
    } catch {}
  }
  if (videoEl) {
    videoEl.playbackRate = settings.playbackSpeed || 1;
  }

  updateReelsSeekerUI();
  savePlaybackState(savedTime > 0 ? savedTime : null);

  // Trigger background pre-buffering for the upcoming video
  scheduleBackgroundQueuePrebuffer();
}

function advanceToNextVideo() {
  savePlaybackState();
  if (currentIndex < videoQueue.length - 1) {
    currentIndex++;
    updatePlayerUI();
  } else {
    pullRandomVideos(1);
  }
}

function goToPrevVideo() {
  savePlaybackState();
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
        label: customKeyword,
        isNsfw: Boolean(settings.allowNsfw && settings.nsfwMode === 'strict')
      });
    } else {
      const activeSources = getEffectiveActiveSources();
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
// DOWNLOAD TO IPHONE (PHOTOS / FILES) WITH AUTO-CONVERSION & DISCREET FILENAMES
// ==========================================

function buildExportFilename(videoItem, ext = 'mp4') {
  const safeExt = String(ext || 'mp4').replace(/^\./, '').toLowerCase() || 'mp4';
  const isNsfwVideo = Boolean(videoItem?.isNsfw || videoItem?.over_18 || settings.allowNsfw);

  if (settings.discreetFilenames && isNsfwVideo) {
    const rawId = String(videoItem?.id || videoItem?.videoUrl || '1042');
    let hash = 0;
    for (let i = 0; i < rawId.length; i++) {
      hash = (hash * 31 + rawId.charCodeAt(i)) % 9000;
    }
    const code = 1000 + Math.abs(hash);
    return `reelvault-clip-${code}.${safeExt}`;
  }

  const baseSlug = (videoItem?.title || 'reelvault-video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'reelvault-video';
  return `${baseSlug}.${safeExt}`;
}

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

    const cleanFileName = buildExportFilename(videoItem, ext || 'mp4');
    const isDiscreet = settings.discreetFilenames && Boolean(videoItem?.isNsfw || videoItem?.over_18 || settings.allowNsfw);
    const file = new File([blob], cleanFileName, { type: mime || 'video/mp4' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      if (statusText) statusText.textContent = 'Opening iPhone Save menu...';
      await navigator.share({
        files: [file],
        title: isDiscreet ? 'ReelVault Clip' : (videoItem.title || 'ReelVault Video')
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
      a.download = buildExportFilename(videoItem, fallbackExt);
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

  const visibleSources = settings.allowNsfw
    ? sources
    : sources.filter((s) => !s.isNsfw);

  if (visibleSources.length === 0) {
    container.innerHTML = `<p class="muted-center">No sources configured. Add one above!</p>`;
    return;
  }

  const typeBadges = {
    keyword: '🔍 Keyword',
    subreddit: '👽 Subreddit',
    url: '🔗 URL'
  };

  container.innerHTML = visibleSources
    .map(
      (s) => `
      <div class="source-item">
        <div class="source-info">
          <div class="source-name">
            ${escapeHtml(s.label || s.value)}
            ${s.isNsfw ? '<span class="nsfw-badge">🔞 18+</span>' : ''}
          </div>
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
      const nsfwTag = item.isNsfw ? `<span class="nsfw-badge">🔞 18+</span>` : '';
      return `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <div class="vli-badges">
            ${nsfwTag}
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
  const allItems = await getAllVaultVideos();
  const listEl = document.getElementById('vaultList');
  const badgeEl = document.getElementById('vaultBadge');
  const summaryEl = document.getElementById('vaultStorageSummary');
  const hiddenNoticeEl = document.getElementById('vaultHiddenNotice');
  const vaultFilterEl = document.getElementById('vaultFilterSelect');

  const hiddenNsfwCount = !settings.allowNsfw
    ? allItems.filter((item) => Boolean(item.isNsfw)).length
    : 0;

  if (hiddenNoticeEl) {
    hiddenNoticeEl.classList.toggle('hidden', !(hiddenNsfwCount > 0 && !settings.allowNsfw));
  }
  if (vaultFilterEl) {
    vaultFilterEl.classList.toggle('hidden', !settings.allowNsfw);
  }

  const items = allItems.filter((item) => {
    if (!settings.allowNsfw && item.isNsfw) {
      return false;
    }
    if (settings.vaultFilter === 'favorites') {
      return Boolean(item.isFavorite);
    }
    if (settings.vaultFilter === 'nsfw') {
      return Boolean(item.isNsfw);
    }
    if (settings.vaultFilter === 'nsfw_favorites') {
      return Boolean(item.isNsfw && item.isFavorite);
    }
    if (settings.vaultFilter === 'sfw') {
      return !item.isNsfw;
    }
    return true;
  });

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
      const nsfwBadgeHtml = item.isNsfw ? `<span class="nsfw-badge">🔞 18+</span>` : '';

      return `
      <div class="video-list-item">
        <div class="vli-header">
          <div class="vli-title">${escapeHtml(item.title)}</div>
          <div class="vli-badges">
            ${nsfwBadgeHtml}
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
          <button
            class="fav-btn ${item.isFavorite ? 'active' : ''}"
            data-action="favorite-vault-item"
            data-id="${escapeHtml(item.id)}"
            title="Toggle Favorite"
          >
            ${item.isFavorite ? '❤️' : '🤍'}
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
  if (settings.allowNsfw) {
    unlockAdultPresetSources();
  }
  updateHeaderSummary();
  renderSourcesList();
  await renderVaultList();
  initBookmarkletAndUrlParams();

  // Sync settings controls
  const nsfwToggle = document.getElementById('allowNsfwToggle');
  const nsfwModeSelect = document.getElementById('nsfwModeSelect');
  const autoMuteNsfwToggle = document.getElementById('autoMuteNsfwToggle');
  const resumePlaybackToggle = document.getElementById('resumePlaybackToggle');
  const discreetFilenamesToggle = document.getElementById('discreetFilenamesToggle');
  const tubeDurationSelect = document.getElementById('tubeDurationSelect');
  const tubeQualitySelect = document.getElementById('tubeQualitySelect');
  const vaultFilterSelect = document.getElementById('vaultFilterSelect');
  const autoPlayToggle = document.getElementById('autoPlayToggle');
  const formatModeSelect = document.getElementById('formatModeSelect');
  const autoConvertToggle = document.getElementById('autoConvertToggle');
  const autoAdvanceToggle = document.getElementById('autoAdvanceToggle');
  const prebufferToggle = document.getElementById('prebufferToggle');
  const offlineVaultToggle = document.getElementById('offlineVaultToggle');

  if (nsfwToggle) nsfwToggle.checked = Boolean(settings.allowNsfw);
  if (autoMuteNsfwToggle) autoMuteNsfwToggle.checked = settings.autoMuteNsfw !== false;
  if (resumePlaybackToggle) resumePlaybackToggle.checked = settings.resumePlayback !== false;
  if (discreetFilenamesToggle) discreetFilenamesToggle.checked = settings.discreetFilenames !== false;
  if (tubeDurationSelect) tubeDurationSelect.value = settings.tubeDurationFilter || 'all';
  if (tubeQualitySelect) tubeQualitySelect.value = settings.tubeQualityFilter || 'all';
  if (vaultFilterSelect) vaultFilterSelect.value = settings.vaultFilter || 'all';
  syncAgeGateUI();
  if (autoPlayToggle) autoPlayToggle.checked = Boolean(settings.autoPlay);
  if (formatModeSelect) formatModeSelect.value = settings.formatMode || 'all';
  if (autoConvertToggle) autoConvertToggle.checked = settings.autoConvert !== false;
  if (autoAdvanceToggle) autoAdvanceToggle.checked = settings.autoAdvance !== false;
  if (prebufferToggle) prebufferToggle.checked = settings.prebuffer !== false;
  if (offlineVaultToggle) offlineVaultToggle.checked = settings.offlineVaultCache !== false;

  // Restore last watched video and timestamp if no deep-link query/scan was launched
  if (videoQueue.length === 0 && settings.resumePlayback) {
    restorePlaybackState();
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => reg?.update?.())
      .catch(() => {});
  }

  // Save & resume playback position when backgrounded or returning to the app
  document.addEventListener('visibilitychange', () => {
    handleVisibilityPlaybackChange();
  });
  window.addEventListener?.('pagehide', () => {
    savePlaybackState();
  });

  // Panic / Boss Key Button & Header Triple-Tap Gesture
  document.getElementById('panicSafeBtn')?.addEventListener('click', () => {
    triggerPanicSafeMode();
  });

  let headerTapCount = 0;
  let headerTapTimer = null;
  document.getElementById('appHeader')?.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    headerTapCount++;
    clearTimeout(headerTapTimer);
    if (headerTapCount >= 3) {
      headerTapCount = 0;
      triggerPanicSafeMode();
    } else {
      headerTapTimer = setTimeout(() => {
        headerTapCount = 0;
      }, 450);
    }
  });

  // 1-Tap 18+ Category Chips & Feed Mode Pill on Player Tab
  document.getElementById('nsfwQuickModeBtn')?.addEventListener('click', () => {
    const nextMode = settings.nsfwMode === 'strict' ? 'mixed' : 'strict';
    settings.nsfwMode = nextMode;
    sourcePoolCache.clear();
    saveSettings();
    syncAgeGateUI();
    showToast(
      nextMode === 'strict'
        ? '🔥 Switched to Strict 18+ Only Mode'
        : '🔞 Switched to Mixed (SFW + 18+) Mode'
    );
  });

  document.getElementById('nsfwQuickChipsBar')?.addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-nsfw-query]');
    if (!chip) return;
    const q = chip.dataset.nsfwQuery;
    if (!q) return;
    const qInput = document.getElementById('quickSearchInput');
    if (qInput) qInput.value = q;
    pullRandomVideos(1, q);
  });

  // 1-Tap 18+ Search Category Chips on Search Web Tab
  document.getElementById('searchNsfwChipsBar')?.addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-search-chip]');
    if (!chip) return;
    const q = chip.dataset.searchChip;
    const searchInput = document.getElementById('deepSearchInput');
    if (searchInput && q) {
      searchInput.value = q;
      document.getElementById('deepSearchForm')?.requestSubmit?.();
    }
  });

  tubeDurationSelect?.addEventListener('change', () => {
    settings.tubeDurationFilter = tubeDurationSelect.value || 'all';
    saveSettings();
  });

  tubeQualitySelect?.addEventListener('change', () => {
    settings.tubeQualityFilter = tubeQualitySelect.value || 'all';
    saveSettings();
  });

  const mainVideoEl = document.getElementById('mainVideo');

  // Track playback position so user can pick up right where they left off & sync Reels seeker
  mainVideoEl?.addEventListener('timeupdate', () => {
    savePlaybackState();
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('loadedmetadata', () => {
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('durationchange', () => {
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('play', () => {
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('pause', () => {
    savePlaybackState();
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('volumechange', () => {
    updateReelsSeekerUI();
  });

  // Auto-Advance on Video End
  mainVideoEl?.addEventListener('ended', () => {
    const current = videoQueue[currentIndex];
    if (current) {
      current.resumeTime = 0;
      const key = getPlaybackItemKey(current);
      if (key) delete playbackPositions[key];
      savePlaybackState(0);
    }
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
  document.getElementById('reelsSkip15Btn')?.addEventListener('click', () => {
    skipVideoTime(15);
    showToast('⏩ Skipped +15s');
  });
  document.getElementById('reelsMoreLikeBtn')?.addEventListener('click', async () => {
    await pullMoreLikeThis();
  });
  document.getElementById('reelsSavePhoneBtn')?.addEventListener('click', () => {
    const current = videoQueue[currentIndex];
    if (current) downloadVideoToIphone(current);
  });
  document.getElementById('reelsVaultBtn')?.addEventListener('click', async () => {
    const current = videoQueue[currentIndex];
    if (current) await saveAndCacheVideoToVault(current);
  });

  // Fullscreen Reels Video Seeker Bar Controls
  const reelsSeekSlider = document.getElementById('reelsSeekSlider');
  const reelsSeekerBar = document.getElementById('reelsSeekerBar');

  reelsSeekerBar?.addEventListener(
    'touchstart',
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );
  reelsSeekerBar?.addEventListener(
    'touchmove',
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );
  reelsSeekerBar?.addEventListener(
    'touchend',
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );

  reelsSeekSlider?.addEventListener('pointerdown', () => {
    isScrubbingReelsSeeker = true;
  });
  reelsSeekSlider?.addEventListener('pointerup', () => {
    isScrubbingReelsSeeker = false;
  });
  reelsSeekSlider?.addEventListener(
    'touchstart',
    (e) => {
      isScrubbingReelsSeeker = true;
      e.stopPropagation();
    },
    { passive: true }
  );
  reelsSeekSlider?.addEventListener(
    'touchend',
    (e) => {
      isScrubbingReelsSeeker = false;
      e.stopPropagation();
    },
    { passive: true }
  );
  reelsSeekSlider?.addEventListener('input', (e) => {
    seekVideoToPercent(e.target.value);
  });
  reelsSeekSlider?.addEventListener('change', (e) => {
    isScrubbingReelsSeeker = false;
    seekVideoToPercent(e.target.value);
  });

  document.getElementById('reelsPlayPauseBtn')?.addEventListener('click', () => {
    if (!mainVideoEl) return;
    if (mainVideoEl.paused) {
      mainVideoEl.play().catch(() => {});
    } else {
      mainVideoEl.pause();
    }
    updateReelsSeekerUI();
  });

  document.getElementById('reelsMuteBtn')?.addEventListener('click', () => {
    if (!mainVideoEl) return;
    mainVideoEl.muted = !mainVideoEl.muted;
    updateReelsSeekerUI();
  });

  // Quick Skip (-10s / +15s / +30s) & Playback Speed Controls
  document.getElementById('skipBack10Btn')?.addEventListener('click', () => {
    skipVideoTime(-10);
  });
  document.getElementById('skipFwd15Btn')?.addEventListener('click', () => {
    skipVideoTime(15);
  });
  document.getElementById('skipFwd30Btn')?.addEventListener('click', () => {
    skipVideoTime(30);
  });
  document.getElementById('playbackSpeedSelect')?.addEventListener('change', (e) => {
    const rate = setPlaybackSpeed(e.target.value);
    showToast(`Playback speed: ${rate}x`);
  });

  // Smarter 18+ Discovery: Interactive Video Tags, More Like This & Favorite Button
  document.getElementById('moreLikeThisBtn')?.addEventListener('click', async () => {
    await pullMoreLikeThis();
  });
  document.getElementById('favoriteCurrentBtn')?.addEventListener('click', async () => {
    await toggleCurrentVideoFavorite();
  });
  document.getElementById('videoTagsBar')?.addEventListener('click', async (e) => {
    const tagBtn = e.target.closest('button[data-tag]');
    if (!tagBtn) return;
    const rawTag = tagBtn.dataset.tag;
    if (!rawTag) return;
    const cleanQuery = rawTag.replace(/^r\//i, '').trim();
    const qInput = document.getElementById('quickSearchInput');
    if (qInput) qInput.value = cleanQuery;
    showToast(`🏷️ Pulling "${rawTag}" videos...`);
    await pullRandomVideos(1, cleanQuery);
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

  // Swipe Left/Right AND TikTok-Style Vertical Drag/Scroll (in Reels Mode) + Double-Tap to Vault on Video Stage
  const stage = document.getElementById('videoStage');
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isDraggingReels = false;
  let lastTapTime = 0;
  let singleTapTimer = null;
  let lastWheelTime = 0;

  const getTouchCoords = (touchList) => {
    const t = touchList?.[0];
    if (!t) return { x: 0, y: 0 };
    return {
      x: typeof t.clientX === 'number' ? t.clientX : t.screenX || 0,
      y: typeof t.clientY === 'number' ? t.clientY : t.screenY || 0
    };
  };

  const snapBackReelsVideo = () => {
    if (!mainVideoEl?.style) return;
    mainVideoEl.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease';
    mainVideoEl.style.transform = 'translate3d(0, 0, 0)';
    mainVideoEl.style.opacity = '1';
  };

  stage?.addEventListener(
    'touchstart',
    (e) => {
      if (e.target.closest?.('.reels-seeker-bar, input[type="range"]')) return;
      const pt = getTouchCoords(e.changedTouches || e.touches);
      touchStartX = pt.x;
      touchStartY = pt.y;
      touchStartTime = Date.now();
      isDraggingReels = false;
      if (isReelsFullscreen && mainVideoEl?.style) {
        mainVideoEl.style.transition = 'none';
      }
    },
    { passive: true }
  );

  stage?.addEventListener(
    'touchmove',
    (e) => {
      if (!isReelsFullscreen) return;
      if (e.target.closest?.('button, .reels-seeker-bar, input[type="range"]')) return;
      const pt = getTouchCoords(e.changedTouches || e.touches);
      const dx = pt.x - touchStartX;
      const dy = pt.y - touchStartY;

      if (Math.abs(dy) > 6 && Math.abs(dy) >= Math.abs(dx)) {
        isDraggingReels = true;
        e.preventDefault?.();
        if (mainVideoEl?.style) {
          const dampedDy = currentIndex <= 0 && dy > 0 ? dy * 0.28 : dy * 0.85;
          mainVideoEl.style.transition = 'none';
          mainVideoEl.style.transform = `translate3d(0, ${Math.round(dampedDy)}px, 0)`;
          mainVideoEl.style.opacity = String(Math.max(0.45, 1 - Math.abs(dy) / 520));
        }
      }
    },
    { passive: false }
  );

  stage?.addEventListener(
    'touchcancel',
    () => {
      if (isDraggingReels) {
        isDraggingReels = false;
        snapBackReelsVideo();
      }
    },
    { passive: true }
  );

  stage?.addEventListener(
    'touchend',
    async (e) => {
      if (e.target.closest?.('.reels-seeker-bar, input[type="range"]')) return;
      const pt = getTouchCoords(e.changedTouches || e.touches);
      const dx = pt.x - touchStartX;
      const dy = pt.y - touchStartY;
      const elapsed = Math.max(1, Date.now() - touchStartTime);
      const vy = dy / elapsed;

      // Vertical Swipe in Fullscreen Reels Mode (Swipe Up = Next, Swipe Down = Prev)
      if (isReelsFullscreen && Math.abs(dy) > Math.abs(dx)) {
        const crossedThreshold = Math.abs(dy) > 45 || (Math.abs(dy) > 20 && Math.abs(vy) > 0.35);
        if (crossedThreshold) {
          isDraggingReels = false;
          if (dy < 0) {
            animateReelsSlide('next');
          } else {
            animateReelsSlide('prev');
          }
          return;
        }
        if (isDraggingReels) {
          isDraggingReels = false;
          snapBackReelsVideo();
          return;
        }
      }

      // Horizontal Swipe (Left = Next, Right = Prev)
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)) {
        isDraggingReels = false;
        if (dx < 0) {
          if (isReelsFullscreen) animateReelsSlide('next');
          else advanceToNextVideo();
        } else {
          if (isReelsFullscreen) animateReelsSlide('prev');
          else goToPrevVideo();
        }
        return;
      }

      if (isDraggingReels) {
        isDraggingReels = false;
        snapBackReelsVideo();
      }

      // Double-tap on video stage to save to Offline Vault (or single-tap in Reels mode to Play/Pause)
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && !e.target.closest('button, .reels-seeker-bar, input[type="range"]')) {
        const now = Date.now();
        if (now - lastTapTime < 280) {
          clearTimeout(singleTapTimer);
          singleTapTimer = null;
          const current = videoQueue[currentIndex];
          if (current) {
            const fb = document.getElementById('doubleTapFeedback');
            fb?.classList.remove('hidden');
            setTimeout(() => fb?.classList.add('hidden'), 1100);
            await saveAndCacheVideoToVault(current);
          }
        } else if (isReelsFullscreen && mainVideoEl) {
          clearTimeout(singleTapTimer);
          singleTapTimer = setTimeout(() => {
            if (mainVideoEl.paused) {
              mainVideoEl.play().catch(() => {});
            } else {
              mainVideoEl.pause();
            }
            updateReelsSeekerUI();
          }, 285);
        }
        lastTapTime = now;
      }
    },
    { passive: true }
  );

  // Trackpad / Mouse Wheel Vertical Scroll in Fullscreen Reels Mode
  stage?.addEventListener(
    'wheel',
    (e) => {
      if (!isReelsFullscreen) return;
      if (Math.abs(e.deltaY) < 25) return;
      e.preventDefault?.();
      const now = Date.now();
      if (now - lastWheelTime < 420) return;
      lastWheelTime = now;
      if (e.deltaY > 0) {
        animateReelsSlide('next');
      } else {
        animateReelsSlide('prev');
      }
    },
    { passive: false }
  );

  // Keyboard Up / Down / Escape Navigation in Fullscreen Reels Mode
  document.addEventListener?.('keydown', (e) => {
    if (!isReelsFullscreen) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault?.();
      animateReelsSlide('next');
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault?.();
      animateReelsSlide('prev');
    } else if (e.key === 'Escape') {
      toggleReelsFullscreen(false);
    }
  });

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

  // TAB 2: Multi-Engine Search Form (All Open Networks + RedGIFs HD + Tube Filters)
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
    const useTubeSites = document.getElementById('engTubeSites')?.checked;
    const useRedgifs = document.getElementById('engRedgifs')?.checked;

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
    if (useTubeSites) tasks.push(searchFreeTubeSites(query, 6));
    if (useRedgifs && settings.allowNsfw) tasks.push(searchRedgifsVideos(query, 6));

    const settled = await Promise.allSettled(tasks);
    const combined = [];
    for (const r of settled) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        combined.push(...r.value);
      }
    }

    renderSearchResults(filterAndSortTubeResults(combined));
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
    const markNsfw = Boolean(document.getElementById('newSourceNsfwCheck')?.checked);

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
      builtIn: false,
      isNsfw: markNsfw
    });

    saveSources();
    renderSourcesList();
    e.target.reset();
    showToast('Added source to your list!');
  });

  document.getElementById('loadAdultPresetsBtn')?.addEventListener('click', () => {
    const added = unlockAdultPresetSources();
    renderSourcesList();
    showToast(added > 0 ? `Unlocked ${added} built-in 18+ sources!` : '18+ Source Pack already in your list');
  });

  // TAB 3: Expandable 18+ Subreddit & Niche Directory Controls
  document.getElementById('toggleAdultDirectoryBtn')?.addEventListener('click', () => {
    toggleAdultDirectory();
  });

  document.getElementById('enableAllDirectoryBtn')?.addEventListener('click', () => {
    const count = enableAllDirectorySources();
    showToast(
      count > 0
        ? `🔞 Enabled ${count} 18+ directory sources!`
        : 'All 18+ directory sources are already active!'
    );
  });

  document.getElementById('adultDirectoryList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const dirId = btn.dataset.dirId;
    if (!dirId) return;

    if (btn.dataset.action === 'toggle-dir-source') {
      const updated = toggleDirectorySource(dirId);
      if (updated) {
        showToast(
          updated.enabled
            ? `🔞 Enabled "${updated.label}"`
            : `Disabled "${updated.label}"`
        );
      }
    } else if (btn.dataset.action === 'pull-dir-source') {
      const entry = findDirectoryEntry(dirId);
      if (!entry) return;
      switchTab('view-discover');
      if (entry.type === 'subreddit') {
        setPlayerLoading(true, `Pulling from r/${entry.value}...`);
        try {
          const items = await fetchSubredditVideos(entry.value);
          if (items.length > 0) {
            const pick = items[Math.floor(Math.random() * items.length)];
            videoQueue.push(pick);
            currentIndex = videoQueue.length - 1;
            updatePlayerUI();
            showToast(`🔞 Loaded clip from r/${entry.value}!`);
          } else {
            await pullRandomVideos(1, entry.value);
          }
        } catch {
          await pullRandomVideos(1, entry.value);
        } finally {
          setPlayerLoading(false);
        }
      } else {
        await pullRandomVideos(1, entry.value);
      }
    }
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

  nsfwModeSelect?.addEventListener('change', () => {
    const val = nsfwModeSelect.value;
    if (val === 'safe') {
      setAdultContentEnabled(false);
    } else {
      settings.nsfwMode = val;
      if (settings.allowNsfw) {
        setAdultContentEnabled(true, val);
      } else {
        openAgeGateModal();
      }
    }
  });

  autoMuteNsfwToggle?.addEventListener('change', () => {
    settings.autoMuteNsfw = autoMuteNsfwToggle.checked;
    saveSettings();
    showToast(settings.autoMuteNsfw ? 'Auto-mute enabled for 18+ videos' : 'Auto-mute disabled');
  });

  resumePlaybackToggle?.addEventListener('change', () => {
    settings.resumePlayback = resumePlaybackToggle.checked;
    saveSettings();
    if (settings.resumePlayback) {
      savePlaybackState();
      showToast('Resume video where you left off enabled');
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.PLAYBACK_STATE);
      } catch {}
      showToast('Resume playback disabled');
    }
  });

  discreetFilenamesToggle?.addEventListener('change', () => {
    settings.discreetFilenames = discreetFilenamesToggle.checked;
    saveSettings();
    showToast(
      settings.discreetFilenames
        ? 'Discreet filenames enabled for 18+ saves'
        : 'Using original titles when saving'
    );
  });

  // 4-Digit PIN & FaceID Lock Settings
  document.getElementById('saveNsfwPinBtn')?.addEventListener('click', () => {
    const pinInput = document.getElementById('nsfwPinInput');
    const ok = setNsfwPin(pinInput?.value);
    if (ok) {
      if (pinInput) pinInput.value = '';
      showToast('🔒 Saved 4-digit PIN lock for 18+ mode & Vault!');
    } else {
      showToast('Please enter a 4-digit numeric PIN (e.g. 1234)');
    }
  });

  document.getElementById('clearNsfwPinBtn')?.addEventListener('click', () => {
    clearNsfwPin();
    const pinInput = document.getElementById('nsfwPinInput');
    if (pinInput) pinInput.value = '';
    showToast('🔓 Cleared PIN & FaceID lock');
  });

  document.getElementById('setupBiometricBtn')?.addEventListener('click', async () => {
    try {
      const ok = await registerNsfwBiometric();
      if (ok) {
        showToast('🔒 iPhone FaceID / TouchID lock enabled!');
      }
    } catch {
      showToast('FaceID / TouchID setup unavailable or cancelled.');
    }
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
    if (settings.nsfwPin) {
      const enteredPin = document.getElementById('ageGatePinInput')?.value;
      if (!verifyNsfwPin(enteredPin)) {
        document.getElementById('ageGatePinError')?.classList.remove('hidden');
        return;
      }
    }
    const chosenMode = document.getElementById('ageGateModeSelect')?.value || settings.nsfwMode || 'strict';
    setAdultContentEnabled(true, chosenMode);
    closeAgeGateModal();
  });

  document.getElementById('ageGateBiometricBtn')?.addEventListener('click', async () => {
    try {
      const verified = await authenticateNsfwBiometric();
      if (verified) {
        const chosenMode = document.getElementById('ageGateModeSelect')?.value || settings.nsfwMode || 'strict';
        setAdultContentEnabled(true, chosenMode);
        closeAgeGateModal();
      } else {
        showToast('FaceID / TouchID verification failed.');
      }
    } catch {
      showToast('FaceID / TouchID verification cancelled.');
    }
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
      nsfwMode: 'mixed',
      autoMuteNsfw: true,
      resumePlayback: true,
      discreetFilenames: true,
      nsfwPin: '',
      nsfwBiometricId: '',
      tubeDurationFilter: 'all',
      tubeQualityFilter: 'all',
      vaultFilter: 'all',
      autoPlay: true,
      formatMode: 'all',
      autoConvert: true,
      autoAdvance: true,
      prebuffer: true,
      offlineVaultCache: true
    };
    if (nsfwToggle) nsfwToggle.checked = false;
    if (resumePlaybackToggle) resumePlaybackToggle.checked = true;
    if (autoPlayToggle) autoPlayToggle.checked = true;
    if (formatModeSelect) formatModeSelect.value = 'all';
    if (autoConvertToggle) autoConvertToggle.checked = true;
    if (autoAdvanceToggle) autoAdvanceToggle.checked = true;
    if (prebufferToggle) prebufferToggle.checked = true;
    if (offlineVaultToggle) offlineVaultToggle.checked = true;
    videoQueue = [];
    currentIndex = -1;
    playbackPositions = {};
    seenUrls.clear();
    try {
      localStorage.removeItem(STORAGE_KEYS.PLAYBACK_STATE);
    } catch {}
    saveSources();
    saveSettings();
    syncAgeGateUI();
    renderSourcesList();
    updatePlayerUI();
    showToast('Reset to default sources & settings');
  });

  // TAB 4: Vault Filter, Unlock & Actions
  vaultFilterSelect?.addEventListener('change', async () => {
    settings.vaultFilter = vaultFilterSelect.value || 'all';
    saveSettings();
    await renderVaultList();
  });

  document.getElementById('unlockVaultBtn')?.addEventListener('click', () => {
    openAgeGateModal();
  });

  document.getElementById('shuffleVaultBtn')?.addEventListener('click', async () => {
    await shuffleVaultToPlayer({ startReels: false });
  });

  document.getElementById('reelsVaultPlayBtn')?.addEventListener('click', async () => {
    await shuffleVaultToPlayer({ startReels: true });
  });

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
    } else if (btn.dataset.action === 'favorite-vault-item') {
      await toggleVaultFavorite(id);
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
  document.getElementById('copyAppLinkBtn')?.addEventListener('click', async () => {
    const shareUrl =
      typeof window !== 'undefined' && window.location && /^https?:/i.test(window.location.href)
        ? window.location.href.split('#')[0]
        : 'https://davidscottballard1-png.github.io/my-project-2/';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'ReelVault — iPhone Video Puller',
          text: 'Open ReelVault in Safari on iPhone and tap Add to Home Screen:',
          url: shareUrl
        });
        return;
      } catch (_err) {
        // Fallback to clipboard copy if share sheet dismissed
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('iPhone app link copied to clipboard!');
        return;
      } catch (_err) {
        // ignore
      }
    }
    showToast(`Open in Safari: ${shareUrl}`);
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
    ADULT_PRESET_SOURCES,
    ADULT_DIRECTORY_CATALOG,
    PLAYBACK_SPEED_OPTIONS,
    FALLBACK_VIDEOS,
    settings,
    detectVideoFormat,
    isFormatAllowedBySettings,
    normalizeAndAutoRewriteVideoUrl,
    getFormatBadgeInfo,
    getEffectivePlaybackUrl,
    needsMp4Conversion,
    encodeArchiveFilePath,
    extractRedgifsId,
    resolveRedgifsUrlToMp4,
    searchRedgifsVideos,
    filterAndSortTubeResults,
    extractRedditVideosFromListing,
    extractVideoUrlsFromHtml,
    searchFreeTubeSites,
    parseM3u8Manifest,
    downloadAndAssembleM3u8Stream,
    escapeHtml,
    obtainIphoneReadyVideoBlob,
    setPlayerLoading,
    updatePlayerUI,
    advanceToNextVideo,
    goToPrevVideo,
    toggleReelsFullscreen,
    animateReelsSlide,
    extractSmartVideoTags,
    buildMoreLikeThisQuery,
    pullMoreLikeThis,
    formatVideoTime,
    updateReelsSeekerUI,
    seekVideoToPercent,
    skipVideoTime,
    setPlaybackSpeed,
    findDirectoryEntry,
    toggleDirectorySource,
    enableAllDirectorySources,
    toggleAdultDirectory,
    renderAdultDirectory,
    switchTab,
    renderSourcesList,
    renderSearchResults,
    renderVaultList,
    saveVideoToVaultDB,
    toggleVaultFavorite,
    toggleCurrentVideoFavorite,
    shuffleVaultToPlayer,
    getAllVaultVideos,
    deleteVaultVideoDB,
    clearVaultDB,
    buildExportFilename,
    downloadVideoToIphone,
    loadState,
    saveSources,
    saveSettings,
    initBookmarkletAndUrlParams,
    updateHeaderSummary,
    unlockAdultPresetSources,
    getEffectiveActiveSources,
    setNsfwPin,
    clearNsfwPin,
    verifyNsfwPin,
    registerNsfwBiometric,
    authenticateNsfwBiometric,
    scrubNsfwFromActiveSession,
    triggerPanicSafeMode,
    getSavedPlaybackTime,
    savePlaybackState,
    restorePlaybackState,
    handleVisibilityPlaybackChange,
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
      isAdultDirectoryExpanded,
      lastSearchResults,
      playbackPositions
    }),
    setAppState: (patch = {}) => {
      if (Array.isArray(patch.sources)) sources = patch.sources;
      if (Array.isArray(patch.videoQueue)) {
        videoQueue = patch.videoQueue;
        if (patch.videoQueue.length === 0 && !patch.playbackPositions) {
          playbackPositions = {};
        }
      }
      if (typeof patch.currentIndex === 'number') currentIndex = patch.currentIndex;
      if (typeof patch.isReelsFullscreen === 'boolean') isReelsFullscreen = patch.isReelsFullscreen;
      if (typeof patch.isAdultDirectoryExpanded === 'boolean') {
        isAdultDirectoryExpanded = patch.isAdultDirectoryExpanded;
      }
      if (Array.isArray(patch.lastSearchResults)) lastSearchResults = patch.lastSearchResults;
      if (patch.playbackPositions && typeof patch.playbackPositions === 'object') {
        playbackPositions = patch.playbackPositions;
      }
    }
  };
}
