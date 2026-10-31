## Files and publisher setup

- Run `npm run zip` and upload `.output/contrib-dance-0.2.0-chrome.zip`, not the Firefox or source ZIP. The build output is local and is not committed to the repository.
- Store icon: [128 × 128 PNG](../public/icon/128.png).
- Detailed description: [chrome-description.txt](chrome-description.txt), ready to copy as plain text.
- Test instructions: [chrome-test-instructions.md](chrome-test-instructions.md).
- Screenshots must be 1280 × 800 PNG/JPEG; the store requires at least one. A YouTube video and promotional tiles are optional. The MP4 in the GitHub README is not a Chrome Web Store promotional-video URL.
  - [01 — Highlight](chrome/screenshots/01-highlight.png)
  - [02 — Dance](chrome/screenshots/02-dance.png)
  - [03 — Disco](chrome/screenshots/03-disco.png)
  - These are actual public-profile captures from the installed extension, saved as opaque RGB PNGs at 1280 × 800. Upload in this order.
- The publisher needs a registered Chrome Web Store developer account, the required account verification and registration payment. Logins, 2FA, payments and legal certifications belong to the publisher; no API keys are needed for a manual upload.

This is a local preparation checklist, not a submitted listing. The store assigns the Chrome extension ID on first upload; the Firefox ID must not be copied into the Chrome manifest. Version 0.1.0 is the first Chrome release.

## Store listing

Name (from the manifest):

```text
Contrib Dance for GitHub
```

Short description (from the manifest):

```text
Highlight, dance and disco lights for the GitHub contribution calendar.
```

- Language: English.
- Category: choose the closest available customization/fun category in the dashboard.
- Suggested distribution: free and public, subject to the publisher's region and account choices.

Homepage:

```text
https://github.com/daropotter/github-contrib-dance
```

Support URL:

```text
https://github.com/daropotter/github-contrib-dance/issues
```

Privacy policy URL:

```text
https://github.com/daropotter/github-contrib-dance/blob/main/PRIVACY.md
```

Before submission, merge the updated privacy policy and verify that this URL shows the Chrome Sync and Limited Use paragraphs. Do not describe a draft policy as already published.

## Single purpose

```text
Customize the appearance and animation of contribution calendars on github.com profile pages, with adjustable highlighting, choreography and decorative lighting.
```

## Permissions justification

### storage

```text
Save the user's visual preferences: highlight, dance/disco settings, choreography and tempo. Chrome's built-in storage.sync service may synchronize these preferences across the user's devices according to their browser/account settings. A per-device animation opt-in flag uses storage.local. No page content, browsing history, URLs or account identifiers are saved in extension storage.
```

### Access to https://github.com/*

Use this explanation if the dashboard asks for host/content-script access justification:

```text
Read contribution-calendar dates, counts and activity levels locally and apply the user-selected visual effects. Access is limited to github.com. The domain-wide match supports GitHub's client-side navigation into profile pages without a full page reload; the extension only modifies contribution calendars, not other GitHub content or server-side account data.
```

No tabs, activeTab, history or all-sites permissions are requested.

## Remote code

Select "No, I am not using remote code".

Explanation if a text field is available:

```text
All executable extension code and styles are included in the uploaded package. The extension does not download or execute remote code. The fetch call in the generated popup bundle belongs to Vite's modulepreload fallback; the popup references only packaged resources. There is no developer-operated backend or telemetry.
```

## Privacy practices and data use

Do not copy Firefox's required: ["none"] declaration into Google's form. Google's User Data FAQ requires disclosure even for information handled only locally or through Chrome Storage Sync.

- Declare **Website content**: contribution-calendar dates, counts and activity levels are read and processed locally to implement the visible calendar effects. They are not stored or sent to the developer.
- Explain that only display preferences may use browser-managed Chrome Sync; the developer does not receive them.
- The current extension does not collect or retain usernames/email addresses, authentication data, financial/health information, personal communications, location, browsing history or activity logs. Do not check unrelated categories simply because the extension can run on github.com.
- Review the form's limited-use certifications personally: no sale of user data, no unrelated use/transfer, and no use for creditworthiness or lending decisions. These must stay consistent with the published privacy policy and actual behavior.

No analytics or Google Analytics integration is configured. Do not add one as part of this submission.

## Review and publication

The package contains MIT license information, third-party notices and the privacy policy. The browser-specific Firefox manifest block is absent from the Chrome build.

Uploading a draft and submitting for review are separate actions. Review the final listing, screenshots, privacy declarations, countries and account information before clicking Submit for Review. Do not publish or submit automatically from this checklist.

## Local validation

Validated on October 30, 2026:

- `npm run compile` and `npm run zip` passed.
- Installed the unpacked production build in an isolated Chromium 156.0.8078.4 profile, without using a signed-in browser profile.
- Popup and calendar messaging, highlight, dance, mirror ball/spotlights/club mode, and GitHub's year navigation passed. The year change used client-side navigation and replaced the calendar table.
- Reduced motion blocked dance/disco until explicit device-local opt-in. Turning all effects off removed the extension's visual effects.
- Live Sync contained only the `settings` object with `bpm`, `dance`, `disco` and `highlight`; the animation opt-in remained in local storage. This checks the stored data shape, not synchronization between physical devices.
- The Chrome ZIP has a root-level MV3 manifest, only the `storage` API permission and `https://github.com/*` content-script match, no Firefox metadata, and matching license/privacy/third-party notice files. Store assets and local recordings are excluded.
- Previously submitted Firefox and source ZIPs were not rebuilt; their SHA-256 checksums stayed unchanged.

This is a local smoke test, not a Chrome Web Store review or a guarantee of store approval.

## Official references

- [First publication](https://developer.chrome.com/docs/webstore/publish)
- [Listing fields and required graphic assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Image formats and dimensions](https://developer.chrome.com/docs/webstore/images)
- [Privacy practices fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User Data FAQ, including local processing and Storage Sync](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
