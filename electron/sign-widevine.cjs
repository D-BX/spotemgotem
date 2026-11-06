// VMP-sign the castlabs Electron binary used in DEVELOPMENT so Spotify's Widevine
// license server grants a stream. Run automatically from `postinstall`.
//
// Why this is needed: castlabs' prebuilt Electron carries a signature that is
// "valid for development only" (Widevine UAT). Spotify's PRODUCTION license server
// rejects it, so every track loads then throws `playback_error` and auto-skips
// (looks like: a couple seconds of audio, then the player skips through the whole
// playlist). Re-signing the binary with a castlabs EVS *production* signature fixes
// it. The packaged .dmg is signed separately by `afterPack.cjs`; this covers
// `pnpm electron:dev` / `electron:preview`, and must re-run after each install
// because `pnpm install` replaces the Electron binary.
//
// Requires a one-time free EVS account + the castlabs-evs Python package:
//   python3 -m venv .venv-evs && .venv-evs/bin/python -m pip install castlabs-evs
//   .venv-evs/bin/python -m castlabs_evs.account signup   # then confirm the emailed code
// Cached EVS credentials are reused on later runs. If the tooling/creds are absent
// (CI, a fresh clone, Linux) we warn and exit 0 — browsing still works; audio won't
// decrypt until the binary is signed.

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function warn(msg) {
  console.warn(`[sign-widevine] ${msg}`);
}

// Linux needs no VMP signature; nothing to do.
if (process.platform === 'linux') process.exit(0);

// Resolve the Electron dist directory that `electron .` will actually launch.
let distDir;
try {
  const exe = require('electron'); // path to .../dist/Electron.app/Contents/MacOS/Electron (mac)
  if (typeof exe !== 'string') throw new Error('electron module did not resolve to a path');
  distDir =
    process.platform === 'darwin'
      ? exe.replace(/\/Electron\.app\/Contents\/MacOS\/Electron$/, '')
      : path.dirname(exe);
} catch (e) {
  warn(`could not resolve the Electron binary (${e.message}); skipping. Audio may not decrypt.`);
  process.exit(0);
}

if (!fs.existsSync(distDir)) {
  warn(`Electron dist not found at ${distDir}; skipping.`);
  process.exit(0);
}

// Pick a Python that has castlabs_evs. Prefer an explicit override, then the repo's
// local venv, then the system python3.
const root = path.join(__dirname, '..');
const candidates = [
  process.env.PYTHON,
  path.join(root, '.venv-evs', 'bin', 'python'),
  'python3',
].filter(Boolean);

function hasEvs(py) {
  const r = spawnSync(py, ['-c', 'import castlabs_evs'], { stdio: 'ignore' });
  return r.status === 0;
}

const python = candidates.find((py) => hasEvs(py));
if (!python) {
  warn(
    'castlabs-evs not found — skipping VMP signing. Spotify audio will NOT decrypt ' +
      'in `pnpm electron:dev` until the Electron binary is signed. Set it up once:\n' +
      '  python3 -m venv .venv-evs && .venv-evs/bin/python -m pip install castlabs-evs\n' +
      '  .venv-evs/bin/python -m castlabs_evs.account signup',
  );
  process.exit(0);
}

console.log(`[sign-widevine] VMP-signing ${distDir}`);
const signed = spawnSync(python, ['-m', 'castlabs_evs.vmp', 'sign-pkg', distDir], {
  stdio: 'inherit',
});
if (signed.status !== 0) {
  warn(
    `VMP signing failed (exit ${signed.status ?? signed.error?.code ?? 'unknown'}). ` +
      'Audio may not decrypt. If your EVS session expired, re-auth with:\n' +
      '  .venv-evs/bin/python -m castlabs_evs.account reauth',
  );
  process.exit(0); // never fail the install
}
