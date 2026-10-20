# Desktop shell (Electron)

The classic skin runs as a native desktop app. Two things make it more than a
browser in a frame:

- **Frameless, skin-sized window.** The window has no OS title bar and is sized
  to exactly wrap the skin, so the skin *is* the app. The skin's own title bars
  move the window (drag) and its close/shade boxes close/minimize it, via the
  `window.desktop` preload bridge (`preload.cjs` ↔ `main.cjs` IPC).
- **Widevine audio.** Spotify's Web Playback SDK decrypts audio through
  EME/Widevine. Stock Electron has no Widevine CDM (you get
  `EMEError: No supported keysystem was found`). We depend on
  [castlabs' Electron fork](https://github.com/castlabs/electron-releases)
  (`v33.4.11+wvcus`), which ships the CDM; `main.cjs` awaits
  `components.whenReady()` before opening the window.

## Run

```
pnpm install            # pulls the castlabs Electron build (Widevine included)
pnpm electron:dev       # Vite + frameless Electron window, hot reload
pnpm electron:preview   # build, then run the packaged-style app
```

Dev and preview get Widevine automatically from the castlabs binary — no signing
needed to *run* locally. Log in and play a track to confirm audio decrypts.

## Package a .dmg (Widevine requires VMP signing)

To run outside dev, the packaged app must carry a castlabs **VMP signature** or
Widevine will refuse to play. One-time setup (free EVS account):

```
pip install castlabs-evs
python3 -m castlabs_evs.account --sign-up   # or --reauth if you have an account
```

Then:

```
pnpm electron:pack      # build + electron-builder; afterPack.cjs VMP-signs the .app
```

`electron/afterPack.cjs` runs `castlabs_evs.vmp sign-pkg` on the bundle before
Apple code-signing (the required order on macOS). If `castlabs-evs` isn't
installed it warns and continues, producing an **unsigned** .dmg that launches
but won't decrypt Widevine audio.

`electronDownload` in `package.json` points electron-builder at the castlabs
release mirror so the packaged binary is the Widevine build, matching the dev
dependency.
