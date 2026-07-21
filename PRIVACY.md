# Privacy policy

Last updated: 2026-07-21

Reddit Media Downloader has no analytics, advertising, accounts, tracking, external extension backend, or browsing/download-history database.

## Data used locally

On supported Reddit pages, the extension reads loaded post links, displayed titles, creator names, subreddit names, and optional thumbnails so it can add inline Download actions. When you open the popup, the same local information is used to build its media list. These operations occur locally in Firefox and results are not persisted.

The extension stores only your local preferences in Firefox extension storage: opened-only or all-links detection mode, preferred quality, save-dialog preference, filename template, and enabled providers.

When you use **Clear shown**, the cleared media row IDs are held only in the Reddit tab's content-script memory. They are discarded when that page reloads or the tab closes.

## Data transmitted

Only after you click **Download** does the extension contact the selected media provider over HTTPS.

- For Redgifs, it sends the selected media ID, requests a temporary access token, fetches that item's metadata, and asks Firefox to download the selected MP4 from the Redgifs media host.
- For `v.redd.it`, it requests the selected video's DASH manifest and chosen MP4 video/audio tracks. The tracks are combined locally in Firefox without re-encoding, and the resulting file is passed to Firefox's download manager.

Mozilla classifies the selected media ID as `websiteContent`. No Reddit title, Reddit creator name, subreddit, cookie, persistent identifier, analytics event, or unrelated page content is sent by the extension. The selected provider receives ordinary network metadata inherent in the HTTPS requests and handles it under its own privacy practices.

## Data retention and sharing

The extension does not retain provider tokens beyond an in-memory temporary cache, and that cache is lost when Firefox unloads the background page. It does not store detected posts, media URLs, selected media IDs, downloaded-content history, or private-window data. It does not sell or share data.

## Control

Host access is limited to Reddit, Redgifs API/media hosts, and `v.redd.it`. Firefox asks you to approve
these optional host permissions from an extension-owned setup page. Reddit access enables detection
and inline actions; provider access is used only after you select Download. You can inspect or revoke
the permissions, or disable/remove the extension, from Firefox's Add-ons Manager.

The project source and issue tracker are available at <https://github.com/Toreckk/reddit-video-downloader>.

Self-distributed Firefox installations periodically request the project's static update manifest from
GitHub Pages. Firefox performs this update check; the extension does not add analytics or identifiers
to the request. Signed extension packages are hosted as GitHub Release assets.
