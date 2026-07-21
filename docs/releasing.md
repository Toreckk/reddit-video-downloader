# Releasing

## Release policy

The public channel policy is stored in `release.config.json`:

- Stable versions below `1.0.0` are signed on Mozilla's unlisted channel and distributed from GitHub.
- Release candidates are always unlisted and use a separate prerelease update manifest.
- Stable versions beginning with `1.0.0` are submitted to the public AMO listing.
- Every channel uses Firefox extension ID `reddit-video-downloader@toreckk`.

## Version branches

`master` contains released versions only. Prepare each stable release on `release/vX.Y.Z`.

Topic branches may be merged into the active version branch. Before opening the final release pull
request, update `package.json`, `package-lock.json`, and `CHANGELOG.md`. The changelog section must be
headed `## X.Y.Z (YYYY-MM-DD)` and include `### Notable changes`.

Pushing `release/vX.Y.Z` makes `.github/workflows/release-proposal.yml` validate the proposal and open
its pull request to `master` as `github-actions[bot]`. Later topic merges update the existing pull
request. The bot authorship allows the repository owner to approve it; GitHub does not count an
author's approval on their own pull request.

CI rejects another source-branch name, a non-increasing or reused version, mismatched lockfile
metadata, or missing notable changes. Protect `master` with pull-request, collaborator approval,
Code Owner review, and the required `verify` check.

## Stable publication after merge

Merging the release pull request starts `.github/workflows/release.yml`:

1. Read and validate the merged package version and changelog.
2. Skip publication if tag `vX.Y.Z` already exists.
3. Read the Mozilla credentials from the `firefox-publishing` GitHub environment.
4. Run the complete verification suite and create the Firefox and source archives.
5. Create a draft GitHub Release at the exact merge commit with the review and source archives.
6. Submit the extension and source archive to Mozilla once, without waiting in the runner for review.
7. Start `.github/workflows/firefox-release-finalizer.yml` immediately and poll Mozilla for up to 30
   minutes.
8. When Mozilla marks an unlisted file public, download and verify the signed XPI, attach it to the
   draft, publish the tag and GitHub Release, and refresh the GitHub Pages update manifests.

The draft release is the durable handoff between submission and signing, so Mozilla reviews may take
hours or days without losing release state. No scheduled Actions run between releases. If approval
takes longer than 30 minutes, the finalizer fails without losing the draft; after Mozilla approval,
use **Re-run failed jobs** on that run or start **Actions -> Firefox release finalizer -> Run
workflow**. The finalizer is idempotent and never submits a version again. Do not rerun the original
submission workflow after Mozilla accepted a version.

If validation fails before Mozilla accepts the version, inspect the Release workflow and the draft.
Fix the version branch, advance to a new version when Mozilla already owns the failed version number,
and submit a new release pull request. Delete an abandoned draft only after confirming that its AMO
submission will not be completed.

For unattended stable publication, keep the Mozilla secrets in `firefox-publishing` but do not set a
required reviewer on that environment. The reviewed pull request is the human release gate. Restrict
environment deployments to the `master` branch; optionally allow `release/v*` branches if signed
release candidates will be used. Adding a required environment reviewer intentionally changes every
publication back into a manual approval flow.

## Release candidates

Open **Actions → Firefox prerelease → Run workflow** from the active version branch, then provide:

- `target_version`: the upcoming stable version, for example `1.0.0`.
- `rc_number`: the human-facing candidate number, for example `1`.

This workflow is optional and is not part of an ordinary stable release. It signs an unlisted
candidate, creates a GitHub prerelease, and updates the prerelease feed. GitHub tags retain a SemVer
label such as `v1.0.0-rc.1`; Firefox receives a compatible four-part numeric package version based on
the version currently in `master`, keeping it lower than the upcoming stable version.

## Required secrets

The `firefox-publishing` GitHub environment contains:

- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

Never commit these values or place them in command output. Local credential files are ignored by Git.

## Self-hosted updates

GitHub Pages publishes:

- `https://toreckk.github.io/reddit-video-downloader/updates.json`
- `https://toreckk.github.io/reddit-video-downloader/prerelease-updates.json`

The manifests combine signed XPI assets from non-draft GitHub Releases with public listed versions
returned by AMO. Pages refreshes after releases and every six hours. Once AMO approves the first
listed `1.0.0`, the stable feed bridges existing self-distributed `0.x` installations to it; later
updates are handled directly by AMO.
