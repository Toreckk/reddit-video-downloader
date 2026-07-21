# Releasing

## Release policy

The public policy is stored in `release.config.json`.

- Stable versions below `1.0.0` are signed on Mozilla's unlisted channel and distributed from GitHub.
- Release candidates are always unlisted and use a separate prerelease update manifest.
- Stable versions beginning with `1.0.0` are submitted to the public AMO listing.
- The Firefox extension ID is `reddit-video-downloader@toreckk` for every channel.

Firefox manifest versions must contain only numbers and dots. GitHub RC tags retain familiar SemVer
labels such as `v1.0.0-rc.1`, while the packaged extension uses a four-part numeric version based on
the current stable release, such as `0.9.0.42`. The stable target remains newer according to Firefox's
version comparison.

## Stable releases

Release Please watches conventional commits on `master`:

- `fix:` proposes a patch release.
- `feat:` proposes a minor release.
- A conventional breaking-change marker proposes a major release.

Release Please maintains a release pull request. Merging it creates the Git tag and GitHub Release.
The Firefox publication job then waits for approval in the `firefox-publishing` environment. Its log
shows the resolved channel before any submission.

For an unlisted release, the job signs the package with Mozilla, uploads the signed XPI and source ZIP
to the GitHub Release, and refreshes the GitHub Pages update manifests. For a listed release, it
submits the package and sources to AMO and uploads the unsigned review archives to the GitHub Release.

## Release candidates

Open **Actions → Firefox prerelease → Run workflow**, then provide:

- `target_version`: the upcoming stable version, for example `1.0.0`.
- `rc_number`: the human-facing candidate number, for example `1`.

After approving the `firefox-publishing` environment, the workflow signs the unlisted package,
creates a GitHub prerelease, and updates the prerelease feed.

## Required secrets

The `firefox-publishing` GitHub environment contains:

- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

Never commit these values or place them in command output. `.env.submit` and local web-ext credential
configuration are ignored by Git.

## Self-hosted updates

GitHub Pages publishes:

- `https://toreckk.github.io/reddit-video-downloader/updates.json`
- `https://toreckk.github.io/reddit-video-downloader/prerelease-updates.json`

The manifests combine signed `.xpi` assets attached to non-draft GitHub Releases with public listed
versions returned by AMO. The canonical GitHub asset name is
`reddit-video-downloader-<numeric-version>.xpi`.

The Pages workflow refreshes every six hours. Once AMO approves the first listed `1.0.0` version, its
Mozilla-signed download is added to the stable feed automatically. This bridges existing
self-distributed `0.x` installations onto the listed release; `1.0.0` itself has no custom update URL,
so later updates are handled directly by AMO.
