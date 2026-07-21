# Contributing and releases

## Branches

`master` is the released branch. Changes reach it only through a reviewed pull request from a version
branch named `release/vX.Y.Z`.

Create ordinary topic branches from the active version branch and open their pull requests back into
that version branch. Recommended names include `fix/permission-setup`, `feature/provider-name`, and
`docs/testing-guide`. For a small release, collaborators may commit directly to the version branch.

## Preparing a version branch

The version branch is the release proposal. Before its final pull request into `master`, it must:

1. Contain every intended code, test, and documentation change.
2. Set the same `X.Y.Z` version in `package.json` and `package-lock.json`.
3. Add a `CHANGELOG.md` section headed `## X.Y.Z (YYYY-MM-DD)`.
4. Curate the user-relevant items under `### Notable changes`.
5. Pass `npm run verify` and the signed-extension manual test relevant to the changes.

This is a lightweight version of Node.js's release-proposal model: changes accumulate on a version
line, the final version commit contains curated release notes, and the exact reviewed merge becomes
the tagged release.

## Publishing

Pushing `release/vX.Y.Z` starts the Release proposal workflow. It validates the branch metadata and
opens the final pull request into `master` as `github-actions[bot]` if one is not already open. The
bot authorship lets the repository owner review and approve the pull request; GitHub does not allow
authors to approve their own pull requests. Later topic merges update the same release pull request.

CI verifies the source branch, version increase, lockfile, changelog, and package. After the required
review, merging it starts the protected `firefox-publishing` deployment.

Once approved, GitHub Actions verifies the merge again, submits the extension and source archive to
Mozilla, creates tag `vX.Y.Z` and the GitHub Release with the curated changelog, uploads the release
assets, and refreshes the Firefox update feed. The pull-request review is the normal human release
gate; no post-merge approval is needed when the publishing environment has no required reviewer. Do
not create the stable tag manually.
