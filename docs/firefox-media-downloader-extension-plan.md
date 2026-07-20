# Modular Firefox Media Downloader — Implementation Plan

Status: proposed implementation specification
Date: 2026-07-20
Initial target: Firefox desktop, Reddit, and Redgifs
UX revision: toolbar popup with an on-demand list of detected media

## Implemented product revisions (2026-07-20)

These user-tested decisions supersede conflicting version 1 defaults later in this original plan:

- Detection defaults to Redgifs embeds the user has expanded in Reddit. The options page can switch to all supported links loaded in the page.
- The popup includes local text filtering and a **Clear shown** action. Cleared row IDs live only in the current Reddit tab's memory and reset on page reload/navigation.
- Source uploader metadata is exposed as `{sourceCreator}` in filename templates. For Redgifs this uses the top-level `user.name` display name, falling back internally to the account handle when absent. The default is `{sourceCreator|creator} - {title}`: fallback expressions try fields from left to right, so it uses the Redgifs uploader when available and otherwise the Reddit `{creator}`.

## 1. Objective

Build a Firefox extension that detects supported media links in the active Reddit tab. Clicking the extension's toolbar icon opens a compact popup listing the detected videos; clicking a video's **Download** action downloads the best available MP4 that retains audio.

The implementation must be modular in two independent directions:

1. **Site surfaces** determine how posts and their identifying metadata are found on a website. Initial surfaces are old Reddit and current Reddit.
2. **Media providers** recognize media links and resolve downloadable variants. The initial provider is Redgifs; future examples could include Streamable, Imgur, or Reddit-hosted media.

The extension should not depend on Reddit Enhancement Suite (RES). It should coexist with RES and benefit from its Redgifs preview, but downloading must work before the preview is opened.

### Product recommendation

Use a Firefox toolbar action with a popup, not per-post injected buttons. This reduces coupling to Reddit's frequently changing action-row DOM, removes page clutter, and presents all supported videos in one predictable place. It costs one additional click compared with a per-post button: toolbar icon, then the desired video's Download action.

The popup should scan posts already loaded in the active tab, not only videos whose previews have been opened. Each row should emphasize the Reddit title and creator so the user can recognize the correct item without playing it first. Keep an optional one-click “download immediately when exactly one video is found” behavior deferred; surprising automatic downloads are less intuitive than a consistent two-click flow.

## 2. Confirmed technical findings

The investigation established the following behavior for a Redgifs post:

- RES displays Redgifs through a `redgifs.com/ifr/<id>` iframe.
- Redgifs may stream playback with an HLS playlist (`sd.m3u8`) and repeated fragmented-MP4 (`.m4s`) range requests.
- The player metadata response still exposes complete media variants:
  - `gif.urls.hd`: full HD MP4
  - `gif.urls.sd`: full lower-quality MP4
  - `gif.urls.silent`: explicitly silent MP4
  - `gif.hasAudio`: whether the source contains audio
  - `gif.hls`: whether the player uses HLS internally
- In the inspected example, `hasAudio` was `true`, `hls` was `true`, and both HD and SD MP4 URLs were available.

Therefore, the extension should **not** collect `.m4s` requests or reconstruct HLS playback. It should resolve metadata on demand and pass `urls.hd`—falling back to `urls.sd`—to Firefox's downloads API. The silent URL must never be selected unless a future user option explicitly asks for it.

## 3. Scope

### Version 1 scope

- Firefox desktop.
- Old Reddit listings and post pages.
- Current Reddit listings and post pages.
- Redgifs links using common `watch` and `ifr` URL forms and known Redgifs subdomains.
- An extension toolbar popup that scans the active tab on demand.
- A compact list ordered by page position, with currently visible posts first when practical.
- Each item displays post title, creator username, provider, subreddit when available, and one Download action.
- Dynamically loaded posts and client-side navigation are naturally reflected the next time the popup scans.
- Default download: HD MP4 with audio when available, otherwise SD MP4.
- Default filename: `{post creator username} - {post title}.mp4`, safely sanitized.
- Clear per-item progress and error states in the popup.
- A small options page for quality and save-dialog preferences.
- No external backend, analytics, accounts, or browsing-history collection.

