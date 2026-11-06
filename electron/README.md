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

### Widevine signing is required, even in dev

castlabs' prebuilt Electron is only signed "for development" (Widevine UAT).
Spotify's **production** license server rejects that signature, so audio loads
then throws `playback_error` and skips through the playlist. A castlabs **EVS
(production) VMP signature** fixes it.

One-time setup (free EVS account):

```
python3 -m venv .venv-evs
.venv-evs/bin/python -m pip install castlabs-evs
.venv-evs/bin/python -m castlabs_evs.account signup   # then confirm the emailed code
```

After that, `pnpm install` runs `postinstall` → `electron/sign-widevine.cjs`,
which re-signs the Electron binary with your cached EVS credentials (the binary is
replaced on every install, so signing must re-run). It's idempotent — a still-valid
signature is retained without re-uploading. To sign manually: `pnpm sign:widevine`.
If your EVS session expires: `.venv-evs/bin/python -m castlabs_evs.account reauth`.
If `castlabs-evs` is missing, signing is skipped with a warning (browsing works;
audio won't decrypt). Then `pnpm electron:dev`, log in, and play a track.

## Package a .dmg (Widevine requires VMP signing)

The packaged app must also carry a castlabs **VMP signature** (same EVS account as
above).

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
