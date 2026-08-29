# ProjectCollab development

ProjectCollab is currently a thin product distribution of Code - OSS. Keeping
the first changes limited to product configuration makes it easier to pull
security fixes and features from Microsoft while the product direction is
still being defined.

## Repository layout

- `origin`: `https://github.com/Nagendra080389/ProjectCollab.git` (ProjectCollab fork)
- `upstream`: `https://github.com/microsoft/vscode.git` (Microsoft source)
- `main`: a clean mirror of the upstream default branch
- `codex/projectcollab`: ProjectCollab development branch

Do product work on a ProjectCollab branch, not directly on `main`.

## Run a development build on macOS

Use the Node.js version in `.nvmrc` (currently Node 24). From the repository
root:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm install
npm run watch
```

Leave the watcher running. In a second terminal, launch the IDE:

```bash
./scripts/code.sh
```

The development app uses `ProjectCollab.app`, isolates its development data
from packaged releases, and registers `projectcollab://` as its URL protocol.
Packaged releases use `.projectcollab` for product data.

For an Apple Silicon production-style build:

```bash
npm run gulp vscode-darwin-arm64
```

## Delivery pipeline

ProjectCollab includes a built-in, workspace-scoped Delivery Center. Open it
from the Delivery activity view or run **Delivery: Open Delivery Center**. It
provides a visual dashboard, execution history, generated-artifact access, and
six durable stages:

1. Discover
2. Plan
3. Design
4. Build
5. Test
6. Release

Each stage can be connected to any existing VS Code task in the workspace. A
workspace can opt into automatic discovery by naming its tasks `Delivery:
Discover` through `Delivery: Release` and choosing **Set Up Workspace**. A
successful task records a run, marks the stage complete, refreshes generated
artifacts, and advances to the next incomplete stage; a failed task records the
failure and marks the stage blocked. Release tasks require an explicit
confirmation by default.

Use **Delivery: Work With Agent** to open agent mode with a stage-specific
brief, the configured verification task, and instructions to inspect and act
on the current workspace. Pipeline progress and task assignments are stored in
workspace state, so application source repositories are not modified merely by
using the Delivery view.

## Run the live demo

The reproducible demo workspace lives in `demo/projectcollab-delivery`. Open
that folder in ProjectCollab, open the Delivery Center, and choose **Set Up
Workspace**. Its dependency-free tasks generate discovery, planning,
architecture, build, test, and release evidence while delivering a runnable
collaboration dashboard.

Follow `demo/projectcollab-delivery/DEMO.md` for the six-minute presenter flow.

The built-in extension lives in `extensions/projectcollab-delivery`. Compile
and test it independently with:

```bash
npm run gulp -- compile-extension:projectcollab-delivery
node node_modules/mocha/bin/mocha.js \
  extensions/projectcollab-delivery/out/test/deliveryModel.test.js \
  --ui tdd
```

## Pull changes from Code - OSS

First refresh the clean `main` branch:

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

Then update the ProjectCollab branch:

```bash
git switch codex/projectcollab
git rebase main
git push --force-with-lease origin codex/projectcollab
```

Using `--force-with-lease` after a rebase protects the remote branch from
overwriting changes that are not present locally.

## Rebranding checklist before distribution

- Replace all temporary Code - OSS icons in `resources/` with ProjectCollab
  artwork for macOS, Windows, and Linux.
- Choose a permanent reverse-domain identifier and replace
  `com.projectcollab.ide` before signing a release.
- Decide on an extension registry. A downstream Code - OSS product should not
  assume access to the Visual Studio Marketplace; Open VSX is a common option.
- Add ProjectCollab privacy, telemetry, update, and issue-reporting services or
  explicitly disable the corresponding features.
- Set up reproducible builds, signing/notarization, release artifacts, and an
  update feed for every supported platform.
- Retain `LICENSE.txt` and applicable third-party notices from the upstream
  project.

The product identifiers are centralized in `product.json`. That file is the
first place to update if the working name changes.
