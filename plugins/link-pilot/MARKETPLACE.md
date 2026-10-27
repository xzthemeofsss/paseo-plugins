# Marketplace submission

Submitted through the official form on 2026-10-27: [submission #1264](https://github.com/getpaseo/plugins/issues/1264), [registry review #1265](https://github.com/getpaseo/plugins/pull/1265). The original artifact was approved and merged. The English-only listing correction needs a new reviewed commit before it reaches the registry.

## Form fields

**Title:** Link Pilot

**Source:** https://github.com/xzthemeofsss/paseo-plugins/tree/ef46ba62a203c89c0d160551a98008d32fed9d07/plugins/link-pilot

**Git reference:** `ef46ba62a203c89c0d160551a98008d32fed9d07`

**Category:** Utils

The submission selects this exact commit. The source PR targets `main`; the submitted artifact remains usable before merge.

## Listing material

- Name: Link Pilot
- Description: `paseo-plugin.json`
- Overview: `OVERVIEW.md`
- Keep the title, description and overview in English for every listing locale. Do not add manifest listing translations or translated overview files. Runtime settings, commands and errors remain localized.
- Icon: `assets/icon.png`
- Actual interface images: `assets/settings.en.png`, `assets/settings.zh-CN.png`, `assets/settings.dark.en.png`

Submitted image URLs:

- https://raw.githubusercontent.com/xzthemeofsss/paseo-plugins/ef46ba62a203c89c0d160551a98008d32fed9d07/plugins/link-pilot/assets/settings.en.png
- https://raw.githubusercontent.com/xzthemeofsss/paseo-plugins/ef46ba62a203c89c0d160551a98008d32fed9d07/plugins/link-pilot/assets/settings.zh-CN.png
- https://raw.githubusercontent.com/xzthemeofsss/paseo-plugins/ef46ba62a203c89c0d160551a98008d32fed9d07/plugins/link-pilot/assets/settings.dark.en.png

## Reviewer notes

- Runtime plugin ID: `link-pilot`; package version: `0.1.0`.
- Requires app and daemon 0.13.x. The click interceptor runs only in the desktop app. The native settings contribution also works on browser web.
- One active host installation per app. Its settings apply to chat links across connected hosts.
- No preparation command, runtime npm dependencies, lifecycle scripts, downloads of software, or subprocess execution. Paseo provides the runtime libraries.
- Host settings use `defineSettings` / `registerSettings` / `useSettings`. Clicks read the public settings RPC before choosing a destination.
- External links use the public `openExternalUrl` API. Source-pane browser placement uses checked private app exports. The client fetches only its own same-origin app bundle to locate those exports; it does not evaluate the fetched text.
- The plugin reads clicked URLs/labels and workspace/pane context. It sends no agent messages and adds no telemetry or external service. Chosen URLs are visited by the selected browser.
- A dismissible error is shown if an intercepted action fails. An unavailable adapter keeps native link handling active.

## Validation, 2026-10-27

- Typecheck and lint pass.
- Two translation tests pass. All 9 Paseo locales have complete resource keys. A mounted React fixture and the SDK’s actual translation runtime verify live language changes for settings text, registered titles, command labels and transient errors without remounting.
- 46 link integration tests pass against the installed macOS Paseo 0.13.0 Markdown renderer and pure routing/file-classification modules. Controlled browser stores verify the source pane and both destinations for click and Command/Ctrl-click.
- Settings were saved in the real client, survived a page reload, and remain saved after simplifying the page to its two destination selectors. English, Chinese and dark-theme settings were checked in the official web client against the local 0.13.0 daemon. Images are raw screenshots of that settings page.
- Local installation loads as `running`; the earlier `in-app-links` prototype is disabled.
- Package dry run includes runtime entries, local imports, overviews and declared images, with no installed development dependencies.
- Windows/Linux desktop operation, compact/mobile settings layout, and a physical Command-click after this configuration change have not been separately verified. Gesture behavior is covered by the integration fixtures; the earlier local in-app opening fix was confirmed by the user before this release preparation.

Listing updates require a new pinned commit and registry review. Uploading the source PR does not update the published listing.
