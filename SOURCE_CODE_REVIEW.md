# Mozilla source code review

Reddit Media Downloader is a Firefox Manifest V3 extension built with WXT and TypeScript. The
submitted extension ZIP contains generated JavaScript bundles, so the accompanying sources ZIP is
provided for review.

## Build environment

- Node.js 24.x
- npm (the version bundled with Node.js 24)
- Any operating system supported by Node.js and WXT
- No environment variables or private packages are required for a normal release build

## Reproduce the submitted archives

From the root of the extracted source archive, run:

```sh
npm ci
npm run zip:firefox
```

The Firefox extension and source archives are written to `.output/`. The unpacked extension used by
Mozilla's signing tool is `.output/firefox-mv3/`.

The generated files inside `.output/firefox-mv3/` are byte-for-byte identical to the files used to
create the submitted extension ZIP. The ZIP container itself may have different metadata timestamps.

WXT reads the version from `package.json`. `release.config.json` controls whether a release is listed
or self-distributed. Versions below `1.0.0` are self-distributed and contain the configured HTTPS
update URL; listed releases omit that URL.

## Generated and third-party code

- WXT bundles the TypeScript entrypoints and project modules.
- Mediabunny is installed from npm and is used to combine selected `v.redd.it` video and audio tracks
  locally without re-encoding.
- The extension does not download or execute remote code.

## Network behavior

The content script runs on Reddit pages. Provider requests happen only after the user chooses to
download a supported item:

- Redgifs: temporary token, selected-item metadata, and selected MP4.
- `v.redd.it`: selected DASH manifest and selected MP4 media tracks.

There is no analytics, advertising, tracking, account system, or extension-owned backend. See
`PRIVACY.md` for the complete disclosure.
