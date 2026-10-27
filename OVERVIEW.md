# Codex Style Annotations

Add selected text from a chat, file, Markdown preview, Diff, or terminal to a Paseo conversation with your comments. Keep several annotations in a compact draft capsule, review them, and send them together.

## Add the text you want the agent to use

1. Select a passage, code, or terminal output.
2. Choose **Add to chat** and write your comment.
3. Send the draft through Paseo's normal message controls when it is ready.

Adding an annotation does not send a message. For workspace selections, the toolbar names the receiving chat and defaults to the most recently focused conversation in that workspace. Use the arrow to choose another chat, even when its composer is closed.

Closing a new comment without entering text removes the annotation. The same applies if you erase everything or leave only whitespace. To remove an existing annotation, delete it directly or clear its comment and save. Canceling an edit keeps the saved annotation.

## Review annotations and ask side questions

Open the draft capsule to review selected text, edit comments, or remove entries. Return to the source while its position is still available. Saved text remains readable when the original location no longer matches.

Sent annotations stay in a compact capsule. Open it to read or copy the complete text. Sent annotations are read only.

For chat selections, **Ask in side chat** opens a child conversation with the parent's provider, model, mode, and thinking level. It receives the selection, the source message when available, and up to eight recent main-chat turns. Continue in the side panel or open the child as a chat tab. Side questions from file, Markdown, Diff, and terminal selections are not supported.

## Settings and requirements

Requires Paseo 0.11.4 or later with native plugin Settings support. Disable the original `quote` plugin before enabling this plugin. Existing `quote` annotations remain readable. No additional account or token is required.

Open **Settings > Plugins > Codex Style Annotations > Annotation types** to enable or disable capture from chat, files, Markdown, Diffs, and terminals separately. All five start enabled. These settings affect new annotations and belong to the host installation.

Settings, the selection toolbar, and the side-question editor follow Paseo's English or Chinese language setting. Some annotation popovers still use Chinese labels, including the comment edit card and annotation summaries.

## Data access and limits

The plugin runs as trusted code. It reads selections, source context, same-workspace agents and drafts, sent attachments, and settings. Side questions also read recent conversation text. Annotations use Paseo's native draft store. Sending a draft or side question sends its content through your configured agent provider.

Copy controls write to the clipboard. Capture does not read the clipboard or send input to the terminal. The plugin adds no external backend and installs no software at runtime. Disabling it preserves saved annotations and restores native attachment cards.

File capture accepts one continuous range. Diff capture accepts one continuous range from one file and side. Markdown capture keeps rendered text without inferred source lines. Edits, changed comparison refs, terminal output, resizing, or reload can invalidate source navigation. Browser-page capture is not supported.

Resolve unconfirmed saves or deletions before reloading or disabling the plugin. Retry text lives only in memory. The plugin uses private app adapters, so Paseo updates can require compatibility fixes. Full browser and mobile clients have not been independently verified. Mobile platforms use their system selection menu.
