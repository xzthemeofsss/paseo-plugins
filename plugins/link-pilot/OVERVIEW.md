# Link Pilot

Choose where assistant chat web links open. Set ordinary click and Command-click independently to **In Paseo** or **System browser**. On Windows and Linux, use Ctrl-click.

By default, a click opens a browser tab in the pane containing the chat, and Command-click opens your system browser. You can reverse these choices or use the same destination for both gestures.

Enable the plugin on one host per app. Its saved preferences apply to chat links across connected hosts.

## Set your preferences

Open **Settings → Plugins → Link Pilot → Link behavior**, or find **Link Pilot settings** in Command Center. Preferences save automatically for the current host and apply on the next click. The interface follows Paseo's English or Simplified Chinese setting.

Requires the Paseo desktop app and daemon **0.13.x**. If the old local `in-app-links` prototype is enabled, disable it first. Browser web and mobile keep their normal link behavior.

## Link handling and data

The plugin handles HTTP(S) links in visible assistant chat messages. File links, downloads, user messages, other modifiers and middle-click keep their normal behavior. In-app links open in the source pane, including split workspaces.

It reads the clicked link and label, workspace and pane context, host preferences, and Paseo's own same-origin application bundle. Source-pane placement depends on private Paseo interfaces, which are checked at runtime and may require updates after a Paseo release. If the adapter is unavailable, normal link handling stays active.

Preferences are stored by the Paseo daemon. Opening a link contacts its destination through the chosen browser. The plugin adds no external backend or telemetry, sends no prompts or tool results to model providers, and installs no software while running. A settings or opening failure after interception shows an error without trying another destination.