### Explicitly out of scope for version 1

- Native Reddit `v.redd.it` video. Its audio/video streams may require muxing and should be a separate provider milestone.
- Combining HLS/DASH fragments in the extension.
- Bulk-download or automatic background downloads.
- Firefox for Android.
- Chromium publication, although the architecture and build tooling should leave a straightforward path to it.

## 4. Recommended technology choices

- **WXT with vanilla TypeScript** for browser-specific builds, generated manifests, packaging, and content/background entry points.
- **Manifest V3** for the Firefox build.
- **Vitest** for unit and contract tests, using WXT's fake-browser support.
- **DOM fixture tests** with a browser-like test environment for Reddit adapters.
- **`web-ext lint`** against the packaged Firefox artifact before release.
- TypeScript `strict` mode and a small runtime schema validator for external API responses.

Avoid a UI framework initially. The popup is a small list with straightforward states, so framework overhead is unnecessary. UI components can be plain DOM functions with isolated CSS.

Firefox currently uses MV3 background scripts/event pages rather than extension service workers. WXT should generate the appropriate Firefox form, but the emitted manifest must be inspected in CI so a Firefox build never accidentally contains only `background.service_worker`.

## 5. Architecture

```text
User opens extension toolbar popup
  -> Popup identifies the active tab
  -> tabs.sendMessage requests an on-demand page scan
  -> Reddit content script selects a SiteSurfaceAdapter
  -> SiteSurfaceAdapter returns PostContext objects in page order
  -> ProviderRegistry matches supported outbound URLs
  -> Popup renders recognizable MediaListItem rows
  -> User clicks one row's Download action
  -> runtime message sends ResolveAndDownloadCommand
  -> Background DownloadCoordinator selects provider
  -> RedgifsProvider resolves metadata and variants
  -> VariantPolicy selects HD-with-audio, then SD-with-audio
  -> BrowserDownloadGateway starts the Firefox download
  -> result message updates the popup item state
```

The content script owns read-only DOM discovery. The popup owns presentation and selection. The background entry point owns network access, provider resolution, permissions, token caching, and downloads. This keeps cross-origin requests out of MV3 content scripts, avoids injecting controls into Reddit, and makes provider behavior independently testable.

### 5.1 Core domain contracts

```ts
type ProviderId = string;

interface MediaReference {
  providerId: ProviderId;
  canonicalId: string;
  sourceUrl: string;
}

interface MediaVariant {
  id: string;
  url: string;
  container: 'mp4' | 'webm' | 'unknown';
  quality?: 'hd' | 'sd' | 'original' | 'unknown';
  width?: number;
  height?: number;
  hasAudio: boolean | 'unknown';
  isSilentVariant: boolean;
}

interface ResolvedMedia {
  reference: MediaReference;
  title?: string;
  durationSeconds?: number;
  variants: MediaVariant[];
  metadata: Record<string, unknown>;
}

interface MediaProvider {
  readonly id: ProviderId;
  readonly requiredOrigins: string[];
  match(url: URL): MediaReference | null;
  resolve(reference: MediaReference, context: ResolveContext): Promise<ResolvedMedia>;
}
```

Providers return normalized variants; they do not call the browser download API and do not manipulate Reddit. Core code applies the same selection, filename, logging, retry, and error policies to every provider.

### 5.2 Site-surface contract

```ts
interface PostContext {
  surfaceId: string;
  postId: string;
  outboundUrls: URL[];
  title?: string;
  author?: string;
  subreddit?: string;
  thumbnailUrl?: string;
  documentOrder: number;
  isVisible: boolean;
}

interface SiteSurfaceAdapter {
  readonly id: string;
  matchesPage(location: Location): boolean;
  discover(root: ParentNode): PostContext[];
}

interface DetectedMediaItem {
  itemId: string;
  reference: MediaReference;
  post: {
    postId: string;
    title?: string;
    creator?: string;
    subreddit?: string;
    thumbnailUrl?: string;
  };
  documentOrder: number;
  isVisible: boolean;
}
```

