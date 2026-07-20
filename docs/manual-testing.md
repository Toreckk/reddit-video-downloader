# Manual testing in Firefox

## One-time setup

1. Run `npm install`, then `npm run build:firefox` in this repository.
2. Open Firefox and enter `about:debugging#/runtime/this-firefox` in the address bar.
3. Select **Load Temporary Add-on…**.
4. Choose `.output/firefox-mv3/manifest.json` from this repository.
5. Pin **Reddit Media Downloader** from Firefox's Extensions menu so its toolbar icon is visible.

A temporary add-on remains installed until Firefox restarts. After rebuilding, return to `about:debugging`, find the extension, and click **Reload**. Reload any Reddit tabs too, because content scripts already present in a tab are not replaced automatically.

## First acceptance pass

1. Open an old Reddit or current Reddit page containing a direct Redgifs post link.
2. Leave the Redgifs/RES preview closed and open the extension popup. Confirm the default mode does not list that post.
3. Expand the embed in Reddit, then click **Refresh**. Confirm the popup now lists its title, Reddit creator, subreddit, and provider.
4. Click **Download**. Firefox should ask for narrow Redgifs access the first time; approve it.
5. Confirm the popup says **Download started** and the resulting filename uses the Redgifs uploader followed by the Reddit title. If the provider has no uploader, it should fall back to the Reddit creator.
6. Play the file and verify it contains audio when the Redgifs source has audio.
7. Use the popup search field, then click **Clear shown**. Confirm only the filtered rows are cleared, reopening the popup keeps them cleared, and reloading Reddit restores them.
8. Open the options page from the popup gear. Test **All supported links loaded on the page**, **Prefer SD**, **Always ask where to save**, and the fallback template `{sourceCreator|creator} - {title}`.

## Inspecting download errors

The popup shows an error code and, when Firefox supplies one, its underlying download error. For the full error object and stack:

1. Open `about:debugging#/runtime/this-firefox`.
2. Find **Reddit Media Downloader** and click **Inspect**.
3. Select the **Console** tab, retry the failed video, and look for **[Reddit Media Downloader] Download failed**.
4. Copy the logged `normalizedError`, `provider`, and `mediaId` when reporting a problem. Do not share temporary provider tokens or unrelated browsing data.
5. Scroll until Reddit loads more posts, reopen the popup or click Refresh, and confirm newly opened supported posts appear without duplicates.

## Useful failure cases

- Open the popup on a non-Reddit page: it should explain that a Reddit tab is needed.
- Deny the Redgifs permission: the row should remain retryable.
- Go offline before clicking Download: the row should show a recoverable provider/network error.
- Test a removed Redgifs URL: the row should explain that the media is unavailable.
- Test with RES disabled, with an expando closed, and with an expando open.

For temporary extensions, private-window access is controlled from `about:addons` after installation. Enable **Run in Private Windows** before testing there.
