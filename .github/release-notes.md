> Want automatic updates? Install from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/steam-reviews-overlay/) or the [Chrome Web Store](https://chromewebstore.google.com/detail/ofaaleepnlflabmjpaieodjgpgddaein) instead.

## Install from this page

These builds don't update themselves. To update, repeat the steps with a newer release.

### Chrome, Edge, Brave and other Chromium browsers

1. Download `steam-reviews-overlay-chrome-{{VERSION}}.zip` below.
2. Unzip it into a folder you'll keep. The browser loads the extension from that folder every time it starts.
3. Open `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave).
4. Turn on **Developer mode**.
5. Click **Load unpacked** and pick the unzipped folder.

To update, unzip the new version over the same folder, then click the reload icon on the extension's card.

### Firefox Developer Edition, Nightly or ESR (stays installed)

This build isn't signed by Mozilla. Only these editions of Firefox can install unsigned add-ons.

1. Open `about:config`, accept the warning, and set `xpinstall.signatures.required` to `false`.
2. Download `steam-reviews-overlay-firefox-{{VERSION}}.xpi` below.
3. Open `about:addons` and drag the `.xpi` file onto the page.
4. Click **Add**.

To update, drag the newer `.xpi` onto `about:addons` the same way.

### Regular Firefox (until you restart)

Regular Firefox ignores `xpinstall.signatures.required`, so it can only load this build temporarily.

1. Download `steam-reviews-overlay-firefox-{{VERSION}}.xpi` below.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick the `.xpi` file.

Firefox removes it when it quits. To keep it, install it from Firefox Add-ons instead.

### Then

1. Open the [Steam store](https://store.steampowered.com/). Every game shows its review score.
2. Click the extension's toolbar icon to dim, hide or outline games by score. If you don't see the icon, pin it from the extensions (puzzle-piece) menu.

## Files

- `steam-reviews-overlay-chrome-{{VERSION}}.zip`: Chrome, Edge, Brave and other Chromium browsers.
- `steam-reviews-overlay-firefox-{{VERSION}}.xpi`: Firefox (unsigned).
- `steam-reviews-overlay-source-{{VERSION}}.zip`: the source code. To build it, see [BUILD.md](https://github.com/{{REPO}}/blob/{{TAG}}/BUILD.md).