Create separate `OldRedditAdapter` and `CurrentRedditAdapter`. DOM selectors and metadata extraction rules must stay inside these adapters. Provider and popup code must never contain Reddit selectors.

`PostContext` is internal to the content script. Before responding to the popup, convert it into serializable `DetectedMediaItem` objects; never send DOM elements or `URL` instances across extension messaging.

### 5.3 Registry and extension points

Use an explicit registry rather than conditionals scattered through the code:

```ts
const providers: MediaProvider[] = [redgifsProvider];
const surfaces: SiteSurfaceAdapter[] = [oldRedditAdapter, currentRedditAdapter];
```

Adding a provider should require:

1. A provider folder implementing `match` and `resolve`.
2. Provider response fixtures and contract tests.
3. Registration in the provider catalog.
4. Provider-specific optional host permissions.
5. A documentation entry.

It should not require changes to Reddit adapters, popup list components, variant selection, or the download gateway.

## 6. Proposed source layout

```text
entrypoints/
  background.ts
  reddit.content.ts
  popup/
    index.html
    main.ts
    style.css
  options/
    index.html
    main.ts

src/
  core/
    domain/
      media.ts
      errors.ts
      messages.ts
    application/
      providerRegistry.ts
      resolveAndDownload.ts
      variantPolicy.ts
      filenamePolicy.ts
    infrastructure/
      browserDownloadGateway.ts
      extensionHttpClient.ts
      settingsRepository.ts
      permissionGateway.ts
      logger.ts

  providers/
    catalog.ts
    redgifs/
      index.ts
      match.ts
      resolver.ts
      tokenManager.ts
      schema.ts
      errors.ts

  surfaces/
    catalog.ts
    reddit/
      scanActivePage.ts
      oldRedditAdapter.ts
      currentRedditAdapter.ts

  popup/
    controller.ts
    mediaList.ts
    mediaListItem.ts
    emptyState.ts
    errorState.ts

  shared/
    sanitize.ts
    result.ts
    assertNever.ts

tests/
  fixtures/
    reddit-old/
    reddit-current/
    redgifs/
  unit/
  contract/
  integration/
```

## 7. Redgifs provider design

### 7.1 URL matching

Normalize the hostname and support at least:

- `https://redgifs.com/watch/<id>`
- `https://www.redgifs.com/watch/<id>`
- `https://www.redgifs.com/ifr/<id>`
- Known Redgifs aliases/subdomains observed in Reddit links.

The matcher should:

- Reject unrelated paths and invalid IDs.
- Normalize the ID to lowercase for lookups while retaining the service-provided casing for filenames if useful.
- Strip query strings and fragments.
- Return a canonical `MediaReference` without making a network request.

### 7.2 Metadata resolution

The resolver runs only after an explicit Download click:

1. Obtain a temporary Redgifs bearer token when required.
2. Cache the token in memory with its expiry; persist only if there is a demonstrated need.
3. Deduplicate concurrent token requests with a shared promise.
4. Fetch the single-GIF metadata endpoint for the canonical ID.
5. Validate only the fields the extension uses rather than trusting the complete external object.
6. Convert `urls.hd`, `urls.sd`, and `urls.silent` into normalized variants.
7. Copy `hasAudio`, dimensions, duration, and ID into normalized metadata.
8. On `401`, invalidate the token and retry once. Do not retry indefinitely.

The Redgifs API used by its web player is not a stable public contract. Keep endpoint construction, authorization, response validation, and retry behavior entirely inside `providers/redgifs` so a future API change is localized.

### 7.3 Variant policy

Default selection order:

1. HD MP4 where `isSilentVariant === false` and audio is available.
2. SD MP4 where `isSilentVariant === false` and audio is available.
3. HD non-silent MP4 when audio status is unknown.
4. SD non-silent MP4 when audio status is unknown.

