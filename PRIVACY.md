# Privacy policy

Last updated: 2026-07-20

Reddit Media Downloader has no analytics, advertising, accounts, tracking, external extension backend, or browsing/download-history database.

## Data used locally

When you open the popup, the extension reads the active Reddit page's loaded post links, displayed titles, creator names, subreddit names, and optional thumbnails. This scan occurs locally in Firefox. Results are shown in the popup and are not persisted.

The extension stores only your local preferences in Firefox extension storage: opened-only or all-links detection mode, preferred quality, save-dialog preference, filename template, and enabled providers.

When you use **Clear shown**, the cleared media row IDs are held only in the Reddit tab's content-script memory. They are discarded when that page reloads or the tab closes.

## Data transmitted

Only after you click **Download** for a Redgifs item, the extension sends that item's Redgifs media ID to Redgifs over HTTPS. It requests a temporary Redgifs access token, fetches metadata for the selected media ID, and asks Firefox to download the selected MP4 from the Redgifs-provided media host.

Mozilla classifies the selected media ID as `websiteContent`. No Reddit URL, Reddit title, Reddit creator name, subreddit, cookie, persistent identifier, analytics event, or unrelated page content is sent by the extension. Redgifs receives ordinary network metadata inherent in the HTTPS requests and handles it under its own privacy practices.

## Data retention and sharing

The extension does not retain provider tokens beyond an in-memory temporary cache, and that cache is lost when Firefox unloads the background page. It does not store detected posts, media URLs, selected media IDs, downloaded-content history, or private-window data. It does not sell or share data.

## Control

Redgifs host access is an optional Firefox permission requested as a direct consequence of the first Redgifs download click. If you decline, no Redgifs request is made and the item remains retryable. You can revoke that access from Firefox's Add-ons Manager.

The project source and issue tracker are available at <https://github.com/Toreckk/reddit-video-downloader>.
