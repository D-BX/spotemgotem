// electron-builder afterPack hook: VMP-sign the packaged app so Widevine trusts
// it. The castlabs Electron build ships the Widevine CDM, but for DRM playback to
// be *allowed* the application bundle must carry a Verified Media Path (VMP)
// signature from castlabs' EVS service. On macOS this must happen BEFORE Apple
// code-signing — i.e. here in afterPack, which electron-builder runs before it
// signs. (Windows signs VMP after Authenticode; Linux needs no VMP signature.)
//
// Signing requires a one-time EVS account and the `castlabs-evs` Python package:
//   pip install castlabs-evs && python3 -m castlabs_evs.account --sign-up
// See the README. If the tooling isn't present we warn loudly and continue, so an
// unsigned local build still produces a .dmg (it just won't decrypt Widevine).

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

/** @param {import('electron-builder').AfterPackContext} context */
module.exports = async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName === 'linux') return; // Linux CDM needs no VMP signature

  const productName = packager.appInfo.productFilename;
  const target =
    electronPlatformName === 'darwin'
      ? path.join(appOutDir, `${productName}.app`)
      : appOutDir;

  if (!fs.existsSync(target)) {
    console.warn(`[vmp] target not found, skipping VMP signing: ${target}`);
    return;
  }

  const python = process.env.PYTHON || 'python3';
  const run = (args) =>
    spawnSync(python, ['-m', 'castlabs_evs.vmp', ...args], { stdio: 'inherit' });

  console.log(`[vmp] signing ${target}`);
  const signed = run(['sign-pkg', target]);
  if (signed.status !== 0) {
    console.warn(
      `[vmp] VMP signing failed or castlabs-evs is not installed ` +
        `(exit ${signed.status ?? signed.error?.code ?? 'unknown'}). ` +
        `The build will NOT play Widevine-protected audio until it is VMP-signed. ` +
        `Install it with: pip install castlabs-evs && ` +
        `python3 -m castlabs_evs.account --sign-up`,
    );
    return;
  }
  run(['verify-pkg', target]); // best-effort confirmation; non-fatal
};