If `hasAudio` is explicitly `false`, download the best non-silent variant but surface “source has no audio” in the UI. Never silently substitute `urls.silent` for a media file that is expected to have audio.

### 7.4 Download behavior

Call `browser.downloads.download` with:

- The selected direct media URL.
- `conflictAction: 'uniquify'`.
- `saveAs` from user settings.
- A sanitized default filename: `<creator username> - <post title>.mp4`.

Filename examples and fallbacks:

- Normal: `example_user - Valencia celebrating the World Cup win.mp4`
- Missing title: `<creator username> - <provider>-<media-id>.mp4`
- Missing creator: `unknown - <post title>.mp4`
- Missing both: `<provider>-<media-id>.mp4`

Strip a leading `u/` from the username, turn Reddit's `[deleted]` author into `unknown`, decode/normalize the displayed title, and preserve the `.mp4` extension. If an options-page filename template is added later, the requested creator-title form remains the default.

Remove reserved filesystem characters, emoji, invisible/control characters, and leading or trailing dots/spaces from download filenames while retaining ordinary Unicode letters and numbers. Collapse whitespace, protect Windows reserved names, enforce a conservative total length, and never allow `..` path traversal. Display titles remain untouched. Let Firefox add a numeric suffix through `conflictAction: 'uniquify'` when two posts produce the same filename. If the CDN returns `403`, refetch metadata once to obtain a fresh URL, optionally retrying with a Redgifs referer only if testing proves it necessary.

## 8. Reddit integration

### 8.1 On-demand detection

Each surface adapter should extract outbound URLs from stable post-level attributes or link elements. It should not inspect or depend on the internals of cross-origin Redgifs iframes.

The content script should remain lightweight and wait for a `scan-active-page` message. On receipt it selects the matching surface adapter, scans the current DOM once, matches outbound URLs through the provider registry's pure matchers, and returns serializable media-list items. It makes no provider API calls and modifies no page elements.

Deduplicate by `providerId + canonicalId + postId`. If the same media appears in separate posts, retain separate rows because creator/title context may differ. Sort currently visible posts first, then remaining posts in document order.

### 8.2 Dynamic pages and freshness

Do not maintain a continuous `MutationObserver` in version 1. Every popup opening requests a fresh scan, so posts added by infinite scrolling or client-side navigation are naturally included. Add a manual Refresh action inside the popup for the uncommon case where the page changes while the popup remains open.

This is intentionally simpler than persistent observation. A lightweight observer or action-icon badge may be added later only if user testing shows that live counts materially improve usability.

### 8.3 Toolbar popup UX

Use Firefox's Manifest V3 `action.default_popup`. When opened, the popup queries the active tab and sends `scan-active-page` to its Reddit content script. The popup should be approximately 380–460 CSS pixels wide and allow scrolling for long lists.

Each media row should contain:

- Optional small thumbnail already represented by the Reddit post; otherwise a provider icon placeholder.
- Post title as the dominant text, wrapping to at most two lines.
- `u/<creator>` and `r/<subreddit>` as secondary context when available.
- Provider label, such as Redgifs.
- One clearly labeled Download button.

Do not prefetch Redgifs metadata for every row merely to show quality/audio badges. The user's configured preference can be summarized as “HD + audio preferred”; resolve actual availability only when that row is clicked.

Popup states:

- `scanning`: Finding supported videos…
- `empty`: No supported videos are loaded on this page.
- `ready`: List of detected videos.
- Per item `resolving`: Resolving…
- Per item `starting-download`: Starting…
- Per item `started`: Download started.
- Per item `error`: Retry with a short explanation.

Disable repeated clicks for an active row but leave other rows usable. Preserve the list after a successful download so downloading a second video requires only one additional click. Support keyboard navigation and focus the first Download button when results appear.

### 8.4 Click-count decision

