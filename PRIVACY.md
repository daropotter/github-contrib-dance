## Contrib Dance privacy policy

Last updated: October 30, 2026.

Contrib Dance changes the appearance of contribution calendars on github.com.
The developer does not operate a backend for the extension. The extension has
no analytics, telemetry, advertising or tracking, and does not send GitHub
profile information or browsing history to the developer.

### GitHub page content

The extension accesses github.com pages to find contribution calendars and
read their dates, contribution counts and activity levels. It processes this
information locally in the browser to calculate visual effects and show
calendar information in its toolbar popup. It does not save calendar data in
extension storage or transmit it to an external service.

Access to github.com is needed for this functionality. The `storage` API
permission is used to save the preferences described below.

### Preferences and browser synchronization

The extension stores only the following display and behavior preferences in
`browser.storage.sync`:

- Highlight: enabled state, brightness slider position (or automatic mode) and glow.
- Dance: enabled state, proportion of dancing tiles and selected choreography.
- Disco: enabled state, saturation, rainbow, mirror ball, spotlights and club mode.
- Tempo in beats per minute.

These values are booleans, numbers, `null` for automatic brightness, and a
choreography name chosen from a fixed list. They do not include URLs, domain
lists, usernames, email addresses, identifiers, browsing history or page content.

Your browser may synchronize these preferences across your devices through its
built-in synchronization service, depending on your browser and account
configuration. In Firefox, this uses Firefox Sync according to your Mozilla
account and browser settings. In Chrome, preferences may be synchronized by
Chrome's built-in sync service according to your Google account and browser
settings. Synchronization is handled by the browser
provider, not by a service operated by the extension's developer. The developer
does not receive these synchronized preferences.

### Device-local animation preference

The extension stores a single `motionOk` flag in `browser.storage.local` when
you explicitly enable animation on a device that requests reduced motion.
This flag is not synchronized to other devices.

### Managing preferences

Preferences remain in browser-managed extension storage until they are reset or
removed by the browser. You can control synchronization in your browser's Sync
settings. Any retention of synchronized copies is governed by the browser
provider's policies; the developer does not keep a separate copy.

### Limited use

Calendar information and preferences are used only to provide the extension's
visible calendar customization features. They are not sold, used for
advertising or creditworthiness decisions, or used for unrelated purposes.
The extension's use of user data adheres to the Chrome Web Store User Data
Policy, including its Limited Use requirements.

### Questions

For questions about the extension or this policy, use the
[project's GitHub issues](https://github.com/daropotter/github-contrib-dance/issues).
Issues are public: do not include passwords or other private information.
Information you choose to post there is handled by GitHub under its own privacy
policy. This policy covers the extension, not GitHub or your browser provider's
services.
