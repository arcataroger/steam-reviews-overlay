## How to install

### Firefox (desktop and Android)

1. Open [Steam Reviews Overlay on addons.mozilla.org](https://addons.mozilla.org/firefox/addon/steam-reviews-overlay/).
2. Click **Add to Firefox**, then **Add**.

Firefox updates it automatically. Don't use the Firefox zip below to install: it's unsigned, and release Firefox refuses unsigned add-ons.

### Chrome, Edge, Brave and other Chromium browsers

From the store (updates automatically):

1. Open [Steam Reviews Overlay in the Chrome Web Store](https://chromewebstore.google.com/detail/ofaaleepnlflabmjpaieodjgpgddaein).
2. Click **Add to Chrome**, then **Add extension**. Edge asks you to **Allow extensions from other stores** first.

From this page (no automatic updates):

1. Download `steam-reviews-overlay-chrome-{{VERSION}}.zip` below.
2. Unzip it into a folder you'll keep. Chrome loads the extension from that folder every time it starts.
3. Open `chrome://extensions` (`edge://extensions` in Edge).
4. Turn on **Developer mode**.
5. Click **Load unpacked** and pick the unzipped folder.

To update, unzip the new version over the same folder, then click the reload icon on the extension's card.

### Then

1. Open the [Steam store](https://store.steampowered.com/). Every game shows its review score.
2. Click the extension's toolbar icon to dim, hide or outline games by score. If you don't see it, pin it from the puzzle-piece menu.

## Downloads

- `steam-reviews-overlay-chrome-{{VERSION}}.zip`: the Chrome build, for loading unpacked or uploading to the Chrome Web Store.
- `steam-reviews-overlay-firefox-{{VERSION}}.zip`: the unsigned Firefox build, for uploading to AMO.
- `steam-reviews-overlay-source-{{VERSION}}.zip`: the source code. To build it, see [BUILD.md](https://github.com/{{REPO}}/blob/{{TAG}}/BUILD.md).

## Changes