The recommended default is a consistent two-click flow: open the toolbar popup, then click the chosen video's Download action. This is one click more than an injected per-post button, but it is easier to discover as a single extension feature, avoids cluttering Reddit, is more resilient to UI changes, and gives clearer confirmation of which creator/title will be used.

Defer these optional accelerators until after usability testing:

- Download immediately when exactly one supported video is detected.
- A Download all action.
- Keyboard shortcut to open the popup.

They can reduce clicks but introduce surprise, accidental downloads, or more permissions/complexity.

## 9. Messaging and lifecycle

Define a versioned message union shared by content and background code:

```ts
type ExtensionMessage =
  | { version: 1; type: 'scan-active-page'; requestId: string }
  | { version: 1; type: 'resolve-and-download'; requestId: string; reference: MediaReference; post: PostMetadata }
  | { version: 1; type: 'get-settings' }
  | { version: 1; type: 'permission-status'; providerId: string };
```

The popup obtains the active tab and uses `tabs.sendMessage` for `scan-active-page`. It uses `runtime.sendMessage` to send the selected item's `resolve-and-download` command to the background entry point. Every response should use a serializable result envelope with a stable error code. Do not pass DOM nodes, raw exceptions, or external API responses across boundaries.

Because Firefox MV3 background pages are non-persistent, do not rely on mutable global state for correctness. Token caches may be lost safely; active commands must be self-contained, and settings must live in `browser.storage.local`.

## 10. Permissions and privacy

Initial permissions:

- `downloads`
- `storage`
- Reddit host access for the content script
- Redgifs API/media host access required by the resolver and download flow

Do not request `tabs`, `<all_urls>`, `cookies`, or `webRequest` for version 1 unless implementation testing establishes a concrete need. The discovered Redgifs JSON makes request interception unnecessary.

For future providers, maintain provider-specific origin requirements in the provider catalog and prefer `optional_host_permissions`. Request a provider's origins as a direct consequence of the user's first download action or explicit enablement. Explain why access is needed before requesting it.

Privacy promises:

- No analytics or telemetry by default.
- No external extension backend.
- No passive API requests while scrolling.
- Only the selected media ID and required request metadata go to the original media host after an explicit click.
- No storage of Reddit browsing history, post lists, usernames, media URLs, or downloaded-content history.
- Private-window behavior must be tested; do not persist private-session data.

## 11. Testing strategy

### 11.1 Unit tests

- Redgifs URL matcher and normalization.
- Runtime schema validation with valid, missing-field, malformed, and changed-type fixtures.
- Variant selection, especially exclusion of the silent URL.
- Default `{creator} - {title}.mp4` formatting; missing creator/title fallbacks; reserved names, Unicode, long titles, duplicates, and traversal attempts.
- Token cache, concurrent requests, expiry, and one-time `401` retry.
- Error normalization.

### 11.2 Provider contract tests

Store redacted JSON fixtures representing:

- HLS playback with HD/SD/silent MP4 URLs and `hasAudio: true`.
- A silent source.
- Missing HD but available SD.
- Deleted/unpublished media.
- Missing or renamed fields.

Contract tests must assert that providers emit normalized `ResolvedMedia`; they should not expose provider-specific JSON to core code.

### 11.3 DOM adapter tests

Use saved, minimal HTML fixtures rather than full copied Reddit pages:

- Old Reddit normal link post.
- Old Reddit with RES expando open and closed.
- Current Reddit post.
- Non-Redgifs post.
- Multiple posts, recycled nodes, and dynamically appended posts.
- Missing creator, title, thumbnail, subreddit, or outbound-link fields.

Assert correct detection and serialization, stable document ordering, visible-first ordering when implemented, deduplication, no DOM mutation, and no API calls during scanning.

### 11.4 Integration tests

With fake browser APIs:

- Popup -> active-tab query -> `tabs.sendMessage` -> serialized media list.
- Selected popup item -> provider resolution -> policy -> filename -> `downloads.download`.
- Permission denied and later granted.
- Duplicate click suppression per popup item while other items remain usable.
- Popup empty, scanning, success, error, and refresh states.
- Background restart between independent commands.
- CDN failure followed by one metadata refresh.

