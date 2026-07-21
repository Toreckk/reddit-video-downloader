# Changelog

## 0.2.1 (2026-07-21)

### Notable changes

#### Reliable Firefox permissions

- Add a one-time setup page that requests Reddit, Redgifs, and `v.redd.it` access from a valid
  extension-owned user action.
- Reload open Reddit tabs after access is granted so inline Download actions appear immediately.
- Show a permission-specific error instead of reporting missing provider access as a network failure.

#### Release workflow

- Stage each version on a `release/vX.Y.Z` branch with its package version and curated changelog.
- Create the GitHub Release and submit the same version to Mozilla automatically after the reviewed
  release pull request is merged into `master`.
- Build signed release candidates from the version branch while keeping their Firefox package
  version lower than the upcoming stable version.

### Other changes

- Use the general description “Download videos directly from Reddit posts.”
- Declare Firefox for Android 142 as the Android-specific minimum while retaining Firefox Desktop 140
  support, removing the Mozilla validator warning.
- Remove the obsolete pre-implementation plan and refresh contributor, testing, and release guidance.

## 0.2.0 (2026-07-21)

### Features

- Download Redgifs videos discovered on supported Reddit pages.
- Download `v.redd.it` video and audio tracks and combine them locally without re-encoding.
- Add inline download actions to old Reddit, current Reddit, and old Reddit search results.
- Search, filter, clear, quality, save-dialog, provider, and filename-template controls.
- Prefer source creator display names with Reddit creator fallback.

### Privacy and distribution

- No analytics, advertising, accounts, extension backend, or browsing-history database.
- Firefox self-distribution support with signed unlisted releases and automatic update manifests.
