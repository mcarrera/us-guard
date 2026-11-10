# US Guard

A Safari Web Extension that keeps your browsing locked to US soil — built for banking sessions when you need every signal your browser emits (IP, timezone, locale) to tell one consistent story: *you are in the United States*.

## What it does

**1. US IP gate (fail-closed)**
Checks your public IP against geolocation services. If you're not behind a US exit — or if the check can't complete — *all* browsing is blocked via a `declarativeNetRequest` rule that kills every main-frame navigation. No nag dialogs, no warnings: pages just don't load.

- Browser startup = **locked by default**, unlocked only after a confirmed US IP
- Re-checks every 60 seconds; any failure re-locks immediately
- Fail-closed: dead API, dropped VPN, or garbage response = you stay blocked
- Toolbar badge: green **US** = open, red **X** = locked

**2. Timezone spoof**
Every website sees US Pacific Time (`America/Los_Angeles`) instead of your real timezone. Implemented by patching `Date` and `Intl.DateTimeFormat` in the page's MAIN world at `document_start` — before any page script runs:

- `Intl.DateTimeFormat().resolvedOptions().timeZone` → `America/Los_Angeles`
- `getTimezoneOffset()`, `toString()`, `toLocaleString()`, local getters → all Pacific
- **The real clock is never touched**: `Date.now()` and `getTime()` still return true UTC epochs, so "your clock is accurate" checks (time.is) keep passing — no suspicious skew, just a fake timezone label

Connect to a West Coast VPN server and your IP, clock, and formatting all agree: a perfectly ordinary Seattle afternoon.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest — permissions, rules, content script |
| `background.js` | The gatekeeper: geo check loop, badge, dynamic rules, MAIN-world injector |
| `spoof.js` | Timezone spoof injected into every page |
| `rules.json` | Static `declarativeNetRequest` rule: allow the geo APIs even while blocking |

## Install (Safari)

You need Xcode (free). One-time setup:

```bash
xcrun safari-web-extension-converter /path/to/us-guard \
  --project-location /path/to/output \
  --app-name "US Guard" \
  --bundle-identifier com.yourname.usguard
```

1. Open the generated `US Guard.xcodeproj` in Xcode
2. Xcode → Settings → Accounts → add your Apple ID (free is fine)
3. Select the **Personal Team** for every target in Signing & Capabilities
4. Destination = **My Mac**, then **Cmd + R**
5. Safari → Settings → Extensions → enable **US Guard** → website access: **All Websites** (requires Develop → Allow Unsigned Extensions, and Settings → Advanced → "Show features for web developers")

Rebuilding an unsigned extension can silently untick it in Safari and grey out website-access buttons — after every rebuild: quit Safari fully (**⌘Q**), relaunch, re-tick the extension, confirm "All Websites".

## Install (Brave / Chrome)

Much easier — no Xcode at all:

1. `brave://extensions` (or `chrome://extensions`) → enable **Developer mode**
2. **Load unpacked** → select the folder with the 4 files
3. Done. MAIN-world content scripts are natively supported, so the injector fallback isn't even needed.

Firefox: `about:debugging` → Load Temporary Add-on (evaporates on restart), or get a signed-unlisted `.xpi` via addons.mozilla.org for a permanent install.

## Configuration

- **Timezone**: edit `const TZ` in `spoof.js` (default `America/Los_Angeles` — pair it with a West Coast VPN server for a coherent story)
- **Check interval**: `CHECK_INTERVAL_MINUTES` in `background.js`
- **Geo providers**: `GEO_ENDPOINTS` in `background.js` — if you swap one, keep `rules.json` allow-list in sync

## Test it

| Site | Expect |
|---|---|
| https://time.is | Local time matches your VPN city; "your clock is accurate" |
| https://coveryourtracks.eff.org | Time zone: `America/Los_Angeles`; offset −480 (−420 DST) |
| https://browserleaks.com/javascript | Timezone `America/Los_Angeles`, US VPN IP |

Toggle test: disconnect the VPN → within 60 seconds pages stop loading (red **X**); reconnect → browsing resumes (green **US**).

## Known limitations

- The gate trusts public geo-APIs (`ipwho.is`, `ipapi.co`, `ipinfo.io`) — all free-tier services with rate limits; a dead one falls through to the next, and total failure means locked (by design)
- Websites *displaying* time can still correlate server-side timestamps; nothing here affects what the wire protocol reveals
- Unsigned extensions require occasional re-approval in Safari
- `navigator.language`/locale are not touched — configure your OS to US English if you want that signal aligned too

## Disclaimer

For privacy-conscious users who want their browser signals consistent with their VPN exit node. The author makes no claims of undetectability against sophisticated anti-fingerprinting. Use responsibly and in accordance with the terms of service of sites you visit.

## License

MIT