### 11.5 Manual Firefox acceptance matrix

Test signed or temporarily installed builds on:

- Old Reddit listing, subreddit, user page, and post page.
- Current Reddit listing and post page.
- RES absent, enabled with expando closed, and enabled with expando open.
- Popup with zero, one, and many supported videos.
- Infinite scrolling/client navigation followed by popup reopen or Refresh.
- Long and similar titles, deleted authors, duplicate creator/title pairs, and keyboard-only operation.
- Source with audio, source without audio, HD missing, deleted source, and offline mode.
- “Always ask where to save” enabled and disabled.
- Private window if the extension is permitted there.

Inspect the actual downloaded file with a media probe during development to verify that the HD selection contains an audio stream when `hasAudio` is true.

## 12. Delivery phases

### Phase 0 — Scaffold and decisions (0.5 day)

- Create WXT TypeScript project and Firefox MV3 build.
- Enable strict TypeScript, linting, formatting, and Vitest.
- Add an extension ID placeholder and build scripts.
- Record defaults: toolbar popup, HD-first, creator-title filename, `saveAs: false`, no prefetching, no telemetry.
- Verify emitted Firefox manifest uses a supported background script/event-page form.

Exit criterion: empty extension loads in Firefox, content/background messaging test passes, and packaged artifact lints.

### Phase 1 — Core contracts and registry (0.5–1 day)

- Implement media/provider/surface contracts.
- Implement provider registry, messages, errors, variant policy, filename policy, settings, and download gateway.
- Add unit tests before provider-specific work.

Exit criterion: a fake provider can resolve and trigger a mocked download without any Reddit or Redgifs code.

### Phase 2 — Popup and old Reddit scanning MVP (0.5–1 day)

- Implement the toolbar popup, active-tab request flow, `OldRedditAdapter`, and on-demand scan handler.
- Render creator/title/provider rows with accessible per-item Download actions using a fake provider.
- Validate with RES enabled and disabled.

Exit criterion: opening the popup returns every supported old-Reddit post currently in the DOM exactly once, identifies it clearly, and the selected fake item reaches a mocked download.

### Phase 3 — Redgifs provider and real downloads (1–2 days)

- Implement matching, authentication/token manager, metadata resolver, schema validation, and mapping.
- Add captured response fixtures and failure cases.
- Connect the real provider to the background coordinator.
- Confirm HD MP4 and audio with multiple live examples.

Exit criterion: a Redgifs post downloads the HD MP4 with audio without opening the preview; SD fallback and errors work.

### Phase 4 — Current Reddit adapter (1 day)

- Implement a separate current-Reddit adapter.
- Verify on-demand scans after client-side navigation and infinite scrolling.
- Ensure no provider/core changes are required.

Exit criterion: the same Redgifs provider and background flow work on both Reddit surfaces.

### Phase 5 — Options and product polish (0.5–1 day)

- Add HD/SD preference, save-dialog preference, filename template, and provider enablement.
- Polish title/creator recognition, optional existing-page thumbnails, keyboard navigation, progress/error feedback, and onboarding/privacy text.
- Add localized strings from the beginning even if only English ships initially.

Exit criterion: settings persist, validate, and affect downloads without page reload surprises.

### Phase 6 — Hardening and release (1–2 days)

- Complete manual acceptance matrix.
- Run typecheck, unit/contract/integration tests, Firefox build, and `web-ext lint` in CI.
- Review permissions and remove anything unused.
- Prepare icons, AMO listing, privacy disclosure, source package, changelog, and support link.
- Submit a minimally permissioned beta before broad release.

Estimated total: **4–7 focused development days** for a robust Firefox release, excluding Mozilla review time. Removing per-post UI and persistent observation should reduce implementation and maintenance cost. A working old-Reddit/Redgifs popup MVP should be achievable in roughly **1.5–2.5 days**.

