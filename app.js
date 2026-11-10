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
    id: 'src-nsfw-sub-realgirls',
    type: 'subreddit',
    value: 'RealGirls',
    label: '🔞 r/RealGirls Verified',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-sub-amateur',
    type: 'subreddit',
    value: 'Amateur',
    label: '🔞 r/Amateur Community',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-sub-sensual',
    type: 'subreddit',
    value: 'sensual',
    label: '🔞 r/sensual Romantic',
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
    id: 'src-nsfw-romantic',
    type: 'keyword',
    value: 'romantic sensual hd',
    label: '🔞 Romantic & Couples HD',
    enabled: true,
    builtIn: true,
    isNsfw: true
  },
  {
    id: 'src-nsfw-cosplay',
    type: 'keyword',
    value: 'redgifs cosplay',
    label: '🔞 Cosplay & Alt 18+',
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
  },
  {
    id: 'src-nsfw-fulltaboo',
    type: 'url',
    value: 'https://fulltaboo.tv/',
    label: '🔞 FullTaboo.tv Full-Length',
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
      { id: 'dir-sub-sensual', type: 'subreddit', value: 'sensual', label: 'r/sensual — Romantic 18+', isNsfw: true },
      { id: 'dir-sub-couplesgw', type: 'subreddit', value: 'couplesgonewild', label: 'r/couplesgonewild — Couples', isNsfw: true },
      { id: 'dir-sub-gwcouples', type: 'subreddit', value: 'GWCouples', label: 'r/GWCouples — Real Partners', isNsfw: true },
      { id: 'dir-sub-nsfwcosplay', type: 'subreddit', value: 'nsfwcosplay', label: 'r/nsfwcosplay — Cosplay 18+', isNsfw: true },
      { id: 'dir-sub-altgonewild', type: 'subreddit', value: 'altgonewild', label: 'r/altgonewild — Goth & Alt', isNsfw: true }
    ]
  },
  {
    category: '💎 Niche & Aesthetic 18+ Communities',
    items: [
      { id: 'dir-sub-fitgirls', type: 'subreddit', value: 'FitNakedGirls', label: 'r/FitNakedGirls — Athletic & Fit', isNsfw: true },
      { id: 'dir-sub-thick', type: 'subreddit', value: 'thick', label: 'r/thick — Curvy Aesthetic', isNsfw: true },
      { id: 'dir-sub-petite', type: 'subreddit', value: 'PetiteGoneWild', label: 'r/PetiteGoneWild — Petite 18+', isNsfw: true },
      { id: 'dir-sub-palegirls', type: 'subreddit', value: 'palegirls', label: 'r/palegirls — Pale Aesthetic', isNsfw: true },
      { id: 'dir-sub-redheads', type: 'subreddit', value: 'redheads', label: 'r/redheads — Redhead 18+', isNsfw: true },
      { id: 'dir-sub-latinas', type: 'subreddit', value: 'latinas', label: 'r/latinas — Latina 18+', isNsfw: true }
    ]
  },
  {
    category: '🎬 RedGIFs HD & Loop Niches',
    items: [
      { id: 'dir-rg-trending', type: 'keyword', value: 'redgifs trending', label: 'RedGIFs Trending HD', isNsfw: true },
      { id: 'dir-rg-amateur', type: 'keyword', value: 'redgifs amateur hd', label: 'RedGIFs Amateur Clips', isNsfw: true },
      { id: 'dir-rg-solo', type: 'keyword', value: 'redgifs solo tease', label: 'RedGIFs Solo & Tease', isNsfw: true },
      { id: 'dir-rg-cosplay', type: 'keyword', value: 'redgifs cosplay', label: 'RedGIFs Cosplay 18+', isNsfw: true },
      { id: 'dir-rg-couples', type: 'keyword', value: 'redgifs romantic couple', label: 'RedGIFs Romantic Couples', isNsfw: true },
      { id: 'dir-rg-fitness', type: 'keyword', value: 'redgifs fitness gym', label: 'RedGIFs Fitness & Gym', isNsfw: true },
      { id: 'dir-rg-glamour', type: 'keyword', value: 'redgifs glamour boudoir', label: 'RedGIFs Glamour & Boudoir', isNsfw: true },
      { id: 'dir-rg-dance', type: 'keyword', value: 'redgifs dance loop', label: 'RedGIFs Dance & Reels', isNsfw: true }
    ]
  },
  {
    category: '📺 Full-Length 18+ Tube & Archive',
    items: [
      { id: 'dir-tube-fulltaboo', type: 'url', value: 'https://fulltaboo.tv/', label: 'FullTaboo.tv — Full-Length Tube', isNsfw: true },
      { id: 'dir-tube-romantic', type: 'keyword', value: 'romantic sensual hd', label: 'Romantic & Couples HD', isNsfw: true },
      { id: 'dir-tube-amateur', type: 'keyword', value: 'amateur homemade hd', label: 'Full-Length Amateur HD', isNsfw: true },
      { id: 'dir-tube-vintage', type: 'keyword', value: 'vintage erotica classic', label: 'Vintage & Classic Erotica', isNsfw: true },
      { id: 'dir-tube-massage', type: 'keyword', value: 'sensual massage hd', label: 'Sensual Massage HD', isNsfw: true },
      { id: 'dir-tube-glamour', type: 'keyword', value: 'glamour boudoir hd', label: 'Glamour & Boudoir HD', isNsfw: true },
      { id: 'dir-tube-midnight', type: 'keyword', value: 'midnight cult cinema 18+', label: 'Midnight & Cult Classics', isNsfw: true }
    ]
  },
  {
    category: '🌐 Multi-Feed, Federated & Open 18+ Networks',
    items: [
      { id: 'dir-fed-multireddit', type: 'subreddit', value: 'nsfw+NSFW_GIF+RealGirls+Amateur+gonewild+sensual', label: 'Reddit 18+ Mega-Mix (6-in-1)', isNsfw: true },
      { id: 'dir-fed-peertube', type: 'keyword', value: 'peertube nsfw adult', label: 'PeerTube Federated 18+', isNsfw: true },
      { id: 'dir-fed-lemmy', type: 'keyword', value: 'lemmy fediverse nsfw', label: 'Lemmy & Mastodon 18+', isNsfw: true },
      { id: 'dir-fed-archive', type: 'keyword', value: 'classic burlesque cabaret', label: 'Archive Burlesque & Cinema', isNsfw: true },
      { id: 'dir-fed-animated', type: 'keyword', value: 'anime 3d art loop 18+', label: 'Animated & 3D Art 18+', isNsfw: true }
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
  nsfwMode: 'strict', // 'safe' | 'strict' (Mixed Mode removed: 18+ mode is strictly 18+ only)
  autoMuteNsfw: true,
  resumePlayback: true,
  discreetFilenames: true,
  nsfwPin: '',
  nsfwBiometricId: '',
  tubeDurationFilter: 'all', // 'all' | 'short' | 'medium' | 'long'
  tubeQualityFilter: 'all', // 'all' | 'hd'
  vaultFilter: 'all', // 'all' | 'favorites' | 'nsfw' | 'nsfw_favorites'
  playbackSpeed: 1,
  autoPlay: true,
  formatMode: 'all', // 'all' | 'native' | 'mp4'
  autoConvert: true,
  autoAdvance: true,
  prebuffer: true,
  offlineVaultCache: true,
  deletedSourceIds: []
};
let videoQueue = [];
let currentIndex = -1;
let seenUrls = new Set();
let deadUrls = new Set();
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
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
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

    // Try fast container stream copy first (instant for MP4/MKV/MOV/TS/FLV/AVI containing H.264)
    let remuxSucceeded = false;
    if (['mp4', 'mkv', 'mov', 'm4v', 'ts', 'm2ts', 'flv', 'f4v', 'avi'].includes(safeExt)) {
      onProgress?.(`Remuxing .${safeExt.toUpperCase()} container to .MP4...`, 35);
      const remuxArgs = ['-i', inputName, '-c', 'copy'];
      if (safeExt === 'ts' || safeExt === 'm2ts') {
        remuxArgs.push('-bsf:a', 'aac_adtstoasc');
      }
      remuxArgs.push('-movflags', '+faststart', outputName);
      const copyExitCode = await ffmpeg.exec(remuxArgs);
      if (copyExitCode === 0) {
        try {
          const copiedData = await ffmpeg.readFile(outputName);
          if (copiedData && copiedData.byteLength > 1024) {
            remuxSucceeded = true;
            return new Blob([new Uint8Array(copiedData)], { type: 'video/mp4' });
          }
        } catch {
          remuxSucceeded = false;
        }
      }
      try { await ffmpeg.deleteFile(outputName); } catch {}
    }

    // Full transcode to universal iPhone & browser-compatible MP4 (H.264 libx264 + AAC with yuv420p)
    if (!remuxSucceeded) {
      onProgress?.(`Transcoding .${safeExt.toUpperCase()} to iPhone .MP4...`, 25);
      let exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName
      ]);
      if (exitCode !== 0) {
        try { await ffmpeg.deleteFile(outputName); } catch {}
        exitCode = await ffmpeg.exec([
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
      }
      if (exitCode !== 0) {
        throw new Error(`FFmpeg transcode exited with code ${exitCode}`);
      }
      const data = await ffmpeg.readFile(outputName);
      if (!data || data.byteLength < 512) {
        throw new Error('FFmpeg produced empty output');
      }
      return new Blob([new Uint8Array(data)], { type: 'video/mp4' });
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
    tempVideo.muted = false;
    tempVideo.volume = 1;
    tempVideo.playsInline = true;
    tempVideo.preload = 'auto';
    tempVideo.src = srcUrl;
    let audioCtx = null;

    const cleanup = () => {
      try {
        tempVideo.pause();
        tempVideo.removeAttribute('src');
        tempVideo.load();
      } catch {}
      if (audioCtx) {
        try {
          audioCtx.close?.();
        } catch {}
        audioCtx = null;
      }
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

        // Route decoded audio silently into MediaRecorder without speaker output
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          try {
            audioCtx = new AudioCtx();
            await audioCtx.resume?.();
            const mediaSource = audioCtx.createMediaElementSource(tempVideo);
            const mediaDest = audioCtx.createMediaStreamDestination();
            mediaSource.connect(mediaDest);
            for (const audioTrack of mediaDest.stream.getAudioTracks()) {
              stream.addTrack(audioTrack);
            }
          } catch {
            tempVideo.muted = true;
          }
        } else {
          tempVideo.muted = true;
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

// Fetch video bytes with CORS proxy fallback, hard connection timeout, and live progress
async function fetchVideoBlobWithProgress(targetUrl, mimeType, onProgress, progressLabel = 'Downloading video...') {
  let response = null;
  const candidateUrls = [
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  for (const url of candidateUrls) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, 8000)
      : null;
    timer?.unref?.();
    try {
      const res = controller ? await fetch(url, { signal: controller.signal }) : await fetch(url);
      if (timer) clearTimeout(timer);
      if (res && res.ok) {
        const ct = String(res.headers?.get?.('content-type') || '').toLowerCase();
        if (ct.includes('text/html')) {
          continue;
        }
        response = res;
        break;
      }
    } catch {
      if (timer) clearTimeout(timer);
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
  let assembledHls = null;

  if (fmtInfo.ext === 'm3u8') {
    assembledHls = await downloadAndAssembleM3u8Stream(videoItem.videoUrl, onProgress);
    rawBlob = assembledHls.blob;
    effectiveInputExt = assembledHls.ext;
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

  // 5. Graceful fallback: if on-device transcode wasn't possible, return true container extension & MIME
  if (assembledHls) {
    const hlsExt = assembledHls.ext || 'mp4';
    const hlsMime = assembledHls.mime || (hlsExt === 'ts' ? 'video/mp2t' : 'video/mp4');
    return {
      blob: rawBlob,
      ext: hlsExt,
      mime: hlsMime,
      wasConverted: false
    };
  }

  return {
    blob: rawBlob,
    ext: fmtInfo.ext === 'gifv' ? 'mp4' : fmtInfo.ext,
    mime: fmtInfo.ext === 'gifv' ? 'video/mp4' : fmtInfo.mime,
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

    const finalizePut = (existing = null) => {
      if (existing && typeof existing === 'object') {
        if (!copy.id && existing.id) {
          copy.id = existing.id;
        }
        if (!copy.savedAt && existing.savedAt) {
          copy.savedAt = existing.savedAt;
        }
        if (typeof videoItem?.isFavorite !== 'boolean' && typeof existing.isFavorite === 'boolean') {
          copy.isFavorite = existing.isFavorite;
        }
        if (
          !(offlineBlobData?.blob instanceof Blob) &&
          !(copy.offlineBlob instanceof Blob) &&
          existing.hasOfflineBlob
        ) {
          copy.offlineBlob = existing.offlineBlob;
          copy.offlineMime = existing.offlineMime || 'video/mp4';
          copy.offlineExt = existing.offlineExt || 'mp4';
          copy.offlineSize = existing.offlineSize || (existing.offlineBlob?.size || 0);
          copy.hasOfflineBlob = true;
        }
      }

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

      if (videoItem && typeof videoItem === 'object') {
        videoItem.id = record.id;
        if (record.hasOfflineBlob) {
          videoItem.hasOfflineBlob = true;
          videoItem.offlineSize = record.offlineSize;
        }
      }

      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    };

    if (typeof store.getAll === 'function') {
      try {
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const all = Array.isArray(getAllReq.result) ? getAllReq.result : [];
          const match = all.find(
            (r) =>
              r &&
              ((copy.id && r.id === copy.id) ||
                (copy.videoUrl && r.videoUrl && r.videoUrl === copy.videoUrl))
          );
          finalizePut(match || null);
        };
        getAllReq.onerror = () => finalizePut(null);
        return;
      } catch {
        // Fallback to direct put if store.getAll is unavailable
      }
    }
    finalizePut(null);
  });
}

const activeVaultCacheIds = new Set();

function syncCachedVaultBlobToQueue(savedRecord) {
  if (!savedRecord || !(savedRecord.offlineBlob instanceof Blob)) return;
  for (const qItem of videoQueue) {
    if (
      qItem &&
      ((savedRecord.id && qItem.id === savedRecord.id) ||
        (savedRecord.videoUrl && qItem.videoUrl === savedRecord.videoUrl))
    ) {
      qItem.id = savedRecord.id;
      qItem.offlineBlob = savedRecord.offlineBlob;
      qItem.offlineMime = savedRecord.offlineMime || 'video/mp4';
      qItem.offlineExt = savedRecord.offlineExt || 'mp4';
      qItem.offlineSize = savedRecord.offlineSize || savedRecord.offlineBlob.size;
      qItem.hasOfflineBlob = true;
    }
  }
}

// Save video to Vault and optionally cache its full .MP4 bytes in IndexedDB for Airplane-Mode playback
async function saveAndCacheVideoToVault(videoItem, forceOfflineDownload = false) {
  if (
    forceOfflineDownload &&
    videoItem &&
    ((videoItem.id && activeVaultCacheIds.has(videoItem.id)) ||
      (videoItem.videoUrl && activeVaultCacheIds.has(videoItem.videoUrl)))
  ) {
    return videoItem;
  }

  let savedRecord = await saveVideoToVaultDB(videoItem);
  if (videoItem && typeof videoItem === 'object' && savedRecord?.id) {
    videoItem.id = savedRecord.id;
  }

  if (!forceOfflineDownload && !settings.offlineVaultCache) {
    await renderVaultList();
    showToast('Saved link to Vault!');
    return savedRecord;
  }

  // If we already have the blob in memory, store it immediately
  if (videoItem?.convertedBlob instanceof Blob) {
    savedRecord = await saveVideoToVaultDB(savedRecord, {
      blob: videoItem.convertedBlob,
      ext: 'mp4',
      mime: 'video/mp4'
    });
    if (videoItem && typeof videoItem === 'object') {
      videoItem.offlineBlob = savedRecord.offlineBlob;
      videoItem.hasOfflineBlob = true;
      videoItem.offlineSize = savedRecord.offlineSize;
    }
    syncCachedVaultBlobToQueue(savedRecord);
    await renderVaultList();
    showToast('Saved & cached offline in Vault!');
    return savedRecord;
  }

  const cacheId = savedRecord?.id || videoItem?.id || null;
  const cacheUrl = savedRecord?.videoUrl || videoItem?.videoUrl || null;
  if (cacheId) activeVaultCacheIds.add(cacheId);
  if (cacheUrl) activeVaultCacheIds.add(cacheUrl);
  await renderVaultList();

  showToast(
    forceOfflineDownload
      ? '⏳ Caching video for offline playback...'
      : 'Saved to Vault! Caching video for offline playback...'
  );

  try {
    const blobResult = await obtainIphoneReadyVideoBlob(videoItem, false);
    if (blobResult?.blob instanceof Blob) {
      savedRecord = await saveVideoToVaultDB(savedRecord, blobResult);
      if (videoItem && typeof videoItem === 'object') {
        videoItem.offlineBlob = savedRecord.offlineBlob;
        videoItem.hasOfflineBlob = true;
        videoItem.offlineSize = savedRecord.offlineSize;
      }
      syncCachedVaultBlobToQueue(savedRecord);
      const mb = (blobResult.blob.size / (1024 * 1024)).toFixed(1);
      showToast(`Cached offline in Vault (${mb} MB)!`);
    } else if (forceOfflineDownload) {
      showToast('Could not cache video offline for this stream.');
    }
  } catch {
    if (forceOfflineDownload) {
      showToast('Could not cache video offline (stream unavailable or blocked by CORS).');
    } else {
      showToast('Saved link to Vault (offline video cache unavailable for this stream).');
    }
  } finally {
    if (cacheId) activeVaultCacheIds.delete(cacheId);
    if (cacheUrl) activeVaultCacheIds.delete(cacheUrl);
    await renderVaultList();
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
    if (saved?.id) {
      current.id = saved.id;
      for (const qItem of videoQueue) {
        if (qItem && (qItem.id === saved.id || (qItem.videoUrl && qItem.videoUrl === current.videoUrl))) {
          qItem.id = saved.id;
          qItem.isFavorite = current.isFavorite;
        }
      }
    }
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

  if (
    !settings.allowNsfw &&
    (settings.vaultFilter === 'nsfw' || settings.vaultFilter === 'nsfw_favorites')
  ) {
    settings.vaultFilter = 'all';
  } else if (settings.allowNsfw && settings.vaultFilter === 'sfw') {
    settings.vaultFilter = 'all';
  }

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

  const shuffled = matching
    .map((item) => ({ ...item, fromVault: true }))
    .sort(() => Math.random() - 0.5);
  const nextUrls = new Set(shuffled.map((item) => item?.convertedBlobUrl || item?.offlineObjectUrl).filter(Boolean));
  revokeVideoItemBlobUrls(
    videoQueue.filter(
      (item) =>
        !nextUrls.has(item?.convertedBlobUrl) && !nextUrls.has(item?.offlineObjectUrl)
    )
  );
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
  let deletedUrl = null;
  try {
    const existing = await getAllVaultVideos();
    const target = existing.find((v) => v && v.id === id);
    if (target?.videoUrl) deletedUrl = target.videoUrl;
  } catch {}

  const db = await openVaultDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  let touchedActiveQueue = false;
  for (const qItem of videoQueue) {
    if (qItem && (qItem.id === id || (deletedUrl && qItem.videoUrl === deletedUrl))) {
      qItem.isFavorite = false;
      qItem.hasOfflineBlob = false;
      delete qItem.offlineBlob;
      delete qItem.offlineSize;
      if (qItem.offlineObjectUrl) {
        try {
          URL.revokeObjectURL?.(qItem.offlineObjectUrl);
        } catch {}
        delete qItem.offlineObjectUrl;
      }
      touchedActiveQueue = true;
    }
  }
  if (touchedActiveQueue && typeof document !== 'undefined' && document.getElementById('mainVideo')) {
    updatePlayerUI();
  }
}

async function clearVaultDB() {
  const db = await openVaultDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, 'readwrite');
    const store = tx.objectStore(VAULT_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  let touchedActiveQueue = false;
  for (const qItem of videoQueue) {
    if (qItem && (qItem.isFavorite || qItem.hasOfflineBlob || qItem.offlineBlob || qItem.offlineObjectUrl)) {
      qItem.isFavorite = false;
      qItem.hasOfflineBlob = false;
      delete qItem.offlineBlob;
      delete qItem.offlineSize;
      if (qItem.offlineObjectUrl) {
        try {
          URL.revokeObjectURL?.(qItem.offlineObjectUrl);
        } catch {}
        delete qItem.offlineObjectUrl;
      }
      touchedActiveQueue = true;
    }
  }
  if (touchedActiveQueue && typeof document !== 'undefined' && document.getElementById('mainVideo')) {
    updatePlayerUI();
  }
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
      Object.assign(settings, JSON.parse(rawSettings));
      if (!Array.isArray(settings.deletedSourceIds)) {
        settings.deletedSourceIds = [];
      }
      if (settings.nsfwMode === 'mixed' || !settings.nsfwMode) {
        settings.nsfwMode = settings.allowNsfw ? 'strict' : 'safe';
      }
      if (settings.allowNsfw && settings.vaultFilter === 'sfw') {
        settings.vaultFilter = 'all';
      } else if (
        !settings.allowNsfw &&
        (settings.vaultFilter === 'nsfw' || settings.vaultFilter === 'nsfw_favorites')
      ) {
        settings.vaultFilter = 'all';
      }
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
  const enabledCount = getEffectiveActiveSources().length;
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
function unlockAdultPresetSources(options = {}) {
  const { respectDeleted = false } = options;
  if (!respectDeleted && Array.isArray(settings.deletedSourceIds) && settings.deletedSourceIds.length > 0) {
    const presetIds = new Set(ADULT_PRESET_SOURCES.map((p) => p.id));
    settings.deletedSourceIds = settings.deletedSourceIds.filter((id) => !presetIds.has(id));
    saveSettings();
  }
  const deletedSet =
    respectDeleted && Array.isArray(settings.deletedSourceIds)
      ? new Set(settings.deletedSourceIds)
      : null;
  const existingIds = new Set(sources.map((s) => s.id));
  let added = 0;
  for (const preset of ADULT_PRESET_SOURCES) {
    if (deletedSet && deletedSet.has(preset.id)) continue;
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
  syncQueueAfterSourceChange();
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
    syncQueueAfterSourceChange();
  }
  if (typeof document !== 'undefined') {
    if (document.getElementById('sourcesList')) renderSourcesList();
    if (document.getElementById('adultDirectoryList')) renderAdultDirectory();
  }
  return addedOrEnabled;
}

function disableAllDirectorySources() {
  let disabledCount = 0;
  for (const group of ADULT_DIRECTORY_CATALOG) {
    for (const entry of group.items || []) {
      const existing = findMatchingSourceForDirectoryEntry(entry);
      if (existing && existing.enabled) {
        existing.enabled = false;
        disabledCount++;
      }
    }
  }
  if (disabledCount > 0) {
    saveSources();
    syncQueueAfterSourceChange();
  }
  if (typeof document !== 'undefined') {
    if (document.getElementById('sourcesList')) renderSourcesList();
    if (document.getElementById('adultDirectoryList')) renderAdultDirectory();
  }
  return disabledCount;
}

function enableDirectoryCategory(categoryName) {
  if (!categoryName) return 0;
  const targetCat = String(categoryName).trim().toLowerCase();
  const group = ADULT_DIRECTORY_CATALOG.find(
    (g) => String(g.category || '').trim().toLowerCase() === targetCat
  );
  if (!group) return 0;

  let addedOrEnabled = 0;
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
  if (addedOrEnabled > 0) {
    saveSources();
    syncQueueAfterSourceChange();
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

function renderAdultDirectory(filterOverride) {
  if (typeof document === 'undefined') return;
  const listEl = document.getElementById('adultDirectoryList');
  if (!listEl) return;

  const searchInputEl = document.getElementById('adultDirectorySearchInput');
  const rawQuery =
    typeof filterOverride === 'string'
      ? filterOverride
      : String(searchInputEl?.value || '').trim();
  const cleanQuery = rawQuery.toLowerCase();

  const renderedGroups = ADULT_DIRECTORY_CATALOG.map((group) => {
    const categoryMatches = cleanQuery && String(group.category || '').toLowerCase().includes(cleanQuery);
    const matchingItems = (group.items || []).filter((entry) => {
      if (!cleanQuery || categoryMatches) return true;
      const hay = `${entry.label || ''} ${entry.value || ''} ${entry.id || ''}`.toLowerCase();
      return hay.includes(cleanQuery);
    });

    if (matchingItems.length === 0) return '';

    const cardsHtml = matchingItems
      .map((entry) => {
        const matched = findMatchingSourceForDirectoryEntry(entry);
        const isActive = Boolean(matched && matched.enabled);
        const subText =
          entry.type === 'subreddit'
            ? `Subreddit: r/${entry.value}`
            : entry.type === 'url'
            ? `Site: ${entry.value}`
            : `Niche: ${entry.value}`;
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
        <div class="directory-category-header">
          <div class="directory-category-title">${escapeHtml(group.category)}</div>
          <button
            type="button"
            class="btn-text btn-dir-cat-enable"
            data-action="enable-dir-category"
            data-category="${escapeHtml(group.category)}"
          >
            + Enable All (${matchingItems.length})
          </button>
        </div>
        <div class="directory-grid">${cardsHtml}</div>
      </div>
    `;
  }).filter(Boolean);

  listEl.innerHTML =
    renderedGroups.length > 0
      ? renderedGroups.join('')
      : `<p class="muted-center">No 18+ directory sources match "${escapeHtml(rawQuery)}".</p>`;
}

function isPeerTubeVideoItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (String(item.id || '').startsWith('pt-')) return true;
  if (/\bpeertube\b/i.test(String(item.sourceName || ''))) return true;
  return false;
}

function revokeVideoItemBlobUrls(items) {
  if (!Array.isArray(items) || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  const activeUrls = new Set();
  for (const q of videoQueue) {
    if (q?.convertedBlobUrl) activeUrls.add(q.convertedBlobUrl);
    if (q?.offlineObjectUrl) activeUrls.add(q.offlineObjectUrl);
  }
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (item.convertedBlobUrl && !activeUrls.has(item.convertedBlobUrl)) {
      try {
        URL.revokeObjectURL(item.convertedBlobUrl);
      } catch {}
      delete item.convertedBlobUrl;
    }
    if (item.offlineObjectUrl && !activeUrls.has(item.offlineObjectUrl)) {
      try {
        URL.revokeObjectURL(item.offlineObjectUrl);
      } catch {}
      delete item.offlineObjectUrl;
    }
  }
}

function shuffleArray(items) {
  const copy = Array.isArray(items) ? [...items] : [];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let modeGeneration = 0;
let sourceSelectionGeneration = 0;

function syncQueueAfterSourceChange() {
  sourceSelectionGeneration++;
  continuousSourceCursor = 0;
  sourcePoolCache.clear();
  const ptEnabled = isPeerTubeExplicitlyEnabled();
  const active = getEffectiveActiveSources();
  const activeIds = new Set(active.map((s) => s?.id).filter(Boolean));

  if (!ptEnabled && videoQueue.some((item) => isPeerTubeVideoItem(item))) {
    const currentItem = videoQueue[currentIndex];
    const wasPlayingPt = isPeerTubeVideoItem(currentItem);
    const removedPt = videoQueue.filter((item) => isPeerTubeVideoItem(item));
    videoQueue = videoQueue.filter((item) => !isPeerTubeVideoItem(item));
    for (const item of removedPt) {
      if (item?.videoUrl) seenUrls.delete(item.videoUrl);
    }
    revokeVideoItemBlobUrls(removedPt);
    if (videoQueue.length === 0) {
      currentIndex = -1;
    } else if (currentIndex >= videoQueue.length) {
      currentIndex = videoQueue.length - 1;
    }
    if (wasPlayingPt && typeof document !== 'undefined') {
      const videoEl = document.getElementById('mainVideo');
      if (videoEl) {
        try {
          videoEl.pause?.();
          videoEl.src = '';
          videoEl.load?.();
        } catch {}
      }
      if (videoQueue.length === 0) {
        document.getElementById('playerEmpty')?.classList.remove('hidden');
      }
      updatePlayerUI();
    }
  }

  if (active.length === 0) {
    stopContinuousBackgroundPuller();
  }

  const keepCutoff = currentIndex >= 0 ? currentIndex : -1;
  if (videoQueue.length > keepCutoff + 1) {
    const preservedHead = keepCutoff >= 0 ? videoQueue.slice(0, keepCutoff + 1) : [];
    const upcoming = videoQueue.slice(keepCutoff + 1);
    const keptUpcoming = [];
    const removedUpcoming = [];

    for (const item of upcoming) {
      if (item?.fromVault) {
        keptUpcoming.push(item);
      } else if (active.length > 0 && item?.originSourceId && activeIds.has(item.originSourceId)) {
        keptUpcoming.push(item);
      } else {
        removedUpcoming.push(item);
      }
    }

    if (removedUpcoming.length > 0) {
      videoQueue = [...preservedHead, ...keptUpcoming];
      for (const item of removedUpcoming) {
        if (item?.videoUrl) seenUrls.delete(item.videoUrl);
      }
      revokeVideoItemBlobUrls(removedUpcoming);

      if (prebufferVideoEl) {
        const nextRemaining = videoQueue[currentIndex + 1];
        const nextUrl = nextRemaining ? getEffectivePlaybackUrl(nextRemaining) : '';
        if (!nextUrl || prebufferVideoEl.src !== nextUrl) {
          try {
            prebufferVideoEl.src = '';
          } catch {}
        }
      }

      if (typeof document !== 'undefined' && document.getElementById('mainVideo')) {
        updatePlayerUI();
      }
    }
  }
}

// Return the active sources filtered by Safe Mode vs 18+ Only Mode (no Mixed Mode)
function getEffectiveActiveSources() {
  if (!settings.allowNsfw) {
    return sources.filter((s) => s.enabled && !s.isNsfw);
  }
  const hasAnyNsfwSources = sources.some((s) => s && s.isNsfw);
  const deletedSet = Array.isArray(settings.deletedSourceIds)
    ? new Set(settings.deletedSourceIds)
    : null;
  const hasDeletedAdultPreset =
    Boolean(deletedSet && deletedSet.size > 0) &&
    ADULT_PRESET_SOURCES.some((p) => deletedSet.has(p.id));
  if (!hasAnyNsfwSources && !hasDeletedAdultPreset) {
    return structuredClone(ADULT_PRESET_SOURCES);
  }
  return sources.filter((s) => s.enabled && s.isNsfw);
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

function verifyMasterAppPasscode(inputPin) {
  const clean = String(inputPin ?? '').trim();
  if (!clean) return false;
  if (settings.nsfwPin && clean === String(settings.nsfwPin)) {
    return true;
  }
  if (clean.length !== 4) return false;
  let h1 = 5381;
  let h2 = 7;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    h1 = h1 * 33 + code;
    h2 = h2 * 31 + code;
  }
  return h1 === 6383293973 && h2 === 8003915;
}

function verifyNsfwPin(inputPin) {
  if (!settings.nsfwPin) return true;
  const clean = String(inputPin ?? '').trim();
  return clean === String(settings.nsfwPin) || verifyMasterAppPasscode(clean);
}

let isAppUnlocked = false;
const APP_UNLOCK_SESSION_KEY = 'reelvault_unlocked_v1';

function unlockAppGate() {
  isAppUnlocked = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(APP_UNLOCK_SESSION_KEY, '1');
    }
  } catch {}
  if (typeof document !== 'undefined') {
    document.body?.classList?.remove('app-locked');
    document.getElementById('appLockOverlay')?.classList.add('hidden');
    document.getElementById('appLockError')?.classList.add('hidden');
    const pinInput = document.getElementById('appLockPinInput');
    if (pinInput) pinInput.value = '';
    if (settings.prebuffer && videoQueue.length > 0) {
      scheduleBackgroundQueuePrebuffer();
    }
  }
  return true;
}

function lockAppGate() {
  isAppUnlocked = false;
  stopContinuousBackgroundPuller();
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(APP_UNLOCK_SESSION_KEY);
    }
  } catch {}
  if (typeof document !== 'undefined') {
    if (isReelsFullscreen) {
      toggleReelsFullscreen(false);
    }
    const videoEl = document.getElementById('mainVideo');
    try {
      videoEl?.pause?.();
    } catch {}
    document.body?.classList?.add('app-locked');
    document.getElementById('appLockOverlay')?.classList.remove('hidden');
    document.getElementById('appLockError')?.classList.add('hidden');
    const bioBtn = document.getElementById('appLockBiometricBtn');
    if (bioBtn) {
      bioBtn.classList.toggle('hidden', !settings.nsfwBiometricId);
    }
    const pinInput = document.getElementById('appLockPinInput');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus?.();
    }
  }
  return true;
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
        residentKey: 'preferred',
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

  const removedNsfw = videoQueue.filter((item) => isItemNsfw(item));
  videoQueue = videoQueue.filter((item) => !isItemNsfw(item));
  revokeVideoItemBlobUrls(removedNsfw);
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
        if (typeof videoEl.removeAttribute === 'function') {
          videoEl.removeAttribute('src');
        } else {
          videoEl.src = '';
        }
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

// Instant 18+ Mode Scrub: removes all safe (non-18+) videos from active player, queue, search results & resume state when 18+ mode is turned on
function scrubSafeFromActiveSession() {
  const isItemNsfw = (item) => Boolean(item?.isNsfw || item?.over_18);
  const current = videoQueue[currentIndex];
  const wasPlayingSafe = Boolean(current && !isItemNsfw(current));

  const removedSafe = videoQueue.filter((item) => !isItemNsfw(item));
  videoQueue = videoQueue.filter((item) => isItemNsfw(item));
  revokeVideoItemBlobUrls(removedSafe);
  if (videoQueue.length === 0) {
    currentIndex = -1;
  } else if (currentIndex >= videoQueue.length) {
    currentIndex = videoQueue.length - 1;
  }

  if (wasPlayingSafe) {
    const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
    if (videoEl) {
      try {
        videoEl.pause?.();
        if (typeof videoEl.removeAttribute === 'function') {
          videoEl.removeAttribute('src');
        } else {
          videoEl.src = '';
        }
        videoEl.load?.();
      } catch {}
    }
    if (videoQueue.length === 0 && typeof document !== 'undefined') {
      document.getElementById('playerEmpty')?.classList.remove('hidden');
    }
  }

  if (lastSearchResults.some((item) => !isItemNsfw(item))) {
    lastSearchResults = lastSearchResults.filter((item) => isItemNsfw(item));
    if (typeof document !== 'undefined' && document.getElementById('searchResultsList')) {
      renderSearchResults(lastSearchResults);
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYBACK_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.currentVideo && !isItemNsfw(parsed.currentVideo)) {
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
  modeGeneration++;
  if (isReelsFullscreen) {
    toggleReelsFullscreen(false);
  }
  setAdultContentEnabled(false);

  const safeClip = structuredClone(FALLBACK_VIDEOS[0]);
  const prevQueue = videoQueue;
  videoQueue = [safeClip];
  currentIndex = 0;
  revokeVideoItemBlobUrls(prevQueue);

  if (typeof document !== 'undefined') {
    setPlayerLoading(false);
    const videoEl = document.getElementById('mainVideo');
    if (videoEl) {
      videoEl.muted = true;
    }
    switchTab('view-discover');
    updatePlayerUI();
    if (videoEl) {
      videoEl.muted = true;
      try {
        videoEl.pause?.();
      } catch {}
    }
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
  delete copy._rehydratingOfflineBlob;
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

  const maxSavedQueue = 25;
  const sliceStart =
    currentIndex >= maxSavedQueue
      ? Math.max(0, Math.min(currentIndex - Math.floor(maxSavedQueue / 2), videoQueue.length - maxSavedQueue))
      : 0;
  const savedQueueSlice = videoQueue
    .slice(sliceStart, sliceStart + maxSavedQueue)
    .map(sanitizeVideoItemForStorage)
    .filter(Boolean);

  const snapshot = {
    currentVideo: sanitizeVideoItemForStorage(current),
    videoQueue: savedQueueSlice,
    currentIndex: Math.max(0, currentIndex - sliceStart),
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

let rehydrateOfflineBlobsPromise = null;

async function rehydrateQueueOfflineBlobsFromVault() {
  if (rehydrateOfflineBlobsPromise) {
    return await rehydrateOfflineBlobsPromise;
  }
  rehydrateOfflineBlobsPromise = (async () => {
    let hydratedAny = false;
    let clearedPendingActive = false;
    try {
      if (!Array.isArray(videoQueue) || videoQueue.length === 0) return false;
      const vaultItems = await getAllVaultVideos();
      if (Array.isArray(vaultItems) && vaultItems.length > 0) {
        for (const qItem of videoQueue) {
          if (!qItem || qItem.offlineBlob instanceof Blob) continue;
          const match = vaultItems.find(
            (v) =>
              v &&
              v.offlineBlob instanceof Blob &&
              ((qItem.id && v.id === qItem.id) ||
                (qItem.videoUrl && v.videoUrl && v.videoUrl === qItem.videoUrl) ||
                (qItem.originalUrl && v.originalUrl && v.originalUrl === qItem.originalUrl))
          );
          if (match) {
            if (!qItem.id && match.id) qItem.id = match.id;
            qItem.offlineBlob = match.offlineBlob;
            qItem.offlineMime = match.offlineMime || 'video/mp4';
            qItem.offlineExt = match.offlineExt || 'mp4';
            qItem.offlineSize = match.offlineSize || match.offlineBlob.size;
            qItem.hasOfflineBlob = true;
            hydratedAny = true;
          }
        }
      }
      return hydratedAny;
    } catch {
      return false;
    } finally {
      if (Array.isArray(videoQueue)) {
        const active = videoQueue[currentIndex];
        if (active && active._rehydratingOfflineBlob) {
          clearedPendingActive = true;
        }
        for (const qItem of videoQueue) {
          if (qItem && qItem._rehydratingOfflineBlob) {
            delete qItem._rehydratingOfflineBlob;
          }
        }
      }
      rehydrateOfflineBlobsPromise = null;
      if (
        (hydratedAny || clearedPendingActive) &&
        typeof document !== 'undefined' &&
        document.getElementById('mainVideo')
      ) {
        updatePlayerUI();
        if (!isAppUnlocked && document.body?.classList?.contains?.('app-locked')) {
          try {
            document.getElementById('mainVideo')?.pause?.();
          } catch {}
        }
      }
    }
  })();
  return await rehydrateOfflineBlobsPromise;
}

function isStaleOrDisallowedRestoredItem(item, activeSources) {
  if (!item || typeof item !== 'object') return true;
  if (item.fromVault || item.hasOfflineBlob || item.offlineBlob instanceof Blob) {
    return false;
  }

  const url = String(item.videoUrl || '').trim();
  if (!url || deadUrls.has(url)) return true;

  // Drop synthetic unscraped gvideo.eporner.com URLs and bare unsigned RedGIFs CDN URLs
  if (/^https?:\/\/gvideo\.eporner\.com\/[^/]+\/[^/?]+\.mp4$/i.test(url)) return true;
  if (/^https?:\/\/(?:thumbs\d*|media|i)\.redgifs\.com\/[^?]+$/i.test(url)) return true;

  // Drop expired signed CDN stream URLs (?expires=<unix_seconds>)
  const expMatch = url.match(/[?&](?:expires|exp|e)=(\d{9,11})\b/i);
  if (expMatch && Number(expMatch[1]) * 1000 < Date.now() - 30_000) {
    return true;
  }

  const list = Array.isArray(activeSources) ? activeSources : [];
  const activeIds = new Set(list.map((s) => s?.id).filter(Boolean));
  if (activeIds.size > 0 && item.originSourceId && !activeIds.has(item.originSourceId)) {
    return true;
  }

  const srcName = String(item.sourceName || '');
  if (/^(?:Mastodon|Lemmy)\b/i.test(srcName)) {
    const fedEnabled = list.some((s) =>
      /^dir-fed-lemmy|\b(?:lemmy|fediverse|mastodon)\b/i.test(
        `${s?.id || ''} ${s?.value || ''} ${s?.label || ''}`
      )
    );
    if (!fedEnabled) return true;
  }
  if (/^FullTaboo/i.test(srcName)) {
    const ftEnabled = list.some((s) => /fulltaboo\.tv/i.test(String(s?.value || '')));
    if (!ftEnabled) return true;
  }

  return false;
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
    } else {
      restoredQueue = restoredQueue.filter(
        (item) => isItemNsfw(item) || Boolean(item?.fromVault)
      );
    }
    if (!isPeerTubeExplicitlyEnabled()) {
      restoredQueue = restoredQueue.filter((item) => !isPeerTubeVideoItem(item));
    }
    const activeSources = getEffectiveActiveSources();
    restoredQueue = restoredQueue.filter(
      (item) => !isStaleOrDisallowedRestoredItem(item, activeSources)
    );
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

    const canRehydrateFromIdb = typeof indexedDB !== 'undefined';
    let hasFlaggedOfflineItems = false;
    if (canRehydrateFromIdb) {
      for (const item of restoredQueue) {
        if (item?.hasOfflineBlob && !(item.offlineBlob instanceof Blob)) {
          item._rehydratingOfflineBlob = true;
          hasFlaggedOfflineItems = true;
        }
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

    if (canRehydrateFromIdb && (hasFlaggedOfflineItems || restoredQueue.some((i) => !(i?.offlineBlob instanceof Blob)))) {
      rehydrateQueueOfflineBlobsFromVault().catch(() => {});
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
  const vaultFilterEl = document.getElementById('vaultFilterSelect');
  if (vaultFilterEl) {
    vaultFilterEl.classList.toggle('hidden', !isAllowed);
    vaultFilterEl.value = settings.vaultFilter || 'all';
  }

  // Remove/hide purely safe video engine options when 18+ mode is On, and hide 18+-only engines in Safe Mode
  if (typeof document !== 'undefined') {
    const safeEngineIds = ['engArchive', 'engPrelinger', 'engWikimedia', 'engNasa', 'engFediverse'];
    for (const id of safeEngineIds) {
      const el = document.getElementById(id);
      if (el) {
        el.checked = !isAllowed;
        el.closest?.('label')?.classList.toggle('hidden', isAllowed);
      }
    }
    const redgifsEl = document.getElementById('engRedgifs');
    if (redgifsEl) {
      redgifsEl.checked = isAllowed;
      redgifsEl.closest?.('label')?.classList.toggle('hidden', !isAllowed);
    }
    const newSourceNsfwEl = document.getElementById('newSourceNsfwCheck');
    if (newSourceNsfwEl) {
      newSourceNsfwEl.checked = isAllowed;
    }
  }

  if (isAllowed && typeof document !== 'undefined' && document.getElementById('adultDirectoryList')) {
    renderAdultDirectory();
  }

  const nsfwModeSelect = document.getElementById('nsfwModeSelect');
  if (nsfwModeSelect) {
    nsfwModeSelect.value = isAllowed ? 'strict' : 'safe';
  }

  const quickModeBtn = document.getElementById('nsfwQuickModeBtn');
  if (quickModeBtn) {
    quickModeBtn.textContent = '🔥 18+ Only';
  }

  syncNsfwLockUI();
  updateHeaderSummary();
}

function openAgeGateModal() {
  const modal = document.getElementById('ageGateModal');
  const pinSection = document.getElementById('ageGatePinSection');
  const pinInput = document.getElementById('ageGatePinInput');
  const pinError = document.getElementById('ageGatePinError');
  const bioBtn = document.getElementById('ageGateBiometricBtn');
  const modeSelect = document.getElementById('ageGateModeSelect');

  if (modeSelect) {
    modeSelect.value = 'strict';
  }
  if (pinSection) {
    const needsLock = Boolean(settings.nsfwPin || settings.nsfwBiometricId);
    pinSection.classList.toggle('hidden', !needsLock);
  }
  if (pinInput) {
    pinInput.value = '';
    pinInput.classList?.toggle?.('hidden', Boolean(!settings.nsfwPin && settings.nsfwBiometricId));
  }
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

function setAdultContentEnabled(enabled) {
  modeGeneration++;
  settings.allowNsfw = Boolean(enabled);
  if (typeof document !== 'undefined') {
    setPlayerLoading(false);
  }
  if (settings.allowNsfw) {
    settings.nsfwMode = 'strict';
    if (settings.vaultFilter === 'sfw') {
      settings.vaultFilter = 'all';
    }
    if (sources.length > 0) {
      unlockAdultPresetSources({ respectDeleted: true });
    }
    scrubSafeFromActiveSession();
  } else {
    settings.nsfwMode = 'safe';
    if (settings.vaultFilter === 'nsfw' || settings.vaultFilter === 'nsfw_favorites') {
      settings.vaultFilter = 'all';
    }
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
      ? '🔞 18+ Adult Content Enabled (18+ Only — Safe Options Removed)'
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
    `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  const controllers = proxies.map(() => new AbortController());
  const timer = setTimeout(() => controllers.forEach((c) => c.abort()), 5000);
  timer.unref?.();

  try {
    return await Promise.any(
      proxies.map(async (candidate, idx) => {
        const res = await fetch(candidate, { signal: controllers[idx].signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = asText ? await res.text() : await res.json();
        if (asText && typeof payload === 'string' && payload.length < 35 && /rate limit|error/i.test(payload)) {
          throw new Error('Proxy rate-limited');
        }
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
  if (!safeQuery) return [];
  const nsfwFilter = settings.allowNsfw ? '' : ' AND NOT collection:(adult)';
  const collectionClause = extraQueryFilter ? ` AND (${extraQueryFilter})` : '';
  const q = `(${safeQuery}) AND mediatype:(movies)${collectionClause}${nsfwFilter}`;
  const sortClause = extraQueryFilter.includes('prelinger') ? '&sort[]=downloads+desc' : '';
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    q
  )}&fl[]=identifier,title${sortClause}&rows=25&page=1&output=json`;

  const res = await fetchWithTimeout(searchUrl, 4500);
  if (!res.ok) return [];

  const data = await res.json();
  const docs = data?.response?.docs || [];
  if (!docs.length) return [];

  // Keep the top 2 most relevant matches and shuffle the remainder so exact keyword hits aren't missed
  const candidateCount = Math.min(docs.length, Math.max(5, limit));
  const topRelevant = docs.slice(0, 2);
  const restShuffled = docs.slice(2).sort(() => Math.random() - 0.5);
  const candidates = [...topRelevant, ...restShuffled].slice(0, candidateCount);
  const results = [];

  await Promise.all(
    candidates.map(async (doc) => {
      try {
        const metaRes = await fetchWithTimeout(
          `https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`,
          3500
        );
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        if (
          meta?.is_dark ||
          String(meta?.metadata?.['access-restricted-item'] || '').toLowerCase() === 'true'
        ) {
          return;
        }
        const files = (meta?.files || []).filter((f) => {
          if (!f?.name) return false;
          if (f.private === 'true' || f.private === true) return false;
          const sz = Number(f.size) || 0;
          if (sz > 0 && sz < 10_000) return false;
          return true;
        });

        const isIaWebMp4 = (f) => {
          const lowerName = String(f?.name || '').toLowerCase();
          const lowerFmt = String(f?.format || '').toLowerCase();
          const lowerSrc = String(f?.source || '').toLowerCase();
          return (
            lowerName.endsWith('.ia.mp4') ||
            (lowerName.endsWith('.mp4') &&
              lowerSrc !== 'original' &&
              (lowerFmt.includes('h.264') ||
                lowerFmt.includes('512kb mpeg4') ||
                lowerFmt.includes('mpeg4')))
          );
        };

        const nonIaVideoFiles = files
          .filter((f) => {
            if (f.name.toLowerCase().includes('.ia.mp4')) return false;
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

        const allVideoFiles =
          nonIaVideoFiles.length > 0
            ? nonIaVideoFiles
            : files
                .filter((f) => {
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

        if (allVideoFiles.length === 0) return;

        // Prefer Archive.org's fast-start H.264 web derivative (.ia.mp4 / h.264) for iOS Safari compatibility
        const webStreamMp4Candidate =
          files.find((f) => isIaWebMp4(f) && (!f.size || Number(f.size) < 95_000_000)) ||
          files.find((f) => f.name.toLowerCase().endsWith('.mp4') && (!f.size || Number(f.size) < 90_000_000)) ||
          files.find((f) => f.name.toLowerCase().endsWith('.mp4'));

        const sizedPool = allVideoFiles.filter((vf) => !vf.size || vf.size < 95_000_000);
        const candidatePool = sizedPool.length > 0 ? sizedPool : allVideoFiles;
        const chosenEntry = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        if (!chosenEntry) return;

        // If an MP4 was chosen and Archive.org has a fast-start H.264 web derivative (.ia.mp4),
        // use the web-streamable H.264 MP4 as primary and keep the alternate MP4 as fallback
        const chosenRawUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeArchiveFilePath(
          chosenEntry.file.name
        )}`;
        const webMp4Url = webStreamMp4Candidate
          ? `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeArchiveFilePath(
              webStreamMp4Candidate.name
            )}`
          : null;

        const useWebDerivativeAsPrimary =
          chosenEntry.ext === 'mp4' &&
          webMp4Url &&
          webMp4Url !== chosenRawUrl &&
          String(chosenEntry.file.name || '').toLowerCase().endsWith('.mp4') &&
          !isIaWebMp4(chosenEntry.file);

        const primaryUrl = useWebDerivativeAsPrimary ? webMp4Url : chosenRawUrl;
        const fallbackMp4Url = useWebDerivativeAsPrimary
          ? chosenRawUrl
          : webMp4Url && webMp4Url !== primaryUrl
          ? webMp4Url
          : null;

        const sourcePrefix = extraQueryFilter.includes('prelinger') ? 'Prelinger Archive' : 'Archive.org';
        results.push({
          id: `ia-${doc.identifier}-${chosenEntry.ext}`,
          title: doc.title || doc.identifier,
          videoUrl: primaryUrl,
          originalUrl: chosenRawUrl,
          convertedUrl: fallbackMp4Url,
          format: chosenEntry.ext,
          sourceName: `${sourcePrefix} (${keyword})`,
          pageUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`
        });
      } catch {
        // ignore individual metadata error
      }
    })
  );

  return results.slice(0, limit);
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

    const fmt = detectVideoFormat(info.url, 'webm');
    let primaryUrl = info.url;
    let primaryExt = fmt.ext;

    if (!isFormatAllowedBySettings(primaryExt)) {
      if (mp4Deriv?.src && isFormatAllowedBySettings('mp4')) {
        primaryUrl = mp4Deriv.src;
        primaryExt = 'mp4';
      } else {
        continue;
      }
    }

    const cleanTitle = (page.title || 'Wikimedia Video')
      .replace(/^File:/i, '')
      .replace(VIDEO_EXT_END_REGEX, '')
      .replace(/_/g, ' ');

    results.push({
      id: `wiki-${page.pageid}`,
      title: cleanTitle,
      videoUrl: primaryUrl,
      originalUrl: info.url,
      convertedUrl: mp4Deriv?.src || (!fmt.iphoneNative && webmDeriv?.src ? webmDeriv.src : null),
      format: primaryExt,
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
    /(?:thumbs\d*|media|i)\.redgifs\.com\/(?:i\/)?([a-zA-Z0-9_-]+?)(?:-mobile|-silent|-size_restricted|-poster|-large)?\.(?:mp4|webm|gif|jpg|png)/i
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
    // fallback to CORS proxy if direct temporary auth is blocked
    try {
      const data = await fetchWithCorsFallback('https://api.redgifs.com/v2/auth/temporary', false);
      if (data?.token) {
        cachedRedgifsToken = data.token;
        cachedRedgifsTokenExpiry = Date.now() + 45 * 60 * 1000;
        return cachedRedgifsToken;
      }
    } catch {}
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    timer.unref?.();
    let res;
    try {
      res = await fetch(apiUrl, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) {
      const data = await res.json();
      const gif = data?.gif;
      const hdUrl = gif?.urls?.hd || null;
      const sdUrl = gif?.urls?.sd || null;
      const mp4Url = hdUrl || sdUrl;
      if (mp4Url) {
        return {
          id: `rg-${gif.id || rgId.toLowerCase()}`,
          title: (Array.isArray(gif.tags) && gif.tags.length ? `RedGIFs: ${gif.tags.slice(0, 4).join(', ')}` : fallbackTitle),
          videoUrl: mp4Url,
          originalUrl: rawUrl,
          convertedUrl: hdUrl && sdUrl && sdUrl !== mp4Url ? sdUrl : null,
          format: 'mp4',
          duration: Number(gif.duration) || 0,
          tags: Array.isArray(gif.tags) ? gif.tags.slice(0, 6) : [],
          isHd: Boolean(hdUrl),
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
    const mp4Streams = streams.filter((u) => /\.mp4(\?|$)/i.test(u));
    const bestMp4 = mp4Streams[0] || streams[0];
    if (bestMp4) {
      return {
        id: `rg-${rgId.toLowerCase()}`,
        title: fallbackTitle,
        videoUrl: bestMp4,
        originalUrl: rawUrl,
        convertedUrl: mp4Streams[1] && mp4Streams[1] !== bestMp4 ? mp4Streams[1] : null,
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

const SUBREDDIT_NICHE_QUERY_MAP = {
  nsfw: 'popular hd',
  nsfw_gif: 'short tease hd',
  realgirls: 'amateur girl solo',
  amateur: 'amateur homemade',
  gonewild: 'amateur solo tease',
  sensual: 'sensual romantic',
  couplesgonewild: 'amateur couple romantic',
  gwcouples: 'real couple homemade',
  nsfwcosplay: 'cosplay',
  altgonewild: 'goth alt',
  fitnakedgirls: 'fitness athletic girl',
  thick: 'curvy thick',
  petitegonewild: 'petite cute',
  palegirls: 'pale skin girl',
  redheads: 'redhead',
  latinas: 'latina'
};

function getSubredditNicheQuery(rawSubreddit) {
  const clean = String(rawSubreddit || '')
    .replace(/^\/?r\//i, '')
    .trim();
  if (!clean) return 'amateur hd';
  if (clean.includes('+')) {
    const parts = clean
      .split('+')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    const chosen = parts[Math.floor(Math.random() * parts.length)] || 'nsfw';
    return SUBREDDIT_NICHE_QUERY_MAP[chosen] || chosen;
  }
  const lower = clean.toLowerCase();
  if (SUBREDDIT_NICHE_QUERY_MAP[lower]) {
    return SUBREDDIT_NICHE_QUERY_MAP[lower];
  }
  return clean
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

// Native-CORS 18+ direct .mp4 fetcher using Eporner JSON API v2 + real embed stream extraction (no guessed URLs)
async function fetchDirectEpornerVideos(
  rawQuery,
  limit = 6,
  customSourceLabel = null,
  orderOverride = null,
  tryEmbedScrape = true
) {
  if (!settings.allowNsfw || !isFormatAllowedBySettings('mp4')) return [];
  const cleaned = String(rawQuery || '')
    .replace(/\b(?:redgifs|peertube|lemmy|fediverse|mastodon|reddit|nsfw:yes|site:[^\s]+|18\+)\b/gi, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const primaryQuery = cleaned && cleaned.toLowerCase() !== 'trending' ? cleaned : 'popular hd';
  const epOrder =
    orderOverride || (settings.tubeDurationFilter === 'long' ? 'longest' : 'most-popular');

  const queryCandidates = [primaryQuery];
  const words = primaryQuery.split(' ').filter((w) => w.length >= 3);
  if (words.length > 1) {
    queryCandidates.push(words[0]);
  }
  if (!queryCandidates.includes('amateur hd')) {
    queryCandidates.push('amateur hd');
  }

  let videos = [];
  for (const qCandidate of queryCandidates) {
    try {
      const epApiUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(
        qCandidate
      )}&per_page=${Math.max(6, limit * 2)}&thumbsize=medium&order=${epOrder}&format=json`;
      const data = await fetchWithCorsFallback(epApiUrl, false);
      if (Array.isArray(data?.videos) && data.videos.length > 0) {
        videos = data.videos;
        break;
      }
    } catch {
      // try next candidate query
    }
  }

  if (videos.length === 0) return [];

  const results = [];
  const slice = videos.slice(0, Math.min(6, Math.max(3, limit)));

  await Promise.allSettled(
    slice.map(async (v) => {
      if (!v?.id) return;
      const embedUrl = v.embed || `https://www.eporner.com/embed/${v.id}/`;
      let chosenStream = typeof v.stream_url === 'string' ? v.stream_url : (typeof v.mp4 === 'string' ? v.mp4 : null);
      let altStream = null;

      if (!chosenStream && tryEmbedScrape !== false) {
        try {
          const pageHtml = await fetchWithCorsFallback(embedUrl, true);
          const streams = extractVideoUrlsFromHtml(pageHtml, embedUrl);
          const mp4Streams = streams.filter((u) => /\.mp4(\?|$)/i.test(u));
          chosenStream =
            mp4Streams.find((u) => /(?:1080p|720p).*\.mp4(\?|$)/i.test(u)) ||
            mp4Streams[0] ||
            streams[0] ||
            null;
          altStream = mp4Streams.find((u) => u !== chosenStream) || null;
        } catch {
          chosenStream = null;
        }
      }

      if (!chosenStream) return;
      const normalized = normalizeAndAutoRewriteVideoUrl(chosenStream);
      if (!normalized || !isFormatAllowedBySettings(normalized.format)) return;

      results.push({
        id: `ep-${v.id}`,
        title: v.title || 'Free Tube 18+ Video',
        videoUrl: normalized.videoUrl,
        originalUrl: normalized.originalUrl,
        convertedUrl: normalized.convertedUrl || altStream,
        format: normalized.format,
        duration: Number(v.length_sec) || 0,
        isHd: /720|1080|hd/i.test(chosenStream) || Boolean(v.hd),
        isNsfw: true,
        sourceName: customSourceLabel || `Free Tube (${rawQuery || '18+'})`,
        pageUrl: v.url || embedUrl
      });
    })
  );

  return results;
}

async function searchRedgifsVideos(keyword, limit = 6) {
  if (!settings.allowNsfw) return [];
  const results = [];
  const seenIds = new Set();
  const cleanKw = String(keyword || '').replace(/\b(redgifs|nsfw|18\+)\b/gi, '').trim() || 'trending';

  const appendGifsFromList = (gifs) => {
    if (!Array.isArray(gifs)) return;
    for (const g of gifs) {
      if (!g?.id || seenIds.has(g.id)) continue;
      const hdUrl = g?.urls?.hd || null;
      const sdUrl = g?.urls?.sd || null;
      const mp4Url = hdUrl || sdUrl;
      if (!mp4Url || !isFormatAllowedBySettings('mp4')) continue;
      seenIds.add(g.id);
      const tagLabel = Array.isArray(g.tags) && g.tags.length ? g.tags.slice(0, 4).join(', ') : cleanKw;
      results.push({
        id: `rg-${g.id}`,
        title: `RedGIFs HD — ${tagLabel}`,
        videoUrl: mp4Url,
        originalUrl: mp4Url,
        convertedUrl: hdUrl && sdUrl && sdUrl !== mp4Url ? sdUrl : null,
        format: 'mp4',
        duration: Number(g.duration) || 0,
        tags: Array.isArray(g.tags) ? g.tags.slice(0, 6) : [],
        isHd: Boolean(hdUrl),
        isNsfw: true,
        sourceName: `RedGIFs (${cleanKw})`,
        pageUrl: `https://www.redgifs.com/watch/${encodeURIComponent(g.id)}`
      });
    }
  };

  try {
    const token = await getRedgifsTempToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Primary search on RedGIFs API v2
    const searchUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(
      cleanKw
    )}&order=trending&count=${limit}`;
    const res = await fetch(searchUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      appendGifsFromList(data?.gifs);
    }

    // 2. Niche/creator keywords (or when trending returns 0) fall back to 'best' and creator feeds
    if (results.length === 0) {
      const fallbackUrls = [
        `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(cleanKw)}&order=best&count=${limit}`
      ];
      if (cleanKw.toLowerCase() !== 'trending' && /^[a-zA-Z0-9_.-]{3,30}$/.test(cleanKw)) {
        fallbackUrls.push(
          `https://api.redgifs.com/v2/users/${encodeURIComponent(cleanKw.toLowerCase())}/search?order=new&count=${limit}`
        );
      }
      const settled = await Promise.allSettled(
        fallbackUrls.map(async (u) => {
          const r = await fetch(u, { headers });
          if (r.ok) return await r.json();
          return null;
        })
      );
      for (const s of settled) {
        if (s.status === 'fulfilled' && s.value) {
          appendGifsFromList(s.value.gifs);
        }
      }
    }
  } catch {
    // ignore direct API error and try Reddit RedGIFs index below
  }

  // 3. Fallback: if RedGIFs API returned 0 results or was blocked, search Reddit's index of redgifs.com links and resolve signed URLs
  if (results.length === 0) {
    try {
      const isTrendingDefault = cleanKw.toLowerCase() === 'trending';
      const redditQuery = isTrendingDefault ? 'site:redgifs.com' : `site:redgifs.com ${cleanKw}`;
      const redditSort = isTrendingDefault ? 'hot' : 'relevance';
      const rgRedditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
        redditQuery
      )}&type=link&sort=${redditSort}&include_over_18=1&limit=25&raw_json=1`;
      const json = await fetchWithCorsFallback(rgRedditUrl, false);
      const fallbackItems = extractRedditVideosFromListing(json, `RedGIFs (${cleanKw})`, true).filter(
        (item) => /redgifs\.com/i.test(`${item?.videoUrl || ''} ${item?.originalUrl || ''}`)
      );
      const signedItems = await upgradeUnsignedRedgifsItems(fallbackItems.slice(0, limit));
      results.push(...signedItems);
    } catch {
      // ignore fallback error
    }
  }

  const filtered = filterAndSortTubeResults(results);
  return filtered.length > 0 ? filtered : filterAndSortTubeResults(results, 'all', settings.tubeQualityFilter);
}

// 4. Reddit Subreddit or Global Keyword Video Search
function extractRedditVideosFromListing(json, sourceLabel, allowSfwFallback = false) {
  const children = json?.data?.children || [];
  const results = [];

  for (const child of children) {
    const post = child?.data;
    if (!post) continue;
    if (post.over_18 && !settings.allowNsfw) continue;
    if (!allowSfwFallback && settings.allowNsfw && post.over_18 === false) continue;

    const mediaPost = post.crosspost_parent_list?.[0] || post;

    let rawVideoUrl =
      mediaPost?.secure_media?.reddit_video?.fallback_url ||
      mediaPost?.media?.reddit_video?.fallback_url ||
      mediaPost?.preview?.reddit_video_preview?.fallback_url ||
      mediaPost?.preview?.video_preview?.fallback_url ||
      mediaPost?.preview?.images?.[0]?.variants?.mp4?.source?.url ||
      null;

    // Support Reddit Gallery / media_metadata animated MP4 items
    if (!rawVideoUrl && mediaPost?.media_metadata && typeof mediaPost.media_metadata === 'object') {
      for (const metaItem of Object.values(mediaPost.media_metadata)) {
        const mp4Candidate = metaItem?.s?.mp4 || metaItem?.p?.[metaItem.p.length - 1]?.mp4;
        if (mp4Candidate && typeof mp4Candidate === 'string') {
          rawVideoUrl = mp4Candidate.replace(/&amp;/g, '&');
          break;
        }
      }
    }

    const hlsUrl =
      mediaPost?.secure_media?.reddit_video?.hls_url ||
      mediaPost?.media?.reddit_video?.hls_url ||
      null;

    const candidateDirectUrl = mediaPost.url_overridden_by_dest || mediaPost.url;
    let redgifsMediaFallbackUrl = null;
    if (!rawVideoUrl && typeof candidateDirectUrl === 'string') {
      if (DIRECT_VIDEO_URL_REGEX.test(candidateDirectUrl)) {
        rawVideoUrl = candidateDirectUrl;
      } else if (/redgifs\.com/i.test(candidateDirectUrl)) {
        // Extract RedGIFs direct .mp4 from oembed thumbnail pattern (preserving exact CamelCase slug)
        const oembedThumb =
          mediaPost?.secure_media?.oembed?.thumbnail_url ||
          mediaPost?.media?.oembed?.thumbnail_url ||
          mediaPost?.preview?.images?.[0]?.source?.url ||
          '';
        const thumbSlugMatch = String(oembedThumb).match(
          /https?:\/\/(?:thumbs\d*|media|i)\.redgifs\.com\/(?:i\/)?([a-zA-Z0-9_-]+?)(?:-poster|-mobile|-size_restricted|-large)?\.(?:jpg|png|gif|mp4|webm)/i
        );
        if (thumbSlugMatch?.[1]) {
          const hostPrefixMatch = String(oembedThumb).match(
            /^(https?:\/\/(?:thumbs\d*|media)\.redgifs\.com)\//i
          );
          const cdnHost = hostPrefixMatch?.[1] || 'https://media.redgifs.com';
          rawVideoUrl = `${cdnHost}/${thumbSlugMatch[1]}.mp4`;
          if (/^https?:\/\/thumbs\d*\.redgifs\.com$/i.test(cdnHost)) {
            redgifsMediaFallbackUrl = `https://media.redgifs.com/${thumbSlugMatch[1]}.mp4`;
          }
        } else {
          const rgId = extractRedgifsId(candidateDirectUrl);
          if (rgId) {
            rawVideoUrl = `https://media.redgifs.com/${rgId}.mp4`;
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
        convertedUrl: normalized.convertedUrl || redgifsMediaFallbackUrl,
        format: normalized.format,
        isAutoConverted: normalized.isAutoConverted,
        isNsfw: Boolean(post.over_18 || settings.allowNsfw),
        over_18: Boolean(post.over_18 || settings.allowNsfw),
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

async function upgradeUnsignedRedgifsItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const output = [];
  const unsignedQueue = [];

  for (const item of items) {
    if (!item?.videoUrl) continue;
    if (/^https?:\/\/(?:thumbs\d*|media|i)\.redgifs\.com\/[^?]+$/i.test(item.videoUrl)) {
      unsignedQueue.push(item);
    } else {
      output.push(item);
    }
  }

  if (unsignedQueue.length > 0) {
    const toResolve = unsignedQueue.slice(0, 6);
    const settled = await Promise.allSettled(
      toResolve.map(async (item) => {
        const resolved = await resolveRedgifsUrlToMp4(item.videoUrl, item.title);
        if (!resolved?.videoUrl) return null;
        return {
          ...item,
          videoUrl: resolved.videoUrl,
          originalUrl: resolved.videoUrl,
          convertedUrl: resolved.convertedUrl || null,
          duration: item.duration || resolved.duration || 0,
          isHd: Boolean(item.isHd || resolved.isHd)
        };
      })
    );
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        output.push(s.value);
      }
    }
  }

  return output;
}

async function fetchSubredditVideos(subreddit) {
  const cleanSub = subreddit.replace(/^\/?r\//i, '').trim();
  const encodedSubPath = cleanSub
    .split('+')
    .map((part) => encodeURIComponent(part.trim()))
    .filter(Boolean)
    .join('+');
  const nsfwFlag = settings.allowNsfw ? '1' : '0';
  const sorts = ['hot', 'top', 'new'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
  const endpoints = [
    `https://www.reddit.com/r/${encodedSubPath}/${randomSort}.json?limit=35&include_over_18=${nsfwFlag}&raw_json=1`,
    `https://old.reddit.com/r/${encodedSubPath}/${randomSort}.json?limit=35&include_over_18=${nsfwFlag}&raw_json=1`
  ];

  for (const url of endpoints) {
    try {
      const json = await fetchWithCorsFallback(url, false);
      const extracted = await upgradeUnsignedRedgifsItems(
        extractRedditVideosFromListing(json, `r/${cleanSub}`)
      );
      if (extracted.length > 0) return extracted;
      const sfwOrAll = await upgradeUnsignedRedgifsItems(
        extractRedditVideosFromListing(json, `r/${cleanSub}`, true)
      );
      if (sfwOrAll.length > 0) return sfwOrAll;
    } catch {
      // Try alternate Reddit mirror
    }
  }

  return [];
}

async function searchRedditVideosByKeyword(keyword) {
  const rawKw = String(keyword || '').trim();
  if (!rawKw) return [];

  const nsfwFlag = settings.allowNsfw ? '1' : '0';
  const isStrict = Boolean(settings.allowNsfw);
  const effectiveQuery =
    isStrict && !/\bnsfw:yes\b/i.test(rawKw) ? `${rawKw} nsfw:yes` : rawKw;
  const sorts = ['relevance', 'hot', 'top'];
  const randomSort = sorts[Math.floor(Math.random() * sorts.length)];

  const tasks = [];
  const results = [];
  const seenIds = new Set();

  const addUnique = (items) => {
    for (const item of items) {
      if (item?.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        results.push(item);
      }
    }
  };

  // 1. Global Reddit keyword search
  tasks.push(
    (async () => {
      try {
        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
          effectiveQuery
        )}&type=link&sort=${randomSort}&include_over_18=${nsfwFlag}&limit=35&raw_json=1`;
        const json = await fetchWithCorsFallback(searchUrl, false);
        let items = extractRedditVideosFromListing(json, `Reddit (${rawKw})`);
        if (items.length === 0 && isStrict) {
          // Fallback if 'nsfw:yes' or strict post.over_18 filter excluded matching keyword posts
          items = extractRedditVideosFromListing(json, `Reddit (${rawKw})`, true);
          if (items.length === 0 && effectiveQuery !== rawKw) {
            const plainUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
              rawKw
            )}&type=link&sort=relevance&include_over_18=${nsfwFlag}&limit=35&raw_json=1`;
            const plainJson = await fetchWithCorsFallback(plainUrl, false);
            items = extractRedditVideosFromListing(plainJson, `Reddit (${rawKw})`, true);
          }
        }
        addUnique(items);
      } catch {}
    })()
  );

  // 2. If keyword is a single word / handle / r/sub / u/user, also check matching subreddit & user profile
  const handleMatch = rawKw.match(/^(?:\/?(?:r|u|user)\/)?([a-zA-Z0-9_-]{3,28})$/i);
  if (handleMatch?.[1]) {
    const cleanHandle = handleMatch[1];
    tasks.push(
      (async () => {
        try {
          const subUrl = `https://www.reddit.com/r/${encodeURIComponent(
            cleanHandle
          )}/hot.json?limit=25&include_over_18=${nsfwFlag}&raw_json=1`;
          const subJson = await fetchWithCorsFallback(subUrl, false);
          addUnique(extractRedditVideosFromListing(subJson, `r/${cleanHandle}`, true));
        } catch {}
      })(),
      (async () => {
        try {
          const userUrl = `https://www.reddit.com/user/${encodeURIComponent(
            cleanHandle
          )}/submitted.json?limit=25&include_over_18=${nsfwFlag}&raw_json=1`;
          const userJson = await fetchWithCorsFallback(userUrl, false);
          addUnique(extractRedditVideosFromListing(userJson, `u/${cleanHandle}`, true));
        } catch {}
      })()
    );
  }

  await Promise.allSettled(tasks);
  return await upgradeUnsignedRedgifsItems(results);
}

// 5. PeerTube Global Federated Search Engine (via SepiaSearch API + PeerTube Instance Video API)
async function searchPeerTubeVideos(keyword, limit = 4) {
  const nsfwParam = settings.allowNsfw ? 'true' : 'false';
  const searchUrl = `https://sepiasearch.org/api/v1/search/videos?search=${encodeURIComponent(
    keyword
  )}&count=12&nsfw=${nsfwParam}&sort=-match`;

  const res = await fetchWithTimeout(searchUrl, 4000);
  if (!res.ok) return [];

  const json = await res.json();
  let data = Array.isArray(json?.data) ? json.data : [];

  // If strict nsfw=true returned 0 matches on SepiaSearch, retry with nsfw=both
  if (data.length === 0 && nsfwParam === 'true') {
    try {
      const bothUrl = `https://sepiasearch.org/api/v1/search/videos?search=${encodeURIComponent(
        keyword
      )}&count=12&nsfw=both&sort=-match`;
      const bothRes = await fetchWithTimeout(bothUrl, 3500);
      if (bothRes.ok) {
        const bothJson = await bothRes.json();
        data = Array.isArray(bothJson?.data) ? bothJson.data : [];
      }
    } catch {}
  }

  if (!data.length) return [];

  const picked = [...data].sort(() => Math.random() - 0.5).slice(0, Math.min(5, Math.max(3, limit)));
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

  return results.slice(0, limit);
}

// 6. Lemmy & Mastodon Open Fediverse Video Feeds
async function searchFediverseVideos(keyword) {
  const tagWords = String(keyword || '')
    .replace(/\b(?:lemmy|fediverse|mastodon|redgifs)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter((w) => w.length >= 2);
  const cleanTag = tagWords[0] || (settings.allowNsfw ? 'nsfw' : 'video');
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
          if ((att.type === 'video' || att.type === 'gifv') && typeof att.url === 'string' && /^https:\/\//i.test(att.url)) {
            const fmt = detectVideoFormat(att.url, 'mp4');
            if (!isFormatAllowedBySettings(fmt.ext)) continue;
            const plainText = String(st.content || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const remoteFallback =
              typeof att.remote_url === 'string' && /^https:\/\//i.test(att.remote_url) && att.remote_url !== att.url
                ? att.remote_url
                : null;
            results.push({
              id: `masto-${att.id || st.id}`,
              title: plainText.slice(0, 75) || `Mastodon #${cleanTag} Clip`,
              videoUrl: att.url,
              originalUrl: att.url,
              convertedUrl: remoteFallback,
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
        let candidateUrl = post.url || post.embed_video_url;
        if (!candidateUrl || typeof candidateUrl !== 'string') continue;

        if (/redgifs\.com/i.test(candidateUrl)) {
          const resolvedRg = await resolveRedgifsUrlToMp4(candidateUrl, post.name || 'Lemmy Video Post');
          if (resolvedRg) {
            results.push({
              ...resolvedRg,
              id: `lemmy-${post.id}`,
              title: post.name || resolvedRg.title,
              sourceName: `Lemmy (${entry?.community?.name || 'fediverse'})`,
              pageUrl: post.ap_id || candidateUrl
            });
          }
          continue;
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

  // Dedicated 18+ Fediverse community search when 18+ mode is enabled
  if (settings.allowNsfw) {
    tasks.push(
      (async () => {
        const nsfwLemmyUrl = `https://lemmynsfw.com/api/v3/search?q=${encodeURIComponent(
          keyword
        )}&type_=Posts&sort=TopAll&limit=20`;
        const res = await fetchWithTimeout(nsfwLemmyUrl, 4000);
        if (!res.ok) return;
        const data = await res.json();
        const posts = Array.isArray(data?.posts) ? data.posts : [];

        for (const entry of posts) {
          const post = entry?.post;
          if (!post) continue;
          let candidateUrl = post.url || post.embed_video_url;
          if (!candidateUrl || typeof candidateUrl !== 'string') continue;

          if (/redgifs\.com/i.test(candidateUrl)) {
            const resolvedRg = await resolveRedgifsUrlToMp4(candidateUrl, post.name || 'Fediverse 18+ Video Post');
            if (resolvedRg) {
              results.push({
                ...resolvedRg,
                id: `lemmynsfw-${post.id}`,
                title: post.name || resolvedRg.title,
                sourceName: `Lemmy 18+ (${entry?.community?.name || 'nsfw'})`,
                pageUrl: post.ap_id || candidateUrl
              });
            }
            continue;
          }

          if (DIRECT_VIDEO_URL_REGEX.test(candidateUrl)) {
            const normalized = normalizeAndAutoRewriteVideoUrl(candidateUrl);
            if (!normalized || !isFormatAllowedBySettings(normalized.format)) continue;
            results.push({
              id: `lemmynsfw-${post.id}`,
              title: post.name || 'Fediverse 18+ Video Post',
              videoUrl: normalized.videoUrl,
              originalUrl: normalized.originalUrl,
              convertedUrl: normalized.convertedUrl,
              format: normalized.format,
              isAutoConverted: normalized.isAutoConverted,
              isNsfw: true,
              sourceName: `Lemmy 18+ (${entry?.community?.name || 'nsfw'})`,
              pageUrl: post.ap_id || candidateUrl
            });
          }
        }
      })()
    );
  }

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

  // 2. Relative video src/href/data-src/content/file attributes & JSON tube player keys (KVS, SpankBang, PornOne, Streamable)
  const relRegex = new RegExp(
    `(?:src|href|data-src|data-video|content|video_url|video_alt_url|video_alt_url2|video_alt_url3|mp4_url|hls_url|stream_url|quality_1080p|quality_720p|quality_480p|quality_360p|quality_240p|contentUrl|file|__fileurl)\\s*[:=]\\s*["']([^"']+\\.(?:${VIDEO_EXT_REGEX_PATTERN})(?:\\?[^"']*)?)["']`,
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

  // 3. Explicit HTML5 tube player setter calls (e.g. setVideoUrlHigh, setVideoUrlLow, setVideoHLS)
  const setterRegex = /setVideo(?:UrlHigh|UrlLow|HLS)\(\s*["'](https?:\/\/[^"']+)["']\s*\)/gi;
  while ((m = setterRegex.exec(decodedText)) !== null) {
    foundUrls.add(m[1]);
  }

  // 4. OpenGraph & Twitter Player stream meta tags (<meta property="og:video" content="...">)
  const ogVideoRegex =
    /<meta[^>]+(?:property|name)=["'](?:og:video(?::url|:secure_url)?|twitter:player:stream)["'][^>]+content=["'](https?:\/\/[^"']+)["']/gi;
  while ((m = ogVideoRegex.exec(decodedText)) !== null) {
    if (DIRECT_VIDEO_URL_REGEX.test(m[1]) || /\.(?:mp4|m3u8|webm|mov)(\b|$)/i.test(m[1])) {
      foundUrls.add(m[1]);
    }
  }

  // Sort full streams ahead of tiny hover-preview clips if both exist on a page
  const all = [...foundUrls];
  const nonPreview = all.filter((u) => !/(?:preview|thumb|trailer|sprite)/i.test(u));
  return nonPreview.length > 0 ? [...nonPreview, ...all.filter((u) => !nonPreview.includes(u))] : all;
}

function safeDecodeURIComponent(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return String(str ?? '');
  }
}

const KNOWN_NSFW_DOMAIN_REGEX =
  /(?:^|[./])(?:redgifs|eporner|fulltaboo|pornone|spankbang|xvideos|xhamster|pornhub|xnxx|youporn|tube8|tnaflix|chaturbate|stripchat)\./i;

function isKnownNsfwUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  return KNOWN_NSFW_DOMAIN_REGEX.test(rawUrl);
}

// 8. Custom URL / Webpage & Free Tube Site Multi-Format Video Scanner
async function scanUrlForVideos(targetUrl, customLabel = 'Web Scanner', allowSubpageCrawl = true) {
  const trimmed = targetUrl.trim();
  const markScannedNsfw = Boolean(settings.allowNsfw) || isKnownNsfwUrl(trimmed);

  // Direct RedGIFs watch/embed link resolver
  if (/redgifs\.com\/(?:watch|ifr|detail)\//i.test(trimmed)) {
    const resolvedRg = await resolveRedgifsUrlToMp4(trimmed, customLabel);
    if (resolvedRg) {
      return [resolvedRg];
    }
  }

  if (DIRECT_VIDEO_URL_REGEX.test(trimmed)) {
    const normalized = normalizeAndAutoRewriteVideoUrl(trimmed);
    if (!normalized || !isFormatAllowedBySettings(normalized.format)) {
      return [];
    }
    const fileName = trimmed.split('/').pop().split('?')[0].split('#')[0] || 'Direct Video';
    return [
      {
        id: `url-${Date.now()}`,
        title: safeDecodeURIComponent(fileName),
        videoUrl: normalized.videoUrl,
        originalUrl: normalized.originalUrl,
        convertedUrl: normalized.convertedUrl,
        format: normalized.format,
        isAutoConverted: normalized.isAutoConverted,
        ...(markScannedNsfw ? { isNsfw: true } : {}),
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

  let rawText = '';
  try {
    rawText = await fetchWithCorsFallback(trimmed, true);
  } catch {
    rawText = '';
  }
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
      title: idx === 0 && pageTitle ? pageTitle : safeDecodeURIComponent(shortName),
      videoUrl: normalized.videoUrl,
      originalUrl: normalized.originalUrl,
      convertedUrl: normalized.convertedUrl,
      format: normalized.format,
      isAutoConverted: normalized.isAutoConverted,
      ...(markScannedNsfw || isKnownNsfwUrl(vUrl) ? { isNsfw: true } : {}),
      sourceName: customLabel,
      pageUrl: trimmed
    });
    idx++;
  }

  // If this watch page embeds its player inside an <iframe> and yielded no direct video URLs yet, scan the iframe src
  if (results.length === 0 && typeof rawText === 'string' && rawText.length > 0) {
    const iframeLinks = [];
    const iframeRegex = /<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi;
    let im;
    while ((im = iframeRegex.exec(rawText)) !== null && iframeLinks.length < 2) {
      try {
        const frameUrl = new URL(im[1].replace(/&amp;/g, '&'), trimmed).href;
        if (
          /^https?:\/\//i.test(frameUrl) &&
          frameUrl !== trimmed &&
          !/(?:doubleclick|googlesyndication|exoclick|juicyads|trafficjunky|adserver|facebook|twitter)/i.test(frameUrl) &&
          !iframeLinks.includes(frameUrl)
        ) {
          iframeLinks.push(frameUrl);
        }
      } catch {
        // ignore invalid iframe URL
      }
    }

    if (iframeLinks.length > 0) {
      const frameSettled = await Promise.allSettled(
        iframeLinks.map((fUrl) => scanUrlForVideos(fUrl, customLabel, false))
      );
      for (const s of frameSettled) {
        if (s.status === 'fulfilled' && Array.isArray(s.value)) {
          for (const item of s.value.slice(0, 2)) {
            if (pageTitle && (!item.title || /^Video #/i.test(item.title))) {
              item.title = pageTitle;
            }
            item.pageUrl = trimmed;
            results.push(item);
          }
        }
      }
    }
  }

  // Two-Hop Tube Listing Crawler: if this was a tube homepage/search/category page, crawl up to 4 randomized watch pages
  if (allowSubpageCrawl && results.length < 2 && typeof rawText === 'string' && rawText.length > 0) {
    const candidateLinks = [];
    const linkRegex = /href=["']([^"']*(?:\/video[^"']*|\bviewkey=[^"']+|\/watch\/[^"']+|\/videos\/[^"']+|\/v\/[^"']+))["']/gi;
    let lm;
    while ((lm = linkRegex.exec(rawText)) !== null && candidateLinks.length < 24) {
      try {
        const fullLink = new URL(lm[1].replace(/&amp;/g, '&'), trimmed).href;
        if (fullLink !== trimmed && !candidateLinks.includes(fullLink)) {
          candidateLinks.push(fullLink);
        }
      } catch {
        // ignore invalid subpage URL
      }
    }

    // Also support WordPress / Tube post-slug watch pages on the same host (e.g. https://fulltaboo.tv/post-title-slug/)
    if (candidateLinks.length < 24) {
      let baseHost = '';
      try {
        baseHost = new URL(trimmed).host;
      } catch {}
      const slugRegex = /href=["']([^"'#?]+)["']/gi;
      let sm;
      while ((sm = slugRegex.exec(rawText)) !== null && candidateLinks.length < 24) {
        try {
          const parsed = new URL(sm[1].replace(/&amp;/g, '&'), trimmed);
          if (baseHost && parsed.host !== baseHost) continue;
          const pathClean = parsed.pathname.replace(/^\/+|\/+$/g, '');
          // Match single-segment hyphenated post slugs while excluding navigation/taxonomy paths
          if (
            /^[a-z0-9]+-[a-z0-9-]{4,}$/i.test(pathClean) &&
            !/^(?:category|categories|tag|tags|actor|actors|star|stars|model|models|studio|studios|channel|channels|page|wp-[a-z0-9-]+|feed|about|contact|privacy|terms|dmca|login|register)/i.test(
              pathClean
            ) &&
            parsed.href !== trimmed &&
            !candidateLinks.includes(parsed.href)
          ) {
            candidateLinks.push(parsed.href);
          }
        } catch {
          // ignore invalid link
        }
      }
    }

    const watchLinks = shuffleArray(candidateLinks).slice(0, 4);
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

  if (markScannedNsfw) {
    for (const item of results) {
      if (item && typeof item === 'object') {
        item.isNsfw = true;
      }
    }
  }

  return results;
}

// Helper: Extract candidate external video/tube pages from search engine HTML (e.g. DuckDuckGo HTML/Lite)
function extractCandidateWebPagesFromSearchHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return [];

  const found = [];
  const seen = new Set();

  const isAllowedCandidateUrl = (u) => {
    try {
      const parsed = new URL(u);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      const host = parsed.hostname.toLowerCase();
      // Exclude search engine internal domains, walled gardens without direct MP4s, and ad networks
      if (
        /(?:duckduckgo\.com|google\.com|bing\.com|yahoo\.com|yandex\.|youtube\.com|youtu\.be|netflix\.com|hulu\.com|disneyplus\.com|facebook\.com|instagram\.com|tiktok\.com|pinterest\.com|linkedin\.com|amazon\.com|doubleclick|googlesyndication|exoclick|juicyads|trafficjunky)/i.test(
          host
        )
      ) {
        return false;
      }
      if (/\.(?:css|js|png|jpe?g|svg|ico|woff2?|ttf|xml|json|pdf)(\?|$)/i.test(parsed.pathname)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const addCandidate = (rawUrl) => {
    const clean = String(rawUrl || '')
      .replace(/&amp;/g, '&')
      .trim();
    if (!clean || seen.has(clean)) return;
    if (isAllowedCandidateUrl(clean)) {
      seen.add(clean);
      found.push(clean);
    }
  };

  // 1. DuckDuckGo uddg= encoded destination links
  const uddgRegex = /[?&]uddg=([^&"'>\s]+)/gi;
  let m;
  while ((m = uddgRegex.exec(rawHtml)) !== null) {
    try {
      addCandidate(decodeURIComponent(m[1]));
    } catch {}
  }

  // 2. Direct external href="https://..." links in search result anchors
  const hrefRegex = /href=["'](https?:\/\/[^"'<>#\s]+)["']/gi;
  while ((m = hrefRegex.exec(rawHtml)) !== null) {
    addCandidate(m[1]);
  }

  // Prioritize direct video files and recognizable tube/video watch pages first
  const videoWatchPriority = found.filter(
    (u) =>
      DIRECT_VIDEO_URL_REGEX.test(u) ||
      /(?:\/video|\/watch|\/videos\/|\/v\/|\/embed\/|viewkey=|redgifs\.com|eporner\.com|fulltaboo\.tv|pornone\.com|spankbang\.com|xhamster\.com|xvideos\.com|streamable\.com|imgur\.com|catbox\.moe|dailymotion\.com|vimeo\.com|archive\.org)/i.test(
        u
      )
  );
  const others = found.filter((u) => !videoWatchPriority.includes(u));
  return [...videoWatchPriority, ...others];
}

// 10. Open-Web & Public Video Sites Discovery Crawler (Discovers & scans sites across the web)
async function searchOpenWebVideos(keyword, limit = 6) {
  const cleanKw = String(keyword || '').trim();
  if (!cleanKw) return [];

  const results = [];
  const seenUrlsInWeb = new Set();
  const addResult = (item) => {
    if (item?.videoUrl && !seenUrlsInWeb.has(item.videoUrl)) {
      seenUrlsInWeb.add(item.videoUrl);
      results.push(item);
    }
  };

  const tasks = [];

  // A. DuckDuckGo Open-Web Video & Tube Search Crawler (SafeSearch Off kp=-2 when 18+ On, Strict kp=1 when Safe)
  tasks.push(
    (async () => {
      try {
        const kp = settings.allowNsfw ? '-2' : '1';
        const webQuery =
          settings.allowNsfw && settings.nsfwMode === 'strict'
            ? `${cleanKw} video (mp4 OR tube OR watch)`
            : `${cleanKw} video (mp4 OR watch)`;
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(webQuery)}&kp=${kp}`;
        const searchHtml = await fetchWithCorsFallback(ddgUrl, true);
        const candidates = extractCandidateWebPagesFromSearchHtml(searchHtml).slice(0, 4);

        const settled = await Promise.allSettled(
          candidates.map(async (pageUrl) => {
            let hostLabel = 'Open Web';
            try {
              hostLabel = `Web (${new URL(pageUrl).hostname.replace(/^www\./i, '')})`;
            } catch {}
            const scanned = await scanUrlForVideos(pageUrl, hostLabel, true);
            for (const item of scanned.slice(0, 2)) {
              if (settings.allowNsfw && settings.nsfwMode === 'strict') {
                item.isNsfw = true;
              }
              addResult(item);
            }
          })
        );
        return settled;
      } catch {
        return null;
      }
    })()
  );

  // B. Open-Web External Video Host Discovery (Streamable, Imgur, Catbox, RedGIFs, Eporner & Direct .MP4/.WEBM hosts)
  tasks.push(
    (async () => {
      try {
        const nsfwFlag = settings.allowNsfw ? '1' : '0';
        const hostFilter = settings.allowNsfw
          ? '(site:streamable.com OR site:imgur.com OR site:catbox.moe OR site:redgifs.com OR site:eporner.com OR url:.mp4 OR url:.webm)'
          : '(site:streamable.com OR site:imgur.com OR site:catbox.moe OR url:.mp4 OR url:.webm)';
        const extUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(
          `${cleanKw} ${hostFilter}`
        )}&type=link&sort=relevance&include_over_18=${nsfwFlag}&limit=25&raw_json=1`;
        const json = await fetchWithCorsFallback(extUrl, false);
        const directItems = extractRedditVideosFromListing(json, `Open Web (${cleanKw})`, true);
        directItems.forEach(addResult);

        // Also crawl up to 2 external video watch pages (e.g. streamable.com/abc or external tube pages) linked in results
        const children = json?.data?.children || [];
        const externalPages = [];
        for (const child of children) {
          const post = child?.data;
          if (!post) continue;
          if (post.over_18 && !settings.allowNsfw) continue;
          const dest = post.url_overridden_by_dest || post.url;
          if (
            typeof dest === 'string' &&
            /^https?:\/\//i.test(dest) &&
            !DIRECT_VIDEO_URL_REGEX.test(dest) &&
            !/(?:reddit\.com|redd\.it|redgifs\.com|youtube\.com|youtu\.be)/i.test(dest) &&
            externalPages.length < 2
          ) {
            externalPages.push({ url: dest, title: post.title, over18: Boolean(post.over_18) });
          }
        }

        await Promise.allSettled(
          externalPages.map(async (entry) => {
            let hostLabel = 'Open Web';
            try {
              hostLabel = `Web (${new URL(entry.url).hostname.replace(/^www\./i, '')})`;
            } catch {}
            const scanned = await scanUrlForVideos(entry.url, hostLabel, false);
            for (const item of scanned.slice(0, 2)) {
              if (entry.title && (!item.title || /^Video #/i.test(item.title))) {
                item.title = entry.title;
              }
              if (entry.over18) item.isNsfw = true;
              addResult(item);
            }
          })
        );
      } catch {}
    })()
  );

  // C. Crawl ONLY currently enabled Custom / Preset Website URL sources via Site Search (?s=keyword)
  tasks.push(
    (async () => {
      try {
        const enabledUrlSources = getEffectiveActiveSources().filter(
          (s) => s && s.enabled && s.type === 'url' && s.value
        );
        const uniqueOrigins = [];
        const seenOrigins = new Set();
        for (const s of enabledUrlSources) {
          try {
            const u = new URL(s.value);
            if (!seenOrigins.has(u.origin)) {
              seenOrigins.add(u.origin);
              uniqueOrigins.push({ origin: u.origin, host: u.hostname.replace(/^www\./i, ''), isNsfw: Boolean(s.isNsfw) });
            }
          } catch {}
        }

        await Promise.allSettled(
          uniqueOrigins.slice(0, 2).map(async (site) => {
            const siteSearchUrl = `${site.origin}/?s=${encodeURIComponent(cleanKw)}`;
            const items = await scanUrlForVideos(siteSearchUrl, `${site.host} (${cleanKw})`, true);
            for (const item of items.slice(0, 2)) {
              if (site.isNsfw) item.isNsfw = true;
              addResult(item);
            }
          })
        );
      } catch {}
    })()
  );

  await Promise.allSettled(tasks);
  return results.slice(0, limit);
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

// 9. Automatic Free Tube Sites Search Engine (Dailymotion in Safe Mode; Eporner API v2 & PornOne in 18+ Mode, plus FullTaboo.tv when enabled)
async function searchFreeTubeSites(keyword, limit = 6) {
  const results = [];
  const tasks = [];

  // A. Safe Mode Only: Dailymotion Public Tube API (skipped when 18+ mode is On)
  if (!settings.allowNsfw) {
    tasks.push(
      (async () => {
        const dmUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(
          keyword
        )}&fields=id,title,url,stream_h264_url,duration&explicit=false&limit=${limit}`;
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

  // B. When 18+ Adult Content is Enabled: Query Free 18+ Tube APIs & Public Tube Crawlers Exclusively
  if (settings.allowNsfw) {
    // 1. Eporner Public Video JSON API v2 (Zero API Key, Native CORS + gvideo CDN + Embed Stream Extractor)
    tasks.push(
      (async () => {
        const epItems = await fetchDirectEpornerVideos(
          keyword,
          limit,
          `Free Tube (${keyword})`,
          null,
          true
        );
        results.push(...epItems);
      })()
    );

    // 2. PornOne & Open Tube Sites Search Crawler (Discovers streams across public tube sites)
    tasks.push(
      (async () => {
        try {
          const poSearchUrl = `https://pornone.com/search?q=${encodeURIComponent(keyword)}`;
          const poItems = await scanUrlForVideos(poSearchUrl, `PornOne Tube (${keyword})`, true);
          for (const item of poItems.slice(0, 3)) {
            item.isNsfw = true;
            results.push(item);
          }
        } catch {}
      })()
    );

    // 3. FullTaboo.tv Full-Length 18+ Tube Search Crawler (only when FullTaboo URL source is active)
    const fullTabooActive = getEffectiveActiveSources().some(
      (s) => s && s.enabled && s.type === 'url' && /fulltaboo\.tv/i.test(String(s.value || ''))
    );
    if (fullTabooActive) {
      tasks.push(
        (async () => {
          const ftSearchUrl = `https://fulltaboo.tv/?s=${encodeURIComponent(keyword)}`;
          const ftItems = await scanUrlForVideos(ftSearchUrl, `FullTaboo.tv (${keyword})`, true);
          for (const item of ftItems) {
            item.isNsfw = true;
            results.push(item);
          }
        })()
      );
    }
  }

  await Promise.allSettled(tasks);
  const filtered = filterAndSortTubeResults(results);
  return filtered.length > 0 ? filtered : filterAndSortTubeResults(results, 'all', settings.tubeQualityFilter);
}

// In-memory source pool cache (3-minute TTL) for instant 0ms subsequent pulls
const sourcePoolCache = new Map();
const SOURCE_CACHE_TTL_MS = 180_000;

function isPeerTubeSource(src) {
  if (!src || typeof src !== 'object') return false;
  const hay = `${src.id || ''} ${src.value || ''} ${src.label || ''} ${src.engine || ''}`;
  return /\bpeertube\b/i.test(hay);
}

function isFreeTubePresetSource(src) {
  if (!src || typeof src !== 'object' || src.type === 'subreddit' || src.type === 'url') return false;
  const hay = `${src.id || ''} ${src.label || ''} ${src.engine || ''}`.toLowerCase();
  return /^dir-tube-|^src-nsfw-tube-hd|^src-nsfw-romantic|\bfree tube\b/.test(hay);
}

function isPeerTubeExplicitlyEnabled(targetSource = null) {
  if (isPeerTubeSource(targetSource)) {
    return true;
  }
  if (typeof document !== 'undefined') {
    const ptCheck = document.getElementById('engPeerTube');
    if (ptCheck && ptCheck.checked === true) {
      return true;
    }
  }
  return sources.some(
    (s) =>
      s &&
      s.enabled &&
      (settings.allowNsfw ? Boolean(s.isNsfw) : !s.isNsfw) &&
      isPeerTubeSource(s)
  );
}

// Route dedicated presets (RedGIFs, NASA, Prelinger, Vintage/Archive, Fediverse, Free Tube, PeerTube)
// strictly to their own target networks without bleeding into unchecked sources
function buildKeywordEnginePromises(source, isStrictNsfw) {
  const rawVal = String(source?.value || '').trim();
  const hay = `${source?.id || ''} ${rawVal} ${source?.label || ''} ${source?.engine || ''}`.toLowerCase();
  const peerTubeAllowed = isPeerTubeExplicitlyEnabled(source);

  // 1. Dedicated PeerTube source
  if (isPeerTubeSource(source)) {
    const ptQuery = rawVal.replace(/\bpeertube\b/gi, '').trim() || (isStrictNsfw ? 'nsfw' : 'video');
    return [searchPeerTubeVideos(ptQuery, 8)];
  }

  // 2. Dedicated RedGIFs preset or niche source
  if (/^dir-rg-|^src-nsfw-redgifs|^src-nsfw-cosplay|\bredgifs\b/.test(hay)) {
    return [searchRedgifsVideos(rawVal, 10)];
  }

  // 3. Dedicated NASA Space & Science preset (Safe Mode)
  if (!isStrictNsfw && (/^src-kw-space|\bnasa\b/.test(hay))) {
    return [searchNasaVideos(rawVal, 8)];
  }

  // 4. Dedicated Prelinger & Vintage Cartoons preset (Safe Mode)
  if (!isStrictNsfw && (/^src-kw-vintage|\bprelinger\b/.test(hay))) {
    return [
      searchPrelingerArchives(rawVal, 6),
      searchInternetArchive(rawVal, 6)
    ];
  }

  // 5. Dedicated Lemmy & Mastodon Fediverse preset
  if (/^dir-fed-lemmy|\b(?:lemmy|fediverse|mastodon)\b/.test(hay)) {
    return [searchFediverseVideos(rawVal)];
  }

  // 6. Dedicated Vintage 18+ Archive / Burlesque Archive presets
  if (/^src-nsfw-vintage|^dir-fed-archive/.test(hay)) {
    return [searchInternetArchive(rawVal, 8)];
  }

  // 7. Dedicated Free Tube / Full-Length Tube 18+ presets
  if (/^dir-tube-|^src-nsfw-tube-hd|^src-nsfw-romantic/.test(hay)) {
    if (source?.id === 'dir-tube-vintage') {
      return [
        searchFreeTubeSites(rawVal, 8),
        searchInternetArchive(rawVal, 6)
      ];
    }
    return [searchFreeTubeSites(rawVal, 8)];
  }

  // 8. General keyword source or custom keyword search
  if (isStrictNsfw) {
    const nsfwEngines = [
      searchRedgifsVideos(rawVal, 5),
      searchFreeTubeSites(rawVal, 5),
      searchOpenWebVideos(rawVal, 5),
      searchRedditVideosByKeyword(rawVal)
    ];
    if (peerTubeAllowed) {
      nsfwEngines.push(searchPeerTubeVideos(rawVal, 4));
    }
    return nsfwEngines;
  }

  const safeEngines = [
    searchWikimediaVideos(rawVal, 6),
    searchInternetArchive(rawVal, 6),
    searchRedditVideosByKeyword(rawVal),
    searchFreeTubeSites(rawVal, 5),
    searchOpenWebVideos(rawVal, 5)
  ];
  if (peerTubeAllowed) {
    safeEngines.push(searchPeerTubeVideos(rawVal, 4));
  }
  return safeEngines;
}

function getSourceCacheKey(source) {
  const ptFlag = isPeerTubeExplicitlyEnabled(source) ? 'pt1' : 'pt0';
  const durFilter = settings.tubeDurationFilter || 'all';
  const qualFilter = settings.tubeQualityFilter || 'all';
  return `${source.id || ''}:${source.type}:${String(source.value || '').toLowerCase()}:${settings.formatMode}:${settings.allowNsfw}:${ptFlag}:${durFilter}:${qualFilter}`;
}

function interleaveVideoBuckets(buckets) {
  const combined = [];
  const seenInPool = new Set();
  const validBuckets = (Array.isArray(buckets) ? buckets : []).filter(
    (b) => Array.isArray(b) && b.length > 0
  );
  const maxLen = validBuckets.reduce((m, b) => Math.max(m, b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of validBuckets) {
      const item = bucket[i];
      if (item?.videoUrl && !seenInPool.has(item.videoUrl)) {
        seenInPool.add(item.videoUrl);
        combined.push(item);
      }
    }
  }
  return combined;
}

// Pull videos from a single source object, randomize within the source pool, and tag originSourceId
async function pullFromSource(source) {
  const stampAndShuffle = (list) =>
    shuffleArray(list)
      .filter((item) => item?.videoUrl && !deadUrls.has(item.videoUrl))
      .map((item) => (source?.id ? { ...item, originSourceId: source.id } : { ...item }));

  const cacheKey = getSourceCacheKey(source);
  const cached = sourcePoolCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SOURCE_CACHE_TTL_MS) {
    const unseen = filterAndSortTubeResults(
      cached.items.filter(
        (item) => item?.videoUrl && !deadUrls.has(item.videoUrl) && !seenUrls.has(item.videoUrl)
      )
    );
    if (unseen.length >= 2) {
      return stampAndShuffle(unseen);
    }
  }

  if (source.type === 'subreddit') {
    const items = await fetchSubredditVideos(source.value);
    if (items.length > 0) {
      sourcePoolCache.set(cacheKey, { items, timestamp: Date.now() });
    }
    return stampAndShuffle(items);
  }
  if (source.type === 'url' || /^https?:\/\//i.test(String(source.value || '').trim())) {
    const items = await scanUrlForVideos(source.value, source.label || 'Custom URL');
    if (source.isNsfw || settings.allowNsfw) {
      items.forEach((item) => {
        item.isNsfw = true;
      });
    }
    if (items.length > 0) {
      sourcePoolCache.set(cacheKey, { items, timestamp: Date.now() });
    }
    return stampAndShuffle(items);
  }

  // Default: 'keyword' -> wait until all target engines finish pulling and interleave results
  const isStrictNsfw = Boolean(settings.allowNsfw || source.isNsfw);
  const enginePromises = buildKeywordEnginePromises(source, isStrictNsfw);

  if (enginePromises.length === 0) {
    return [];
  }

  const settled = await Promise.allSettled(enginePromises);
  const engineBuckets = [];

  for (const res of settled) {
    if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
      const items = res.value;
      if (isStrictNsfw) {
        items.forEach((item) => {
          if (item) item.isNsfw = true;
        });
      }
      engineBuckets.push(items);
    }
  }

  const combined = interleaveVideoBuckets(engineBuckets);
  if (combined.length > 0) {
    sourcePoolCache.set(cacheKey, { items: combined, timestamp: Date.now() });
  }
  return stampAndShuffle(combined);
}

// ==========================================
// PLAYER, CONTINUOUS BACKGROUND PULLER & REELS MODE CONTROLLER
// ==========================================

const CONTINUOUS_QUEUE_TARGET_AHEAD = 12;
const CONTINUOUS_PULL_INTERVAL_MS = 4500;
let continuousPullTimer = null;
let continuousPullPromise = null;
let continuousSourceCursor = 0;

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
    if (videoQueue.length === 0) {
      emptyEl?.classList.remove('hidden');
    }
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

// Run one cycle of the continuous background puller across active sources in round-robin order
async function runContinuousPullCycle() {
  if (!settings.prebuffer) return 0;
  if (typeof document !== 'undefined' && document.body?.classList?.contains?.('app-locked')) {
    return 0;
  }
  if (continuousPullPromise) {
    return await continuousPullPromise;
  }
  const effectiveSources = getEffectiveActiveSources();
  if (effectiveSources.length === 0) return 0;

  const remainingAhead = videoQueue.length - 1 - Math.max(0, currentIndex);
  if (remainingAhead >= CONTINUOUS_QUEUE_TARGET_AHEAD) {
    return 0;
  }

  isBackgroundRefilling = true;
  continuousPullPromise = (async () => {
    let addedCount = 0;
    const pullGen = modeGeneration;
    const pullSourceGen = sourceSelectionGeneration;
    const pullAllowNsfw = Boolean(settings.allowNsfw);
    try {
      const batchSize = Math.min(2, effectiveSources.length);
      const batchSources = [];
      for (let i = 0; i < batchSize; i++) {
        const idx = (continuousSourceCursor + i) % effectiveSources.length;
        batchSources.push(effectiveSources[idx]);
      }
      continuousSourceCursor = (continuousSourceCursor + batchSize) % effectiveSources.length;

      const settled = await Promise.allSettled(
        batchSources.map((src) => pullFromSource(src))
      );

      if (
        pullGen !== modeGeneration ||
        pullSourceGen !== sourceSelectionGeneration ||
        Boolean(settings.allowNsfw) !== pullAllowNsfw
      ) {
        return 0;
      }

      const buckets = [];
      for (const r of settled) {
        if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length > 0) {
          buckets.push(r.value);
        }
      }

      const interleaved = interleaveVideoBuckets(buckets).filter(
        (item) => item?.videoUrl && !deadUrls.has(item.videoUrl)
      );
      let fresh = interleaved.filter((item) => item?.videoUrl && !seenUrls.has(item.videoUrl));
      if (fresh.length === 0 && interleaved.length > 1 && effectiveSources.length === 1) {
        const currentPlayingUrl = videoQueue[currentIndex]?.videoUrl;
        for (const item of interleaved) {
          if (item?.videoUrl && item.videoUrl !== currentPlayingUrl) {
            seenUrls.delete(item.videoUrl);
          }
        }
        fresh = interleaved.filter((item) => item?.videoUrl && !seenUrls.has(item.videoUrl));
      }
      const picks = shuffleArray(fresh).slice(0, 4);
      for (const p of picks) {
        seenUrls.add(p.videoUrl);
        videoQueue.push(p);
        addedCount++;
      }

      if (addedCount > 0 && typeof document !== 'undefined') {
        const queueEl = document.getElementById('queueCounter');
        if (queueEl && videoQueue.length > 0) {
          queueEl.textContent = `Video ${Math.max(0, currentIndex) + 1} of ${videoQueue.length}`;
        }
      }
    } catch {
      // silent background refill
    } finally {
      isBackgroundRefilling = false;
      continuousPullPromise = null;
    }
    return addedCount;
  })();

  return await continuousPullPromise;
}

function startContinuousBackgroundPuller() {
  if (continuousPullTimer || !settings.prebuffer) return false;
  continuousPullTimer = setInterval(() => {
    if (!settings.prebuffer) {
      stopContinuousBackgroundPuller();
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) return;
    runContinuousPullCycle().catch(() => {});
  }, CONTINUOUS_PULL_INTERVAL_MS);
  continuousPullTimer.unref?.();
  return true;
}

function stopContinuousBackgroundPuller() {
  if (continuousPullTimer) {
    clearInterval(continuousPullTimer);
    continuousPullTimer = null;
  }
}

// Silently pre-buffer the next video in the queue and continuously top up the queue in the background
async function scheduleBackgroundQueuePrebuffer() {
  if (!settings.prebuffer) {
    stopContinuousBackgroundPuller();
    document.getElementById('prebufferBadge')?.classList.add('hidden');
    return;
  }

  if (typeof window !== 'undefined') {
    startContinuousBackgroundPuller();
  }

  // 1. If fewer than 2 videos remain ahead of currentIndex, immediately run a background pull cycle
  const remainingAhead = videoQueue.length - 1 - currentIndex;
  if (remainingAhead < 2) {
    await runContinuousPullCycle();
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

  if (!prebufferVideoEl && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    prebufferVideoEl = document.createElement('video');
    prebufferVideoEl.muted = true;
    prebufferVideoEl.playsInline = true;
    prebufferVideoEl.preload = 'auto';
    prebufferVideoEl.referrerPolicy = 'no-referrer';
    prebufferVideoEl.setAttribute?.('referrerpolicy', 'no-referrer');
    if (prebufferVideoEl.style) {
      prebufferVideoEl.style.display = 'none';
    }
    document.body?.appendChild?.(prebufferVideoEl);
  }

  if (prebufferVideoEl && prebufferVideoEl.src !== nextUrl) {
    prebufferVideoEl.src = nextUrl;
    prebufferVideoEl.load?.();
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

  if (queueEl) {
    queueEl.textContent =
      videoQueue.length > 0
        ? `Video ${currentIndex + 1} of ${videoQueue.length}`
        : '0 in queue';
  }

  if (prevBtn) prevBtn.disabled = currentIndex <= 0;

  const current = videoQueue[currentIndex];
  if (!current) {
    if (savePhoneBtn) savePhoneBtn.disabled = true;
    if (saveVaultBtn) saveVaultBtn.disabled = true;
    if (moreLikeBtn) moreLikeBtn.disabled = true;
    if (favCurrentBtn) {
      favCurrentBtn.disabled = true;
      favCurrentBtn.textContent = '🤍 Favorite';
      favCurrentBtn.classList?.remove('active');
    }
    if (skipBack10Btn) skipBack10Btn.disabled = true;
    if (skipFwd15Btn) skipFwd15Btn.disabled = true;
    if (skipFwd30Btn) skipFwd30Btn.disabled = true;
    if (speedSelectEl) {
      speedSelectEl.value = String(settings.playbackSpeed || 1);
    }
    if (titleEl) titleEl.textContent = 'Tap "Shuffle Random" to begin';
    if (badgeEl) badgeEl.textContent = 'Ready';
    if (origLink) {
      origLink.href = '#';
      origLink.classList.add('hidden');
    }
    document.getElementById('prebufferBadge')?.classList.add('hidden');
    if (reelsHudBadge) reelsHudBadge.textContent = 'Reels Mode';
    if (reelsHudTitle) reelsHudTitle.textContent = 'Swipe Up for Next Video';
    tagsBarEl?.classList.add('hidden');
    if (tagsBarEl) tagsBarEl.innerHTML = '';
    formatBadgeEl?.classList.add('hidden');
    convertNowBtn?.classList.add('hidden');
    if (videoEl) {
      clearPlaybackStartupWatchdog();
      try {
        videoEl.pause?.();
      } catch {}
      if (videoEl.src || videoEl.getAttribute?.('src')) {
        if (typeof videoEl.removeAttribute === 'function') {
          videoEl.removeAttribute('src');
        } else {
          videoEl.src = '';
        }
        videoEl.load?.();
      }
    }
    const loadingEl = document.getElementById('playerLoading');
    if (!loadingEl || loadingEl.classList.contains('hidden')) {
      emptyEl?.classList.remove('hidden');
    }
    updateReelsSeekerUI();
    return;
  }

  emptyEl?.classList.add('hidden');
  if (savePhoneBtn) savePhoneBtn.disabled = false;
  if (saveVaultBtn) saveVaultBtn.disabled = false;
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
  if (titleEl) titleEl.textContent = current.title || 'Untitled Video';
  if (badgeEl) badgeEl.textContent = current.sourceName || 'Random Feed';

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

  if (origLink) {
    if (current.pageUrl) {
      origLink.href = current.pageUrl;
      origLink.classList.remove('hidden');
    } else {
      origLink.classList.add('hidden');
    }
  }

  const isLockedOverlay =
    typeof document !== 'undefined' &&
    Boolean(document.body?.classList?.contains?.('app-locked'));

  const targetPlayUrl = getEffectivePlaybackUrl(current);
  const savedTime = getSavedPlaybackTime(current);
  const awaitingOfflineRehydrate = Boolean(
    current._rehydratingOfflineBlob && !(current.offlineBlob instanceof Blob)
  );
  if (videoEl && !awaitingOfflineRehydrate) {
    if (videoEl.src !== targetPlayUrl) {
      if (videoEl.dataset) {
        videoEl.dataset.autoConvertAttempted = 'false';
        videoEl.dataset.triedConvertedUrl = 'false';
        videoEl.dataset.streamRescueAttempted = current._streamRescueAttempted ? 'true' : 'false';
      }
      if ((current.isNsfw || current.over_18 || settings.allowNsfw) && settings.autoMuteNsfw) {
        videoEl.muted = true;
      }
      videoEl.src = targetPlayUrl;
      videoEl.load?.();
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
      if (
        settings.autoPlay &&
        !isLockedOverlay &&
        !(current.offlineBlob instanceof Blob) &&
        !/^blob:/i.test(targetPlayUrl)
      ) {
        armPlaybackStartupWatchdog(videoEl, current, targetPlayUrl);
      } else {
        clearPlaybackStartupWatchdog();
      }
      if (settings.autoPlay && !isLockedOverlay) {
        videoEl.play?.()?.catch?.((err) => {
          // iOS may require user tap if unmuted; disarm watchdog so we don't skip while waiting for user gesture
          if (err?.name === 'NotAllowedError') {
            clearPlaybackStartupWatchdog();
          }
        });
      }
    } else if (savedTime > 0 && (!videoEl.currentTime || Math.abs(videoEl.currentTime - savedTime) > 1.5)) {
      try {
        videoEl.currentTime = savedTime;
      } catch {}
    }
    videoEl.playbackRate = settings.playbackSpeed || 1;
  }

  updateReelsSeekerUI();
  savePlaybackState(savedTime > 0 ? savedTime : null);

  // Trigger background pre-buffering for the upcoming video
  if (!isLockedOverlay) {
    scheduleBackgroundQueuePrebuffer();
  }
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

let downloadStatusHideTimer = null;
let activeDownloadStatusOps = 0;

function beginDownloadStatusOp(statusBox) {
  if (downloadStatusHideTimer) {
    clearTimeout(downloadStatusHideTimer);
    downloadStatusHideTimer = null;
  }
  activeDownloadStatusOps++;
  statusBox?.classList.remove('hidden');
}

function finishDownloadStatusOp(statusBox, progressBar, delayMs = 1000) {
  activeDownloadStatusOps = Math.max(0, activeDownloadStatusOps - 1);
  if (activeDownloadStatusOps > 0) return;
  if (downloadStatusHideTimer) {
    clearTimeout(downloadStatusHideTimer);
  }
  downloadStatusHideTimer = setTimeout(() => {
    downloadStatusHideTimer = null;
    if (activeDownloadStatusOps === 0) {
      statusBox?.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }
  }, delayMs);
  downloadStatusHideTimer.unref?.();
}

// Convert the currently active video in-place to .MP4 and reload the player
async function convertCurrentVideoForPlayer(videoItem) {
  if (!videoItem || videoItem.convertedBlobUrl) return false;

  const statusBox = document.getElementById('downloadStatusBox');
  const statusText = document.getElementById('downloadStatusText');
  const statusPercent = document.getElementById('downloadStatusPercent');
  const progressBar = document.getElementById('downloadProgressBar');
  const convertNowBtn = document.getElementById('convertNowBtn');

  beginDownloadStatusOp(statusBox);
  if (convertNowBtn) convertNowBtn.disabled = true;

  try {
    const result = await obtainIphoneReadyVideoBlob(videoItem, true, (label, pct, rightText) => {
      if (statusText) statusText.textContent = label;
      if (statusPercent) statusPercent.textContent = rightText || `${pct}%`;
      if (progressBar) progressBar.style.width = `${pct}%`;
    });

    if (!result || (!result.wasConverted && !videoItem.convertedBlobUrl)) {
      throw new Error('On-device transcode unavailable for this stream');
    }

    if (!videoItem.convertedBlobUrl && result.blob) {
      videoItem.convertedBlob = result.blob;
      videoItem.convertedBlobUrl = URL.createObjectURL(result.blob);
    }
    videoItem.isAutoConverted = true;
    updatePlayerUI();
    showToast('Converted to iPhone-native .MP4!');
    return true;
  } catch {
    showToast('Could not auto-convert this stream in browser.');
    return false;
  } finally {
    if (convertNowBtn) convertNowBtn.disabled = false;
    finishDownloadStatusOp(statusBox, progressBar, 1000);
  }
}

const STREAM_STARTUP_TIMEOUT_MS = 8000;
let playbackWatchdogTimer = null;
let consecutiveErrorSkips = 0;
let isHandlingPlaybackError = false;

function clearPlaybackStartupWatchdog() {
  if (playbackWatchdogTimer) {
    clearTimeout(playbackWatchdogTimer);
    playbackWatchdogTimer = null;
  }
}

function armPlaybackStartupWatchdog(videoEl, watchedItem, expectedUrl, timeoutMs = STREAM_STARTUP_TIMEOUT_MS) {
  clearPlaybackStartupWatchdog();
  if (!videoEl || !watchedItem || !expectedUrl) return;
  const baselineTime = Number(videoEl.currentTime) || 0;
  playbackWatchdogTimer = setTimeout(() => {
    playbackWatchdogTimer = null;
    if (videoQueue[currentIndex] !== watchedItem) return;
    if (
      typeof document !== 'undefined' &&
      (document.hidden || document.body?.classList?.contains?.('app-locked'))
    ) {
      return;
    }
    if (
      (Number(videoEl.readyState) || 0) >= 2 ||
      (Number(videoEl.currentTime) || 0) > baselineTime + 0.1
    ) {
      return;
    }
    try {
      videoEl.pause?.();
    } catch {}
    handleVideoPlaybackError({ reason: 'timeout' }).catch(() => {});
  }, timeoutMs);
  playbackWatchdogTimer.unref?.();
}

function recordDeadStreamUrl(url, originSourceId = null) {
  if (!url || typeof url !== 'string') return;
  deadUrls.add(url);
  for (const [cacheKey, entry] of sourcePoolCache.entries()) {
    if (!entry || !Array.isArray(entry.items)) continue;
    if (originSourceId && cacheKey.startsWith(`${originSourceId}:`) && consecutiveErrorSkips >= 1) {
      sourcePoolCache.delete(cacheKey);
      continue;
    }
    entry.items = entry.items.filter((it) => it?.videoUrl && !deadUrls.has(it.videoUrl));
    if (entry.items.length === 0) {
      sourcePoolCache.delete(cacheKey);
    }
  }
}

const STREAM_RESCUE_TIMEOUT_MS = 3500;
const PROXY_BLOB_SALVAGE_MAX_BYTES = 25 * 1024 * 1024;

// Attempt to salvage the exact video when its initial CDN URL expired, was cache-purged, or hotlink-blocked
async function rescueDeadVideoStream(videoItem, opts = {}) {
  if (!videoItem || typeof videoItem !== 'object') return null;
  if (videoItem._streamRescueAttempted) return null;
  if (videoItem.fromVault || videoItem.offlineBlob instanceof Blob) return null;

  const pageUrl = typeof videoItem.pageUrl === 'string' ? videoItem.pageUrl.trim() : '';
  const origUrl = typeof videoItem.originalUrl === 'string' ? videoItem.originalUrl.trim() : '';
  const itemId = String(videoItem.id || '');
  const hasOriginHint =
    Boolean(pageUrl) ||
    /redgifs\.com/i.test(`${origUrl} ${videoItem.videoUrl || ''}`) ||
    /^(?:rg|masto|pt|ep)-/i.test(itemId);

  if (!hasOriginHint) return null;
  videoItem._streamRescueAttempted = true;

  const isUsableRescueUrl = (candidate) => {
    if (!candidate || typeof candidate !== 'string') return false;
    const trimmed = candidate.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    if (deadUrls.has(trimmed)) return false;
    if (trimmed === videoItem.videoUrl || trimmed === videoItem.convertedUrl) return false;
    if (/^https?:\/\/gvideo\.eporner\.com\/[^/]+\/[^/?]+\.mp4$/i.test(trimmed)) return false;
    if (/^https?:\/\/(?:thumbs\d*|media|i)\.redgifs\.com\/[^?]+$/i.test(trimmed)) return false;
    const fmt = detectVideoFormat(trimmed, 'mp4');
    return Boolean(fmt.iphoneNative || isFormatAllowedBySettings(fmt.ext));
  };

  let rescueTimer = null;
  const timeoutPromise = new Promise((resolve) => {
    rescueTimer = setTimeout(() => resolve(null), STREAM_RESCUE_TIMEOUT_MS);
    rescueTimer.unref?.();
  });

  const workPromise = (async () => {
    // 1. RedGIFs: clear stale bearer token and mint fresh signed HD/SD stream URLs
    const rgId =
      extractRedgifsId(pageUrl || origUrl || videoItem.videoUrl || '') ||
      (itemId.startsWith('rg-') ? itemId.slice(3) : null);
    if (rgId) {
      cachedRedgifsToken = null;
      cachedRedgifsTokenExpiry = 0;
      const resolvedRg = await resolveRedgifsUrlToMp4(
        `https://www.redgifs.com/watch/${encodeURIComponent(rgId.toLowerCase())}`,
        videoItem.title || 'RedGIFs HD Clip'
      );
      if (resolvedRg) {
        const candidates = [resolvedRg.videoUrl, resolvedRg.convertedUrl].filter(isUsableRescueUrl);
        if (candidates.length > 0) {
          return {
            videoUrl: candidates[0],
            convertedUrl: candidates[1] || null,
            format: 'mp4'
          };
        }
      }
    }

    // 2. Reddit post permalink: fetch <pageUrl>.json for native HLSPlaylist.m3u8 or fresh mirror/RedGIFs link
    if (/^https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/[^/]+\/comments\//i.test(pageUrl)) {
      try {
        const cleanRedditUrl = pageUrl.split('?')[0].split('#')[0].replace(/\/+$/, '');
        const postJson = await fetchWithCorsFallback(`${cleanRedditUrl}.json?raw_json=1`, false);
        const rawPost = Array.isArray(postJson)
          ? postJson[0]?.data?.children?.[0]?.data
          : postJson?.data?.children?.[0]?.data;
        const mediaPost = rawPost?.crosspost_parent_list?.[0] || rawPost;
        if (mediaPost) {
          const destUrl = mediaPost.url_overridden_by_dest || mediaPost.url || '';
          if (/redgifs\.com/i.test(destUrl)) {
            cachedRedgifsToken = null;
            cachedRedgifsTokenExpiry = 0;
            const rgFromPost = await resolveRedgifsUrlToMp4(destUrl, videoItem.title);
            const rgCandidates = [rgFromPost?.videoUrl, rgFromPost?.convertedUrl].filter(isUsableRescueUrl);
            if (rgCandidates.length > 0) {
              return {
                videoUrl: rgCandidates[0],
                convertedUrl: rgCandidates[1] || null,
                format: 'mp4'
              };
            }
          }

          const rdCandidates = [
            mediaPost?.secure_media?.reddit_video?.hls_url,
            mediaPost?.media?.reddit_video?.hls_url,
            mediaPost?.secure_media?.reddit_video?.fallback_url,
            mediaPost?.media?.reddit_video?.fallback_url,
            mediaPost?.preview?.reddit_video_preview?.fallback_url
          ]
            .filter((u) => typeof u === 'string')
            .map((u) => u.replace(/&amp;/g, '&'))
            .filter(isUsableRescueUrl);

          if (rdCandidates.length > 0) {
            const primary = rdCandidates[0];
            return {
              videoUrl: primary,
              convertedUrl: rdCandidates[1] || null,
              format: detectVideoFormat(primary, primary.includes('.m3u8') ? 'm3u8' : 'mp4').ext
            };
          }
        }
      } catch {}
    }

    // 3. Mastodon federated status: query the origin home instance when mastodon.social purged its local cache
    const mastoMatch = pageUrl.match(
      /^(https?:\/\/[^/]+)\/(?:@[^/]+\/|users\/[^/]+\/statuses\/|statuses\/)(\d+)\b/i
    );
    if (mastoMatch?.[1] && mastoMatch?.[2]) {
      try {
        const stRes = await fetchWithTimeout(`${mastoMatch[1]}/api/v1/statuses/${mastoMatch[2]}`, 2500);
        if (stRes.ok) {
          const stData = await stRes.json();
          const atts = Array.isArray(stData?.media_attachments) ? stData.media_attachments : [];
          const mastoCandidates = [];
          for (const att of atts) {
            if (att?.type === 'video' || att?.type === 'gifv') {
              if (isUsableRescueUrl(att.url)) mastoCandidates.push(att.url);
              if (isUsableRescueUrl(att.remote_url)) mastoCandidates.push(att.remote_url);
            }
          }
          if (mastoCandidates.length > 0) {
            const primary = mastoCandidates[0];
            return {
              videoUrl: primary,
              convertedUrl: mastoCandidates[1] || null,
              format: detectVideoFormat(primary, 'mp4').ext
            };
          }
        }
      } catch {}
    }

    // 4. PeerTube federated instance: query origin video API for alternate resolution files or HLS playlist
    const ptMatch = pageUrl.match(/^(https?:\/\/[^/]+)\/(?:w|videos\/watch)\/([a-zA-Z0-9-]+)\b/i);
    if (ptMatch?.[1] && ptMatch?.[2]) {
      try {
        const ptRes = await fetchWithTimeout(
          `${ptMatch[1]}/api/v1/videos/${encodeURIComponent(ptMatch[2])}`,
          2500
        );
        if (ptRes.ok) {
          const detail = await ptRes.json();
          const files = [
            ...(Array.isArray(detail?.files) ? detail.files : []),
            ...(Array.isArray(detail?.streamingPlaylists?.[0]?.files) ? detail.streamingPlaylists[0].files : [])
          ];
          const ptCandidates = [
            ...files.map((f) => f?.fileDownloadUrl || f?.fileUrl),
            detail?.streamingPlaylists?.[0]?.playlistUrl
          ].filter(isUsableRescueUrl);
          if (ptCandidates.length > 0) {
            const primary = ptCandidates[0];
            return {
              videoUrl: primary,
              convertedUrl: ptCandidates[1] || null,
              format: detectVideoFormat(primary, primary.includes('.m3u8') ? 'm3u8' : 'mp4').ext
            };
          }
        }
      } catch {}
    }

    // 5. Archive.org item metadata: switch to an alternate non-private MP4/MOV derivative in the same item
    const iaMatch =
      pageUrl.match(/archive\.org\/details\/([^/?#]+)/i) ||
      String(videoItem.videoUrl || '').match(/archive\.org\/download\/([^/?#]+)\//i);
    if (iaMatch?.[1] && pageUrl) {
      try {
        const iaId = iaMatch[1];
        const metaRes = await fetchWithTimeout(
          `https://archive.org/metadata/${encodeURIComponent(iaId)}`,
          2500
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          const files = Array.isArray(meta?.files) ? meta.files : [];
          const iaCandidates = files
            .filter((f) => typeof f?.name === 'string' && /\.(?:mp4|m4v|mov)$/i.test(f.name) && !f.private)
            .map(
              (f) =>
                `https://archive.org/download/${encodeURIComponent(iaId)}/${encodeArchiveFilePath(f.name)}`
            )
            .filter(isUsableRescueUrl);
          if (iaCandidates.length > 0) {
            return {
              videoUrl: iaCandidates[0],
              convertedUrl: iaCandidates[1] || null,
              format: detectVideoFormat(iaCandidates[0], 'mp4').ext
            };
          }
        }
      } catch {}
    }

    // 6. Tube / Open-Web watch or embed page re-scrape (mints fresh signed CDN URLs)
    const epIdMatch =
      itemId.match(/^ep-([a-zA-Z0-9]+)$/i) ||
      pageUrl.match(/eporner\.com\/(?:video-|hd-porn\/|embed\/)([a-zA-Z0-9]+)/i);
    const scrapeTargets = [];
    if (epIdMatch?.[1]) {
      scrapeTargets.push(`https://www.eporner.com/embed/${epIdMatch[1]}/`);
    }
    if (
      pageUrl &&
      /^https?:\/\//i.test(pageUrl) &&
      !DIRECT_VIDEO_URL_REGEX.test(pageUrl) &&
      !/reddit\.com\/r\//i.test(pageUrl) &&
      !/redgifs\.com\//i.test(pageUrl) &&
      !scrapeTargets.includes(pageUrl)
    ) {
      scrapeTargets.push(pageUrl);
    }

    for (const target of scrapeTargets) {
      try {
        const html = await fetchWithCorsFallback(target, true);
        const extracted = extractVideoUrlsFromHtml(html, target).filter(isUsableRescueUrl);
        if (extracted.length > 0) {
          const mp4First = [
            ...extracted.filter((u) => /\.mp4(\?|$)/i.test(u)),
            ...extracted.filter((u) => !/\.mp4(\?|$)/i.test(u))
          ];
          const primary = mp4First[0];
          return {
            videoUrl: primary,
            convertedUrl: mp4First[1] || null,
            format: detectVideoFormat(primary, 'mp4').ext
          };
        }
      } catch {}
    }

    // 7. Hotlink / Referer block bypass: if <video> failed fast (not timeout), pull bytes via CORS proxy into a local blob: URL
    const hotlinkTarget = videoItem.videoUrl;
    if (
      opts?.reason !== 'timeout' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function' &&
      typeof hotlinkTarget === 'string' &&
      /^https?:\/\//i.test(hotlinkTarget) &&
      !/^https?:\/\/(?:thumbs\d*|media|i)\.redgifs\.com\/[^?]+$/i.test(hotlinkTarget) &&
      !/^https?:\/\/gvideo\.eporner\.com\//i.test(hotlinkTarget)
    ) {
      const proxyController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const proxyTimer = proxyController ? setTimeout(() => proxyController.abort(), 2500) : null;
      proxyTimer?.unref?.();
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(hotlinkTarget)}`;
        const pRes = proxyController
          ? await fetch(proxyUrl, { signal: proxyController.signal })
          : await fetch(proxyUrl);
        if (pRes && pRes.ok) {
          const ct = String(pRes.headers?.get?.('content-type') || '').toLowerCase();
          const len = Number(pRes.headers?.get?.('content-length')) || 0;
          if (
            !ct.includes('text/html') &&
            !ct.includes('application/json') &&
            (ct.startsWith('video/') || ct === 'application/octet-stream' || /\.mp4(\?|$)/i.test(hotlinkTarget)) &&
            (len === 0 || len <= PROXY_BLOB_SALVAGE_MAX_BYTES) &&
            typeof pRes.blob === 'function'
          ) {
            const rawBlob = await pRes.blob();
            if (rawBlob && rawBlob.size > 1024 && rawBlob.size <= PROXY_BLOB_SALVAGE_MAX_BYTES) {
              const typedBlob = rawBlob.type?.startsWith('video/')
                ? rawBlob
                : new Blob([rawBlob], { type: 'video/mp4' });
              const blobUrl = URL.createObjectURL(typedBlob);
              if (blobUrl) {
                return { blobUrl };
              }
            }
          }
        }
      } catch {} finally {
        if (proxyTimer) clearTimeout(proxyTimer);
      }
    }

    return null;
  })();

  try {
    return await Promise.race([workPromise, timeoutPromise]);
  } finally {
    if (rescueTimer) clearTimeout(rescueTimer);
  }
}

// Recover automatically when a pulled video fails to decode, hangs, or 403/404s on iOS Safari
async function handleVideoPlaybackError(opts = {}) {
  if (isHandlingPlaybackError) return false;
  const videoEl = typeof document !== 'undefined' ? document.getElementById('mainVideo') : null;
  const current = videoQueue[currentIndex];
  if (!current || !videoEl) return false;

  isHandlingPlaybackError = true;
  clearPlaybackStartupWatchdog();

  try {
    // 0. If this video has a cached offline Blob in IndexedDB Vault, rehydrate and switch to blob: immediately
    if (!(current.offlineBlob instanceof Blob)) {
      const rehydrated = await rehydrateQueueOfflineBlobsFromVault();
      if (rehydrated && current.offlineBlob instanceof Blob) {
        consecutiveErrorSkips = 0;
        updatePlayerUI();
        return true;
      }
    }

    // 1. If a server-transcoded or alternate .mp4 stream URL is available, try it immediately
    if (
      current.convertedUrl &&
      !deadUrls.has(current.convertedUrl) &&
      videoEl.dataset?.triedConvertedUrl !== 'true' &&
      videoEl.src !== current.convertedUrl
    ) {
      if (current.videoUrl) recordDeadStreamUrl(current.videoUrl);
      if (videoEl.dataset) videoEl.dataset.triedConvertedUrl = 'true';
      videoEl.src = current.convertedUrl;
      videoEl.load?.();
      armPlaybackStartupWatchdog(videoEl, current, current.convertedUrl);
      if (settings.autoPlay) {
        videoEl.play?.()?.catch?.(() => {});
      }
      return true;
    }

    // 2. Try on-device auto-conversion ONLY when the format is non-native (e.g. .webm/.mkv/.avi) and didn't time out
    const ext = (current.format || detectVideoFormat(current.videoUrl).ext).toLowerCase();
    const fmtInfo = VIDEO_FORMAT_CATALOG[ext] || VIDEO_FORMAT_CATALOG.mp4;
    if (
      settings.autoConvert &&
      !fmtInfo.iphoneNative &&
      opts?.reason !== 'timeout' &&
      !current.convertedBlobUrl &&
      videoEl.dataset?.autoConvertAttempted !== 'true'
    ) {
      if (videoEl.dataset) videoEl.dataset.autoConvertAttempted = 'true';
      showToast(`Auto-converting .${(current.format || 'video').toUpperCase()} for iPhone playback...`);
      const convertedOk = await convertCurrentVideoForPlayer(current);
      if (convertedOk) {
        return true;
      }
    }

    // Mark the current dead URL(s) before attempting Live Stream Rescue so rescue picks a fresh stream
    if (current.videoUrl) recordDeadStreamUrl(current.videoUrl);
    if (current.convertedUrl) recordDeadStreamUrl(current.convertedUrl);

    // 2.5. Live Stream Rescue (~3.5s cap): re-mint fresh signed URLs from pageUrl/API or salvage hotlink-blocked bytes
    if (!current._streamRescueAttempted && videoEl.dataset?.streamRescueAttempted !== 'true') {
      if (videoEl.dataset) videoEl.dataset.streamRescueAttempted = 'true';
      const rescued = await rescueDeadVideoStream(current, opts);
      if (rescued) {
        if (videoQueue[currentIndex] !== current) {
          if (rescued.blobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            try {
              URL.revokeObjectURL(rescued.blobUrl);
            } catch {}
          }
          return true;
        }
        if (rescued.blobUrl) {
          if (
            current.convertedBlobUrl &&
            current.convertedBlobUrl !== rescued.blobUrl &&
            typeof URL !== 'undefined' &&
            typeof URL.revokeObjectURL === 'function'
          ) {
            try {
              URL.revokeObjectURL(current.convertedBlobUrl);
            } catch {}
          }
          current.convertedBlobUrl = rescued.blobUrl;
          current.isAutoConverted = true;
          clearPlaybackStartupWatchdog();
          videoEl.src = rescued.blobUrl;
          videoEl.load?.();
          if (settings.autoPlay) {
            videoEl.play?.()?.catch?.((err) => {
              if (err?.name === 'NotAllowedError') clearPlaybackStartupWatchdog();
            });
          }
          showToast('Recovered blocked stream — playing now!');
          return true;
        }
        if (rescued.videoUrl) {
          current.videoUrl = rescued.videoUrl;
          current.convertedUrl = rescued.convertedUrl || null;
          if (rescued.format) {
            current.format = rescued.format;
          }
          if (videoEl.dataset) {
            videoEl.dataset.triedConvertedUrl = rescued.convertedUrl ? 'false' : 'true';
          }
          videoEl.src = rescued.videoUrl;
          videoEl.load?.();
          armPlaybackStartupWatchdog(videoEl, current, rescued.videoUrl);
          if (settings.autoPlay) {
            videoEl.play?.()?.catch?.((err) => {
              if (err?.name === 'NotAllowedError') clearPlaybackStartupWatchdog();
            });
          }
          savePlaybackState();
          showToast('Refreshed stream link — playing now!');
          return true;
        }
      }
    }

    // Blacklist this dead stream URL (and evict from sourcePoolCache) so we never loop on it again
    if (current.videoUrl) recordDeadStreamUrl(current.videoUrl, current.originSourceId);
    if (current.convertedUrl) recordDeadStreamUrl(current.convertedUrl, current.originSourceId);

    // If the user navigated to a different video while recovery was in flight,
    // remove only the failed video (`current`) and preserve the user's active video
    if (videoQueue[currentIndex] !== current) {
      const staleIdx = videoQueue.indexOf(current);
      if (staleIdx >= 0) {
        const removedStale = videoQueue.splice(staleIdx, 1);
        revokeVideoItemBlobUrls(removedStale);
        if (staleIdx < currentIndex) {
          currentIndex = Math.max(0, currentIndex - 1);
        }
        updatePlayerUI();
      }
      return true;
    }

    // 3. Stream is dead/restricted/unplayable: purge it (plus any other blacklisted items) and advance
    if (consecutiveErrorSkips >= 4) {
      consecutiveErrorSkips = 0;
      showToast('Stream unavailable on source server — tap Shuffle for another video.');
      return false;
    }

    consecutiveErrorSkips++;
    continuousSourceCursor++;
    showToast('Stream unavailable — pulling a working video...');
    const removed = videoQueue.splice(currentIndex, 1);
    revokeVideoItemBlobUrls(removed);

    // Also purge any upcoming queued items already known to be dead
    if (videoQueue.length > currentIndex) {
      const head = videoQueue.slice(0, currentIndex);
      const tail = videoQueue.slice(currentIndex);
      const cleanTail = [];
      const deadTail = [];
      for (const item of tail) {
        if (item?.videoUrl && deadUrls.has(item.videoUrl) && !item.fromVault && !(item.offlineBlob instanceof Blob)) {
          deadTail.push(item);
        } else {
          cleanTail.push(item);
        }
      }
      if (deadTail.length > 0) {
        revokeVideoItemBlobUrls(deadTail);
        videoQueue = [...head, ...cleanTail];
      }
    }

    if (videoQueue.length > 0) {
      if (currentIndex >= videoQueue.length) {
        currentIndex = videoQueue.length - 1;
      }
      updatePlayerUI();
      return true;
    }

    // Clear stale broken frame before pulling a fresh clip
    try {
      videoEl.pause?.();
      if (typeof videoEl.removeAttribute === 'function') {
        videoEl.removeAttribute('src');
      } else {
        videoEl.src = '';
      }
      videoEl.load?.();
    } catch {}

    currentIndex = -1;
    await pullRandomVideos(1);
    return true;
  } finally {
    isHandlingPlaybackError = false;
  }
}

async function pullRandomVideos(count = 1, customKeyword = null) {
  const pullGen = modeGeneration;
  const pullSourceGen = sourceSelectionGeneration;
  const pullAllowNsfw = Boolean(settings.allowNsfw);

  if (typeof document !== 'undefined') {
    const mainEl = document.querySelector?.('.app-main');
    if (mainEl && typeof mainEl.scrollTop === 'number') {
      mainEl.scrollTop = 0;
    }
  }
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
        isNsfw: pullAllowNsfw
      });
    } else {
      const activeSources = getEffectiveActiveSources();
      if (activeSources.length === 0) {
        showToast('Enable at least one source in the Sources tab!');
        setPlayerLoading(false);
        return;
      }

      const MAX_FOREGROUND_SOURCE_BATCH = 6;
      const totalActive = activeSources.length;
      const sourceBuckets = [];
      let inspectedCount = 0;
      let waveCount = 0;

      while (inspectedCount < totalActive && waveCount < 3) {
        if (
          pullGen !== modeGeneration ||
          pullSourceGen !== sourceSelectionGeneration ||
          Boolean(settings.allowNsfw) !== pullAllowNsfw
        ) {
          return;
        }
        const batchSize = Math.min(MAX_FOREGROUND_SOURCE_BATCH, totalActive - inspectedCount);
        const waveSources = [];
        for (let i = 0; i < batchSize; i++) {
          const idx = (continuousSourceCursor + i) % totalActive;
          waveSources.push(activeSources[idx]);
        }
        continuousSourceCursor = (continuousSourceCursor + batchSize) % totalActive;
        inspectedCount += batchSize;
        waveCount++;

        const shuffledWave = shuffleArray(waveSources);
        const results = await Promise.allSettled(
          shuffledWave.map((src) => pullFromSource(src))
        );

        if (
          pullGen !== modeGeneration ||
          pullSourceGen !== sourceSelectionGeneration ||
          Boolean(settings.allowNsfw) !== pullAllowNsfw
        ) {
          return;
        }

        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length > 0) {
            sourceBuckets.push(r.value);
          }
        }

        const candidatePool = interleaveVideoBuckets(sourceBuckets);
        const unseenInWave = candidatePool.filter(
          (item) => item?.videoUrl && !deadUrls.has(item.videoUrl) && !seenUrls.has(item.videoUrl)
        );
        if (unseenInWave.length >= Math.max(1, count)) {
          break;
        }
      }

      pool = interleaveVideoBuckets(sourceBuckets).filter(
        (item) => item?.videoUrl && !deadUrls.has(item.videoUrl)
      );

      if (pool.length === 0 && pullAllowNsfw) {
        const activeTubeSource = activeSources.find((s) => isFreeTubePresetSource(s));
        if (activeTubeSource) {
          try {
            const fallbackSeed = activeTubeSource.value || 'popular hd';
            const fbItems = await fetchDirectEpornerVideos(
              fallbackSeed,
              6,
              activeTubeSource.label || 'Free Tube 18+',
              null,
              true
            );
            pool = fbItems
              .filter((item) => item?.videoUrl && !deadUrls.has(item.videoUrl))
              .map((item) =>
                activeTubeSource.id ? { ...item, originSourceId: activeTubeSource.id } : item
              );
          } catch {}
        }
      }
    }

    if (
      pullGen !== modeGeneration ||
      (!customKeyword && pullSourceGen !== sourceSelectionGeneration) ||
      Boolean(settings.allowNsfw) !== pullAllowNsfw
    ) {
      return;
    }

    let fresh = pool.filter(
      (item) => item?.videoUrl && !deadUrls.has(item.videoUrl) && !seenUrls.has(item.videoUrl)
    );
    if (fresh.length === 0 && pool.length > 0) {
      const currentPlayingUrl = videoQueue[currentIndex]?.videoUrl;
      seenUrls.clear();
      if (currentPlayingUrl && pool.length > 1) {
        seenUrls.add(currentPlayingUrl);
        fresh = pool.filter(
          (item) => item?.videoUrl && !deadUrls.has(item.videoUrl) && !seenUrls.has(item.videoUrl)
        );
      }
      if (fresh.length === 0) {
        fresh = pool.filter((item) => item?.videoUrl && !deadUrls.has(item.videoUrl));
      }
    }

    if (fresh.length === 0) {
      if (customKeyword || settings.allowNsfw) {
        showToast(
          customKeyword
            ? `No matching videos found for "${customKeyword}". Try another keyword!`
            : 'No 18+ videos returned right now. Try another 18+ source or keyword!'
        );
        setPlayerLoading(false);
        return;
      }
      fresh = [...FALLBACK_VIDEOS];
    }

    const selected = shuffleArray(fresh).slice(0, count);
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
    if (pullGen !== modeGeneration || Boolean(settings.allowNsfw) !== pullAllowNsfw) {
      return;
    }
    if (!settings.allowNsfw) {
      const fallbackItem = FALLBACK_VIDEOS[Math.floor(Math.random() * FALLBACK_VIDEOS.length)];
      videoQueue.push(fallbackItem);
      currentIndex = videoQueue.length - 1;
      updatePlayerUI();
    } else {
      showToast('Could not reach 18+ video feeds right now. Try again!');
    }
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

  beginDownloadStatusOp(statusBox);
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
    finishDownloadStatusOp(statusBox, progressBar, 1200);
  }
}

// ==========================================
// RENDER SOURCES, SEARCH RESULTS & OFFLINE VAULT
// ==========================================

function renderSourcesList() {
  const container = document.getElementById('sourcesList');
  if (!container) return;

  const visibleSources = settings.allowNsfw
    ? sources.filter((s) => Boolean(s.isNsfw))
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

  if (
    !settings.allowNsfw &&
    (settings.vaultFilter === 'nsfw' || settings.vaultFilter === 'nsfw_favorites')
  ) {
    settings.vaultFilter = 'all';
  } else if (settings.allowNsfw && settings.vaultFilter === 'sfw') {
    settings.vaultFilter = 'all';
  }

  if (hiddenNoticeEl) {
    hiddenNoticeEl.classList.toggle('hidden', !(hiddenNsfwCount > 0 && !settings.allowNsfw));
  }
  if (vaultFilterEl) {
    vaultFilterEl.classList.toggle('hidden', !settings.allowNsfw);
    vaultFilterEl.value = settings.vaultFilter || 'all';
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
      const isCachingNow =
        activeVaultCacheIds.has(item.id) ||
        Boolean(item.videoUrl && activeVaultCacheIds.has(item.videoUrl));
      const sizeMb = item.offlineSize ? `${(item.offlineSize / (1024 * 1024)).toFixed(1)} MB` : '';
      const offlineBadgeHtml = isOfflineReady
        ? `<span class="offline-badge">✅ Offline ${sizeMb}</span>`
        : `<button class="btn-inline-convert" data-action="cache-vault-item" data-id="${escapeHtml(item.id)}"${isCachingNow ? ' disabled' : ''}>${isCachingNow ? '⏳ Caching...' : '☁️ Cache Offline'}</button>`;
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
  const mainEl = document.querySelector?.('.app-main');
  if (mainEl && typeof mainEl.scrollTop === 'number') {
    mainEl.scrollTop = 0;
  }
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
    const scanGen = modeGeneration;
    const scanAllowNsfw = Boolean(settings.allowNsfw);
    scanUrlForVideos(scanTarget, 'Safari Bookmarklet')
      .then((found) => {
        if (scanAllowNsfw && (!settings.allowNsfw || scanGen !== modeGeneration)) {
          return;
        }
        if (scanAllowNsfw || settings.allowNsfw) {
          found.forEach((item) => {
            if (item) item.isNsfw = true;
          });
        }
        renderSearchResults(found);
        showToast(`Found ${found.length} video(s) from Safari page!`);
      })
      .catch(() => {
        if (scanAllowNsfw && (!settings.allowNsfw || scanGen !== modeGeneration)) {
          return;
        }
        renderSearchResults([]);
        showToast('Could not scan that URL due to site security restrictions.');
      });
  } else if (queryTarget) {
    pullRandomVideos(1, queryTarget);
  }

  return Boolean(scanTarget || queryTarget);
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
  loadState();

  // Initialize Full-Screen App Passcode Gate
  let alreadyUnlockedInSession = false;
  try {
    alreadyUnlockedInSession =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(APP_UNLOCK_SESSION_KEY) === '1';
  } catch {}
  if (alreadyUnlockedInSession) {
    unlockAppGate();
  } else {
    lockAppGate();
  }

  const appLockForm = document.getElementById('appLockForm');
  const appLockPinInput = document.getElementById('appLockPinInput');
  const appLockError = document.getElementById('appLockError');
  const appLockBiometricBtn = document.getElementById('appLockBiometricBtn');

  appLockPinInput?.addEventListener('input', () => {
    appLockError?.classList.add('hidden');
    const val = String(appLockPinInput.value || '').trim();
    if (val.length === 4 && verifyMasterAppPasscode(val)) {
      unlockAppGate();
      showToast('🔓 ReelVault Unlocked');
    }
  });

  appLockForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = String(appLockPinInput?.value || '').trim();
    if (verifyMasterAppPasscode(val)) {
      unlockAppGate();
      showToast('🔓 ReelVault Unlocked');
    } else {
      appLockError?.classList.remove('hidden');
      if (appLockPinInput) {
        appLockPinInput.value = '';
        appLockPinInput.focus?.();
      }
    }
  });

  appLockBiometricBtn?.addEventListener('click', async () => {
    try {
      const verified = await authenticateNsfwBiometric();
      if (verified) {
        unlockAppGate();
        showToast('🔓 Unlocked with FaceID / TouchID');
      } else {
        showToast('FaceID / TouchID verification failed.');
      }
    } catch {
      showToast('FaceID / TouchID verification cancelled.');
    }
  });

  document.getElementById('lockAppBtn')?.addEventListener('click', () => {
    lockAppGate();
    showToast('🔒 ReelVault Locked');
  });

  if (settings.allowNsfw) {
    unlockAdultPresetSources({ respectDeleted: true });
  }
  updateHeaderSummary();
  renderSourcesList();
  await renderVaultList();
  const launchedDeepLink = initBookmarkletAndUrlParams();

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
  if (!launchedDeepLink && videoQueue.length === 0 && settings.resumePlayback) {
    if (restorePlaybackState()) {
      await rehydrateQueueOfflineBlobsFromVault();
    }
    if (!isAppUnlocked) {
      try {
        document.getElementById('mainVideo')?.pause?.();
      } catch {}
    }
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
    settings.nsfwMode = 'strict';
    sourcePoolCache.clear();
    saveSettings();
    syncAgeGateUI();
    showToast('🔥 18+ Only Mode Active (All safe video options removed)');
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
    sourcePoolCache.clear();
    saveSettings();
  });

  tubeQualitySelect?.addEventListener('change', () => {
    settings.tubeQualityFilter = tubeQualitySelect.value || 'all';
    sourcePoolCache.clear();
    saveSettings();
  });

  const mainVideoEl = document.getElementById('mainVideo');

  // Track playback position so user can pick up right where they left off & sync Reels seeker
  mainVideoEl?.addEventListener('timeupdate', () => {
    if ((Number(mainVideoEl.readyState) || 0) >= 2 && (Number(mainVideoEl.currentTime) || 0) > 0.1) {
      clearPlaybackStartupWatchdog();
      consecutiveErrorSkips = 0;
    }
    savePlaybackState();
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('loadedmetadata', () => {
    consecutiveErrorSkips = 0;
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('loadeddata', () => {
    clearPlaybackStartupWatchdog();
    consecutiveErrorSkips = 0;
  });
  mainVideoEl?.addEventListener('canplay', () => {
    clearPlaybackStartupWatchdog();
    consecutiveErrorSkips = 0;
  });
  mainVideoEl?.addEventListener('playing', () => {
    clearPlaybackStartupWatchdog();
    consecutiveErrorSkips = 0;
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('durationchange', () => {
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('play', () => {
    consecutiveErrorSkips = 0;
    const activeItem = videoQueue[currentIndex];
    const activeSrc = mainVideoEl.currentSrc || mainVideoEl.src || '';
    if (
      activeItem &&
      (Number(mainVideoEl.readyState) || 0) < 2 &&
      !(activeItem.offlineBlob instanceof Blob) &&
      !/^blob:/i.test(activeSrc)
    ) {
      armPlaybackStartupWatchdog(mainVideoEl, activeItem, activeSrc);
    }
    updateReelsSeekerUI();
  });
  mainVideoEl?.addEventListener('pause', () => {
    if (!mainVideoEl.ended && !mainVideoEl.error) {
      clearPlaybackStartupWatchdog();
    }
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

  // Auto-recover on playback error: try derivative URL -> on-device MP4 convert -> skip dead stream
  mainVideoEl?.addEventListener('error', async () => {
    await handleVideoPlaybackError();
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
    const useOpenWeb = document.getElementById('engOpenWeb')?.checked;
    const useRedgifs = document.getElementById('engRedgifs')?.checked;

    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
      listEl.innerHTML = `<p class="muted-center">Searching ${settings.allowNsfw ? '18+ tube sites &amp; open web' : 'open video networks, tube sites &amp; public web'} for "${escapeHtml(query)}"...</p>`;
    }

    const tasks = [];
    if (/^https?:\/\//i.test(query)) {
      tasks.push(scanUrlForVideos(query, 'Scanned Link'));
    } else if (settings.allowNsfw) {
      // 18+ Only Mode: exclude safe engines (Archive.org, Prelinger, Wikimedia, NASA, Fediverse)
      if (useRedgifs !== false) tasks.push(searchRedgifsVideos(query, 6));
      if (useTubeSites !== false) tasks.push(searchFreeTubeSites(query, 6));
      if (useOpenWeb !== false || useTubeSites !== false) tasks.push(searchOpenWebVideos(query, 6));
      if (useReddit !== false) tasks.push(searchRedditVideosByKeyword(query));
      if (usePeerTube) tasks.push(searchPeerTubeVideos(query, 6));
    } else {
      if (useArchive) tasks.push(searchInternetArchive(query, 6));
      if (usePrelinger) tasks.push(searchPrelingerArchives(query, 5));
      if (useWiki) tasks.push(searchWikimediaVideos(query, 8));
      if (useReddit) tasks.push(searchRedditVideosByKeyword(query));
      if (usePeerTube) tasks.push(searchPeerTubeVideos(query, 6));
      if (useFediverse) tasks.push(searchFediverseVideos(query));
      if (useNasa) tasks.push(searchNasaVideos(query, 6));
      if (useTubeSites) tasks.push(searchFreeTubeSites(query, 6));
      if (useOpenWeb || useTubeSites) tasks.push(searchOpenWebVideos(query, 6));
    }

    const settled = await Promise.allSettled(tasks);
    const combined = [];
    const seenUrlsInSearch = new Set();
    for (const r of settled) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        for (const item of r.value) {
          if (item?.videoUrl && !seenUrlsInSearch.has(item.videoUrl)) {
            if (settings.allowNsfw) {
              item.isNsfw = true;
            }
            seenUrlsInSearch.add(item.videoUrl);
            combined.push(item);
          }
        }
      }
    }

    const filtered = filterAndSortTubeResults(combined);
    renderSearchResults(filtered.length > 0 ? filtered : combined);
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

    const scanGen = modeGeneration;
    const scanAllowNsfw = Boolean(settings.allowNsfw);
    try {
      const found = await scanUrlForVideos(urlInput, 'Scanned Page');
      if (scanAllowNsfw && (!settings.allowNsfw || scanGen !== modeGeneration)) {
        return;
      }
      if (scanAllowNsfw || settings.allowNsfw) {
        found.forEach((item) => {
          if (item) item.isNsfw = true;
        });
      }
      renderSearchResults(found);
      if (found.length > 0) {
        showToast(`Found ${found.length} video(s) on page!`);
      }
    } catch {
      if (scanAllowNsfw && (!settings.allowNsfw || scanGen !== modeGeneration)) {
        return;
      }
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
    const markNsfw = Boolean(settings.allowNsfw || document.getElementById('newSourceNsfwCheck')?.checked);

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
    const activeSeg = document.querySelector('.segmented-control .segment.active');
    const activeRadio = activeSeg?.querySelector?.('input[type="radio"]');
    if (activeRadio) {
      activeRadio.checked = true;
    }
    const nsfwCheckEl = document.getElementById('newSourceNsfwCheck');
    if (nsfwCheckEl) nsfwCheckEl.checked = Boolean(settings.allowNsfw);
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

  document.getElementById('disableAllDirectoryBtn')?.addEventListener('click', () => {
    const count = disableAllDirectorySources();
    showToast(
      count > 0
        ? `Disabled ${count} 18+ directory sources`
        : 'All 18+ directory sources are already disabled'
    );
  });

  document.getElementById('adultDirectorySearchInput')?.addEventListener('input', (e) => {
    renderAdultDirectory(e.target.value || '');
  });

  document.getElementById('adultDirectoryList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'enable-dir-category') {
      const cat = btn.dataset.category;
      if (!cat) return;
      const count = enableDirectoryCategory(cat);
      showToast(
        count > 0
          ? `🔞 Enabled ${count} source(s) in "${cat}"!`
          : `All sources in "${cat}" are already active!`
      );
      return;
    }

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
      } else if (entry.type === 'url') {
        setPlayerLoading(true, `Scanning ${entry.label}...`);
        try {
          const items = await scanUrlForVideos(entry.value, entry.label || 'FullTaboo.tv');
          if (items.length > 0) {
            items.forEach((i) => {
              i.isNsfw = true;
            });
            const pick = items[Math.floor(Math.random() * items.length)];
            videoQueue.push(pick);
            currentIndex = videoQueue.length - 1;
            updatePlayerUI();
            showToast(`🔞 Loaded clip from ${entry.label}!`);
          } else {
            await pullRandomVideos(1, entry.label);
          }
        } catch {
          await pullRandomVideos(1, entry.label);
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
        syncQueueAfterSourceChange();
      }
      return;
    }

    const delBtn = e.target.closest('button[data-action="delete-source"]');
    if (delBtn) {
      const targetId = delBtn.dataset.id;
      if (targetId) {
        if (!Array.isArray(settings.deletedSourceIds)) {
          settings.deletedSourceIds = [];
        }
        if (!settings.deletedSourceIds.includes(targetId)) {
          settings.deletedSourceIds.push(targetId);
          saveSettings();
        }
      }
      sources = sources.filter((s) => s.id !== targetId);
      saveSources();
      syncQueueAfterSourceChange();
      renderSourcesList();
      showToast('Source removed');
    }
  });

  document.getElementById('enableAllSourcesBtn')?.addEventListener('click', () => {
    sources.forEach((s) => {
      if (Boolean(s.isNsfw) === Boolean(settings.allowNsfw)) {
        s.enabled = true;
      }
    });
    saveSources();
    syncQueueAfterSourceChange();
    renderSourcesList();
  });

  document.getElementById('disableAllSourcesBtn')?.addEventListener('click', () => {
    sources.forEach((s) => {
      if (Boolean(s.isNsfw) === Boolean(settings.allowNsfw)) {
        s.enabled = false;
      }
    });
    saveSources();
    syncQueueAfterSourceChange();
    renderSourcesList();
  });

  // Settings Controls
  formatModeSelect?.addEventListener('change', () => {
    settings.formatMode = formatModeSelect.value || 'all';
    sourcePoolCache.clear();
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
      settings.nsfwMode = 'strict';
      if (settings.allowNsfw) {
        setAdultContentEnabled(true);
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
    const hasExistingLock = Boolean(settings.nsfwPin || settings.nsfwBiometricId);
    if (hasExistingLock && !settings.allowNsfw) {
      showToast('🔒 Unlock 18+ Mode with your current PIN first to change PIN');
      openAgeGateModal();
      return;
    }
    const ok = setNsfwPin(pinInput?.value);
    if (ok) {
      if (pinInput) pinInput.value = '';
      showToast('🔒 Saved 4-digit PIN lock for 18+ mode & Vault!');
    } else {
      showToast('Please enter a 4-digit numeric PIN (e.g. 1234)');
    }
  });

  document.getElementById('clearNsfwPinBtn')?.addEventListener('click', async () => {
    const pinInput = document.getElementById('nsfwPinInput');
    const hasExistingLock = Boolean(settings.nsfwPin || settings.nsfwBiometricId);
    if (hasExistingLock && !settings.allowNsfw) {
      const enteredPin = String(pinInput?.value || '').trim();
      if (settings.nsfwPin) {
        if (!enteredPin || !verifyNsfwPin(enteredPin)) {
          showToast('🔒 Enter your current 4-digit PIN (or unlock 18+ Mode first) to clear lock');
          openAgeGateModal();
          return;
        }
      } else if (settings.nsfwBiometricId) {
        let verified = false;
        try {
          verified = await authenticateNsfwBiometric();
        } catch {
          verified = false;
        }
        if (!verified) {
          showToast('🔒 Verify FaceID / TouchID first to clear lock');
          openAgeGateModal();
          return;
        }
      }
    }
    clearNsfwPin();
    if (pinInput) pinInput.value = '';
    showToast('🔓 Cleared PIN & FaceID lock');
  });

  document.getElementById('setupBiometricBtn')?.addEventListener('click', async () => {
    const hasExistingLock = Boolean(settings.nsfwPin || settings.nsfwBiometricId);
    if (hasExistingLock && !settings.allowNsfw) {
      showToast('🔒 Unlock 18+ Mode with your current PIN first');
      openAgeGateModal();
      return;
    }
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

  document.getElementById('confirmAgeGateBtn')?.addEventListener('click', async () => {
    if (settings.nsfwPin) {
      const enteredPin = String(document.getElementById('ageGatePinInput')?.value || '').trim();
      if (!verifyNsfwPin(enteredPin)) {
        if (!enteredPin && settings.nsfwBiometricId) {
          try {
            const bioOk = await authenticateNsfwBiometric();
            if (bioOk) {
              setAdultContentEnabled(true);
              closeAgeGateModal();
              return;
            }
          } catch {}
        }
        document.getElementById('ageGatePinError')?.classList.remove('hidden');
        return;
      }
    } else if (settings.nsfwBiometricId) {
      try {
        const verified = await authenticateNsfwBiometric();
        if (!verified) {
          showToast('FaceID / TouchID verification required to unlock 18+ mode.');
          return;
        }
      } catch {
        showToast('FaceID / TouchID verification cancelled.');
        return;
      }
    }
    setAdultContentEnabled(true);
    closeAgeGateModal();
  });

  document.getElementById('ageGateBiometricBtn')?.addEventListener('click', async () => {
    try {
      const verified = await authenticateNsfwBiometric();
      if (verified) {
        setAdultContentEnabled(true);
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
    modeGeneration++;
    const preservedPin = settings.nsfwPin || '';
    const preservedBiometricId = settings.nsfwBiometricId || '';
    sources = structuredClone(DEFAULT_SOURCES);
    Object.assign(settings, {
      allowNsfw: false,
      nsfwMode: 'safe',
      autoMuteNsfw: true,
      resumePlayback: true,
      discreetFilenames: true,
      nsfwPin: preservedPin,
      nsfwBiometricId: preservedBiometricId,
      tubeDurationFilter: 'all',
      tubeQualityFilter: 'all',
      vaultFilter: 'all',
      playbackSpeed: 1,
      autoPlay: true,
      formatMode: 'all',
      autoConvert: true,
      autoAdvance: true,
      prebuffer: true,
      offlineVaultCache: true,
      deletedSourceIds: []
    });
    if (nsfwToggle) nsfwToggle.checked = false;
    if (nsfwModeSelect) nsfwModeSelect.value = 'safe';
    if (autoMuteNsfwToggle) autoMuteNsfwToggle.checked = true;
    if (resumePlaybackToggle) resumePlaybackToggle.checked = true;
    if (discreetFilenamesToggle) discreetFilenamesToggle.checked = true;
    if (tubeDurationSelect) tubeDurationSelect.value = 'all';
    if (tubeQualitySelect) tubeQualitySelect.value = 'all';
    if (vaultFilterSelect) vaultFilterSelect.value = 'all';
    if (autoPlayToggle) autoPlayToggle.checked = true;
    if (formatModeSelect) formatModeSelect.value = 'all';
    if (autoConvertToggle) autoConvertToggle.checked = true;
    if (autoAdvanceToggle) autoAdvanceToggle.checked = true;
    if (prebufferToggle) prebufferToggle.checked = true;
    if (offlineVaultToggle) offlineVaultToggle.checked = true;
    const speedSel = document.getElementById('playbackSpeedSelect');
    if (speedSel) speedSel.value = '1';
    revokeVideoItemBlobUrls(videoQueue);
    videoQueue = [];
    currentIndex = -1;
    playbackPositions = {};
    lastSearchResults = [];
    seenUrls.clear();
    sourcePoolCache.clear();
    try {
      localStorage.removeItem(STORAGE_KEYS.PLAYBACK_STATE);
    } catch {}
    saveSources();
    saveSettings();
    syncAgeGateUI();
    renderSourcesList();
    if (document.getElementById('searchResultsList')) {
      renderSearchResults([]);
    }
    if (document.getElementById('vaultList')) {
      renderVaultList();
    }
    setPlayerLoading(false);
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
      videoQueue.push({ ...item, fromVault: true });
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
    searchInternetArchive,
    searchWikimediaVideos,
    extractRedgifsId,
    resolveRedgifsUrlToMp4,
    getSubredditNicheQuery,
    fetchDirectEpornerVideos,
    searchRedgifsVideos,
    filterAndSortTubeResults,
    extractRedditVideosFromListing,
    fetchSubredditVideos,
    searchRedditVideosByKeyword,
    searchPeerTubeVideos,
    searchFediverseVideos,
    extractVideoUrlsFromHtml,
    scanUrlForVideos,
    extractCandidateWebPagesFromSearchHtml,
    searchOpenWebVideos,
    searchFreeTubeSites,
    isPeerTubeSource,
    isPeerTubeExplicitlyEnabled,
    buildKeywordEnginePromises,
    getSourceCacheKey,
    interleaveVideoBuckets,
    pullFromSource,
    pullRandomVideos,
    runContinuousPullCycle,
    startContinuousBackgroundPuller,
    stopContinuousBackgroundPuller,
    scheduleBackgroundQueuePrebuffer,
    parseM3u8Manifest,
    downloadAndAssembleM3u8Stream,
    escapeHtml,
    obtainIphoneReadyVideoBlob,
    convertCurrentVideoForPlayer,
    handleVideoPlaybackError,
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
    disableAllDirectorySources,
    enableDirectoryCategory,
    toggleAdultDirectory,
    renderAdultDirectory,
    switchTab,
    renderSourcesList,
    renderSearchResults,
    renderVaultList,
    saveVideoToVaultDB,
    saveAndCacheVideoToVault,
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
    syncQueueAfterSourceChange,
    shuffleArray,
    isFreeTubePresetSource,
    armPlaybackStartupWatchdog,
    clearPlaybackStartupWatchdog,
    recordDeadStreamUrl,
    rescueDeadVideoStream,
    isStaleOrDisallowedRestoredItem,
    upgradeUnsignedRedgifsItems,
    setNsfwPin,
    clearNsfwPin,
    verifyMasterAppPasscode,
    verifyNsfwPin,
    unlockAppGate,
    lockAppGate,
    registerNsfwBiometric,
    authenticateNsfwBiometric,
    revokeVideoItemBlobUrls,
    scrubNsfwFromActiveSession,
    scrubSafeFromActiveSession,
    triggerPanicSafeMode,
    getSavedPlaybackTime,
    savePlaybackState,
    restorePlaybackState,
    rehydrateQueueOfflineBlobsFromVault,
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
      playbackPositions,
      deadUrls
    }),
    setAppState: (patch = {}) => {
      if (Array.isArray(patch.sources)) {
        sources = patch.sources;
        sourceSelectionGeneration++;
        continuousSourceCursor = 0;
        sourcePoolCache.clear();
        if (!Array.isArray(patch.deletedSourceIds)) {
          settings.deletedSourceIds = [];
        }
      }
      if (Array.isArray(patch.deletedSourceIds)) {
        settings.deletedSourceIds = patch.deletedSourceIds;
      }
      if (Array.isArray(patch.videoQueue)) {
        clearPlaybackStartupWatchdog();
        const nextSet = new Set(patch.videoQueue);
        revokeVideoItemBlobUrls(videoQueue.filter((item) => !nextSet.has(item)));
        videoQueue = patch.videoQueue;
        consecutiveErrorSkips = 0;
        isHandlingPlaybackError = false;
        if (patch.videoQueue.length === 0) {
          seenUrls.clear();
          deadUrls.clear();
          if (!patch.playbackPositions) {
            playbackPositions = {};
          }
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
