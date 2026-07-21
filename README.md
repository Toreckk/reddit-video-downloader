# Reddit Media Downloader

A privacy-focused Firefox extension that finds supported videos in Reddit and downloads the best complete MP4. Redgifs and Reddit-hosted `v.redd.it` videos are supported through a provider architecture designed for additional sources.

## Features

- Adds a compact Download action to supported posts on old and current Reddit, including old Reddit search results and dynamically loaded posts.
- Scans old and current Reddit when the toolbar popup opens or you click Refresh.
- Shows opened supported embeds by default, with an option to scan every supported link loaded on the page.
- Filters long lists by title, Reddit user, subreddit, provider, or media ID.
- Clears all currently shown rows for the lifetime of the Reddit tab without storing browsing history.
- Resolves only the selected video, prefers HD with audio, falls back to SD, and never chooses Redgifs' explicit silent variant.
- Reads `v.redd.it` DASH manifests, downloads the selected video and best audio tracks, and combines them locally into one MP4 without re-encoding.
- Creates safe `{sourceCreator|creator} - {title}.mp4` filenames using the source uploader's display name when available, falling back to its account handle and then the Reddit user, and lets Firefox uniquify duplicates.
- Includes quality, save-dialog, and filename-template options.
- Uses no analytics, accounts, browsing-history storage, external backend, or request interception.

## Development

Requires Node.js 20 or later and Firefox desktop.

```sh
npm install
npm test
npm run build:firefox
npm run verify
```

The unpacked Firefox MV3 build is written to `.output/firefox-mv3/`. The release ZIP is produced by `npm run zip:firefox`.

See [docs/manual-testing.md](docs/manual-testing.md) for temporary installation and the first manual acceptance pass. The full design is in [docs/firefox-media-downloader-extension-plan.md](docs/firefox-media-downloader-extension-plan.md).

## Privacy and permissions

- `downloads`: starts the download you explicitly select.
- `storage`: saves extension options locally, including opened-only/all-links detection mode.
- Reddit page access: runs the lightweight, on-demand detector.
- Provider host access: limited to Redgifs API/media hosts and `v.redd.it`, allowing Download actions inside Reddit posts to work on their first click.

No user or post history is persisted.

Mozilla classifies the selected media ID sent to its media provider as transmitted `websiteContent`. The Firefox manifest declares that category; no browsing activity, website interaction telemetry, technical data, or personally identifying data is transmitted. See [PRIVACY.md](PRIVACY.md) for the complete disclosure.
