## Test access

No GitHub login, separate extension account or test credentials are required. Use a public profile with a contribution calendar, for example:

https://github.com/daropotter

If the profile tab was opened before installing the extension, reload it. Allow access to github.com if Chrome's site-access controls require it.

## Steps

1. Open the extension's toolbar popup. Highlight is enabled by default; Dance and Disco are off.
2. Adjust brightness and toggle glow. Only the appearance of the calendar changes; contribution counts and GitHub account data do not change.
3. Enable Dance, choose a choreography and adjust the proportion of dancing tiles. Change the tempo or use Tap.
4. Enable Disco. Toggle rainbow colors, mirror ball, spotlights and club mode; adjust saturation.
5. Switch calendar years and navigate between public profiles. Effects should follow the displayed contribution calendar.
6. On a system requesting reduced motion, Dance and Disco remain inactive until explicitly enabled on that device. If synchronized settings already show an option as enabled, toggle it off and back on to provide the device-local opt-in.
7. Turn Highlight, Dance and Disco off. The extension removes its visual effects and restores the original calendar appearance after the transitions finish.

## Implementation notes

The add-on is a Manifest V3 extension built with WXT and Vite. Executable code and styles are packaged locally. The modulepreload fallback in the generated popup bundle may contain a fetch call, but the popup uses only packaged resources; this is not a remote-code loader.

The only explicit API permission is storage. The content script matches only https://github.com/* and only acts on contribution calendars. Calendar information stays local and is not persisted. Only visual preferences may synchronize through Chrome's built-in sync service according to browser/account settings; the developer does not receive them. The reduced-motion opt-in uses device-local storage.

LICENSE, THIRD_PARTY_NOTICES.txt and PRIVACY.md are included in the package. No account credentials, external service setup or developer-operated backend are involved in testing.
