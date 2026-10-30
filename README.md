# Contrib Dance

A Chrome and Firefox extension that restyles the contribution calendar on github.com profiles:

https://github.com/user-attachments/assets/0a4cb352-2fe5-4811-adfc-0c1ad76ebfc0

- **Highlight**: set your own brightness max (slider 0–1000, log scale, right = brighter) with a smooth gradient and an optional glow.
- **Dance**: contribution tiles dance to a shared beat. The slider sets the percentage of active days that dance (most active first), and each tile's brightness sets how wild its moves are. Days with no contributions never dance and stay behind the dancers.
- **Disco lights**: rainbow, mirror ball and spotlights in any combination, plus a saturation slider and a club mode.

All settings live in the toolbar popup. They apply to every profile and sync across your devices (`storage.sync`). The only permission is `storage`.

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev            # Chrome with hot reload
npm run dev:firefox    # Firefox
```

Builds and store packages:

```bash
npm run build          # .output/chrome-mv3
npm run build:firefox  # .output/firefox-mv3
npm run zip            # Chrome Web Store package
npm run zip:firefox    # AMO package and source archive
npm run compile        # type check
```

Installing a build by hand:
- **Chrome:** `chrome://extensions` → Developer mode → "Load unpacked" → `.output/chrome-mv3`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → `.output/firefox-mv3/manifest.json`.

## Layout

| File | Role |
| --- | --- |
| `entrypoints/popup/` | Settings popup. Previews changes on the active tab immediately and saves them shortly after. |
| `entrypoints/github.content/index.ts` | Finds calendars (also after a year switch and Turbo navigation) and passes settings to them. |
| `entrypoints/github.content/style.css` | Tile drawn as `td::after`, dance moves, mirror ball, club mode. |
| `src/calendar.ts` | Everything that depends on GitHub's HTML: selectors, counts from tooltips, R0 inference. |
| `src/controller.ts` | One calendar: colors, dancers, lights, smooth transitions and restoring the page. |
| `src/clock.ts` | Shared tempo for the dance and the lights. |
| `src/settings.ts` | Settings, defaults and validation. |

## How it works

- GitHub computes a tile's level as `ceil(4 · count / R0)`, where R0 is the max after trimming outlier days. The extension reads counts from the tooltips and infers R0 from the (count, level) pairs. The "GitHub's look" position in the popup is that R0.
- The colored square is `td::after`, so it can dance while the cell itself stays put as the target for tooltips, hover and clicks.
- Every dance move is pinned to a shared clock (`Animation.startTime`), so changing settings never changes the tempo. A tile that switches moves fades the old one out first.
- Safety: no strobe, a tile's lightness changes by at most 3 L units per second, colors keep the red share below 0.7, and the tempo is capped at 150 BPM. On devices that ask for reduced motion, dance and disco start only after you turn them on in the popup on that device.
- When everything is off, the extension removes its classes, styles and elements, and the page is exactly as GitHub rendered it.

## Before publishing

- Replace the Firefox add-on ID (`contrib-dance@contrib-dance` in `wxt.config.ts`) with the final one.
- Store title: for example "Contrib Dance for GitHub", with a note that the extension is not affiliated with GitHub.