## 13. Definition of done for version 1

- Clicking the toolbar action opens a popup that lists supported media currently loaded in the active Reddit tab.
- Each matching post appears exactly once with its title, creator username, provider, and subreddit when available.
- Rows follow a predictable visible-first/page-order sequence and remain usable when optional metadata is missing.
- Selecting a row downloads that item without requiring its Reddit/RES preview to be opened.
- It works with and without RES and before the preview is opened.
- No provider metadata request occurs until the user clicks Download.
- The default filename is `{post creator username} - {post title}.mp4`, with safe, tested fallbacks.
- Redgifs HD MP4 is preferred; SD is a tested fallback; the silent variant is not accidentally chosen.
- `hasAudio: true` produces a downloaded file with an audio stream in acceptance testing.
- HLS and `.m4s` playback requests are ignored.
- Reopening or refreshing the popup reflects infinite-scroll and navigation changes without duplicate items.
- Provider/network errors are recoverable and understandable.
- Adding a fixture provider requires no modifications to Reddit adapters or the download coordinator.
- No unnecessary broad permissions, remote code, analytics, or backend service is present.
- Firefox package passes automated tests and Mozilla's extension linter.

## 14. Highest risks and mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Redgifs changes its internal API | High | Isolate endpoint/token/schema code; validate responses; retain fixtures; fail clearly; release provider-only fixes. |
| Reddit changes its DOM | Medium | Popup UI is extension-owned; isolate only metadata extraction in surface adapters; prefer stable attributes and focused fixtures. |
| CDN rejects a direct download | Medium | Refresh metadata once; verify referer requirements; never loop retries. |
| Firefox MV3 background differences | Medium | WXT browser-specific build; emitted-manifest assertion; state-independent commands. |
| New providers increase permissions | Medium | Provider origin catalog and optional permissions; never move to `<all_urls>`. |
| Filename contains unsafe/path characters | Medium | Centralized sanitizer, conservative lengths, and traversal tests. |

## 15. Recommended defaults and deferred decisions

Recommended defaults:

- Quality: HD, then SD.
- Audio: require non-silent variant; inform when the source itself has no audio.
- Save behavior: honor Firefox's configured download-directory behavior (`saveAs: false`).
- Filename: `{post creator username} - {post title}.mp4`, sanitized and uniquified.
- Detection: scan the active tab when the toolbar popup opens; include all enabled providers; resolve metadata only after a row's Download action is clicked.
- Redgifs permission: requested narrowly and explained if implemented as optional.
- UI: compact toolbar popup; title is primary, creator/subreddit/provider are secondary, and every row has one obvious Download action.
- Click model: consistent two-click flow; no automatic download when merely opening the popup.

Decisions that can wait until product polish:

- Final extension name and visual identity.
- Whether a row offers a quality chooser or immediately uses the preferred quality.
- Whether to offer one-click auto-download when exactly one video is detected after usability testing.
- Whether to add Download all after accidental-download and confirmation behavior are designed.
- Whether to expose a “copy media URL” secondary action.
- Whether Chromium packaging ships after Firefox version 1.
- Which provider comes second; it should be selected to validate the provider contract rather than because it happens to resemble Redgifs.

## 16. References

- [Firefox WebExtension anatomy](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Anatomy_of_a_WebExtension)
- [Firefox content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [Firefox toolbar action and popup](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/action)
- [Firefox popup-to-content-script messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/sendMessage)
- [Firefox MV3 background configuration](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Firefox downloads API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download)
- [Firefox permissions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions)
- [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [Mozilla `web-ext` build/signing workflow](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)
- [WXT browser-extension framework](https://wxt.dev/)
- [WXT Firefox/browser targeting](https://wxt.dev/guide/essentials/target-different-browsers)
- [WXT unit testing](https://wxt.dev/guide/essentials/unit-testing)
- [RES Redgifs iframe behavior](https://github.com/honestbleeps/Reddit-Enhancement-Suite/issues/5233)
