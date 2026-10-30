# Build Notes

How to rebuild Steam Reviews Overlay from source. This file is for store reviewers and anyone checking that the published package matches the code.

## Why the package differs from the source

We write the extension in TypeScript. Vite (with the CRXJS plugin) compiles it to JavaScript and bundles each entry point into one file. Vite minifies the bundles, which is why AMO needs this source. The build adds no third-party runtime code. The extension has no runtime dependencies; every package in `package.json` is a build or test tool.

## Requirements

- Node.js 22.12 or later (we test on 26.8.2)
- npm 10 or later (we test on 11.19.1)
- Any OS: macOS, Linux or Windows

## Build the Firefox package

1. Unzip the source archive and open a terminal in it.
2. Run `npm ci` to install the exact tool versions from `package-lock.json`.
3. Run `npm run build:firefox`.
4. Find the extension in `dist/firefox`. Its contents match the uploaded package file for file.

## Build the Chrome package

1. Follow steps 1 and 2 above.
2. Run `npm run build:chrome`.
3. Find the extension in `dist/chrome`.

## Check the build

1. Run `npm run lint` to run Mozilla's `web-ext lint` on `dist/firefox`.
2. Run `npm test` for the unit tests.

## Where the code lives

- `src/content.ts`: the overlay on Steam store pages.
- `src/steam.ts` and `src/proto.ts`: fetch and decode Steam's review scores.
- `src/background.ts`: reuses Steam's own review requests and restarts the overlay after updates.
- `src/popup/`: the toolbar popup.
- `manifest.config.ts`: generates `manifest.json` for each browser.
- `_locales/`: translations for all 30 Steam languages.
