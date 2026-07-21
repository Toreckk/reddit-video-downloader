# Manual testing in Firefox

## Signed release installation

1. Open `about:addons` in Firefox.
2. From the settings cog, choose **Install Add-on From File…** and select the Mozilla-signed `.xpi`.
3. In Firefox's installation prompt, approve the requested Reddit, Redgifs, and `v.redd.it` access.
4. Existing Reddit tabs reload automatically. Confirm inline Download actions appear without opening
   the toolbar popup.
5. Restart Firefox and confirm the extension remains installed.

Firefox displays a notification dot while required Manifest V3 site access is missing. If access was
declined or later revoked, open the toolbar popup and select **Enable access**.

## Temporary development installation

1. Run `npm install`, then `npm run build:firefox` in this repository.
2. Open Firefox and enter `about:debugging#/runtime/this-firefox` in the address bar.
3. Select **Load Temporary Add-on…**.
4. Choose `.output/firefox-mv3/manifest.json` from this repository.
5. Pin **Reddit Media Downloader** from Firefox's Extensions menu so its toolbar icon is visible.

A temporary add-on remains installed until Firefox restarts. After rebuilding, return to
`about:debugging`, find the extension, and click **Reload**. Reload any Reddit tabs too, because
content scripts already present in a tab are not replaced automatically. Temporary builds may retain
development host grants, so permission behavior must always be accepted once with a signed build.

## First acceptance pass

1. Open an old Reddit or current Reddit page containing direct Redgifs and `v.redd.it` post links. Confirm each supported post receives a **download** action beside Reddit's other post actions.
2. Leave the Redgifs/RES preview closed and open the extension popup. Confirm the default mode does not list that post.
3. Expand the embed in Reddit, then click **Refresh**. Confirm the popup now lists its title, Reddit creator, subreddit, and provider.
4. Click the inline **download** action on a Redgifs post. Confirm it works even when the embed is closed. Repeat from the popup's **Download** button.
5. Confirm the popup says **Download started** and the resulting filename uses the Redgifs uploader followed by the Reddit title. If the provider has no uploader, it should fall back to the Reddit creator.
6. Play the file and verify it contains audio when the Redgifs source has audio.
7. Click **download** on a `v.redd.it` post. While it prepares, confirm the action shows **preparing…**. Play the resulting MP4 and verify that it contains both video and audio when the source has audio.
8. Leave another native Reddit video collapsed and confirm it is absent from the opened-only popup. Expand its native player, click **Refresh**, and confirm it appears without relying on a new network request.
9. Scroll until Reddit dynamically loads more posts and confirm supported posts receive inline actions without reloading the extension.
10. Open an old Reddit search page containing Redgifs or `v.redd.it` results. Confirm each supported search card receives a **download** action in its metadata row and downloads with the result's title and Reddit author.
11. Use the popup search field, then click **Clear shown**. Confirm only the filtered rows are cleared, reopening the popup keeps them cleared, and reloading Reddit restores them.
12. Open the options page from the popup gear. Confirm **Always ask where to save** is enabled on a
    clean profile, then test both its enabled and disabled behavior. Also test **All supported links
    loaded on the page**, **Prefer SD**, and the fallback template
    `{sourceCreator|creator} - {title}`.
13. On Firefox for Android, confirm downloads use the normal Android behavior without failing when
    **Always ask where to save** is enabled.

## Inspecting download errors

The popup shows an error code and, when Firefox supplies one, its underlying download error. For the full error object and stack:

1. Open `about:debugging#/runtime/this-firefox`.
2. Find **Reddit Media Downloader** and click **Inspect**.
3. Select the **Console** tab, retry the failed video, and look for **[Reddit Media Downloader] Download failed**.
4. Copy the logged `normalizedError`, `provider`, and `mediaId` when reporting a problem. Do not share temporary provider tokens or unrelated browsing data.
5. Scroll until Reddit loads more posts, reopen the popup or click Refresh, and confirm newly opened supported posts appear without duplicates.

## Useful failure cases

- Open the popup on a non-Reddit page: it should explain that a Reddit tab is needed.
- Go offline before clicking Download: the row should show a recoverable provider/network error.
- Test a removed Redgifs URL: the row should explain that the media is unavailable.
- Test a removed `v.redd.it` URL: it should report that the Reddit video is unavailable.
- Test with RES disabled, with an expando closed, and with an expando open.

For temporary extensions, private-window access is controlled from `about:addons` after installation. Enable **Run in Private Windows** before testing there.
