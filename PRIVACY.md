# Privacy Policy

**Steam Reviews Overlay** · Last updated: October 30, 2026

Steam Reviews Overlay collects no personal data. It has no accounts, analytics, tracking, ads or servers of its own. We never see, store, sell or share anything about you.

## What the extension sends

The extension talks to one service: Steam. To fetch review scores, it sends requests to Steam's public store API (`api.steampowered.com`). Each request contains only:

1. The ID numbers of the games on the page you're viewing.
2. Your Steam store language, so Steam returns the score for reviews in your language.

The requests carry no cookies, login or account details. Steam receives them like any other visit to its store and handles them under [Steam's privacy policy](https://store.steampowered.com/privacy_agreement/).

The extension sends nothing to the developer or to any other party.

## What stays on your device

1. **Your settings** (lever positions, dim or hide, language choice). The extension stores them in your browser. If you turned on browser sync (Firefox Sync or Chrome sync), your browser syncs them to your other devices through your own browser account.
2. **Recent review scores.** The extension caches them in your browser for a few minutes, so reloading a page doesn't fetch them again.
3. **Your Steam language.** The extension reads Steam's `Steam_Language` cookie on the store page to learn which language you use. It never reads any other cookie and never sends this one anywhere except as the language in Steam requests.

To remove all of it, uninstall the extension.

## Permissions

- **Steam store pages:** to show review labels and apply your filters.
- **Steam's store API:** to fetch review scores.
- **Storage:** to keep your settings and the short-lived score cache.
- **Web requests:** to notice when Steam's own page already fetched review data, so the extension reuses it instead of asking again.
- **Scripting:** to restart the overlay in open Steam tabs after an install or update.

## Changes

If this policy ever changes, we'll update this page and the date above.

## Contact

Open an issue at <https://github.com/arcataroger/steam-reviews-overlay/issues>.
