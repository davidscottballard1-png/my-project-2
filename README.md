# ReelVault — iPhone Random Video Puller & Downloader (PWA)

**ReelVault** is an iOS-optimized Progressive Web App (PWA) designed to pull, play, auto-convert, and download random videos across 19 video file extensions from the open web directly to your iPhone—no Mac or App Store required.

## ✨ Features

* **🎬 Multi-Format Video Pulling & Auto-Conversion:** Pulls both **iPhone-native video formats** (`.mp4`, `.mov`, `.m4v`, `.3gp`, `.3g2`, `.m3u8`) and **open-web video formats** (`.webm`, `.ogv`, `.ogg`, `.mkv`, `.avi`, `.mpeg`, `.mpg`, `.flv`, `.f4v`, `.wmv`, `.ts`, `.m2ts`, `.gifv`). Non-native formats are automatically converted/transcoded into iPhone-compatible `.mp4` (via server derivative matching, on-device FFmpeg WebAssembly remuxing/transcoding, and iOS hardware `MediaRecorder`) for smooth playback and Camera Roll saving.
* **🎲 1-Tap Random Video Shuffle & Batch Pull:** Pull a random video (or a batch of 5 at once) from your active sources, or swipe left/right on the player to move through your queue.
* **🌐 Multi-Engine Web Keyword Search:** Type any keyword or topic to search simultaneously across **Internet Archive**, **Wikimedia Commons**, and **Global Reddit Video Search** across all supported video extensions.
* **🔗 Multi-Format Webpage Video Scanner:** Paste a webpage link or direct video URL to scan the page code and extract downloadable `.mp4`, `.mov`, `.m4v`, `.webm`, `.ogv`, `.mkv`, `.avi`, `.mpeg`, `.3gp`, `.flv`, `.wmv`, `.ts`, `.m3u8`, and `.gifv` video files.
* **🎛 Custom Sources Manager:** Add your own custom **Keywords/Topics**, **Subreddits**, or **Direct/JSON Feed URLs**. Toggle any source ON or OFF anytime. All custom sources are stored privately in your iPhone's local storage.
* **📲 Save Straight to iPhone Photos or Files:** Uses the iOS Web Share API (`navigator.share`) so tapping **Save to iPhone** opens the native iOS sheet where you can tap **"Save Video"** (saves straight to your Camera Roll) or **"Save to Files"**.
* **📥 Built-In Vault:** Save favorite clips to your device's local `IndexedDB` vault for quick replay.

---

## 📱 How to Open & Install on Your iPhone

1. **Enable GitHub Pages (One-Time Setup):**
   * On GitHub, open this repository (`davidscottballard1-png/my-project-2`) and go to **Settings → Pages**.
   * Under **Build and deployment → Branch**, select **`main`** (and `/ (root)`) and tap **Save**.
   * Wait ~60 seconds, then open:
     `https://davidscottballard1-png.github.io/my-project-2/` in **Safari** on your iPhone.
2. **Add to Your iPhone Home Screen:**
   * Tap the **Share** button (`⬆️`) at the bottom of Safari.
   * Tap **Add to Home Screen** → **Add**.
   * Launch **ReelVault** from your Home Screen like a native app!
