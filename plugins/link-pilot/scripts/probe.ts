import assert from "node:assert/strict";
import { bundlePath, chunk, ids, nativePureModules, source } from "./native";

nativePureModules();
assert.match(chunk(ids.browser), /\.createWorkspaceBrowser=function\(/);
assert.match(chunk(ids.navigation), /\.navigateToWorkspace=function\(/);
assert.match(chunk(ids.browser), /return\{browserId:[^,]+,url:/);
for (const marker of [
  'testID:"assistant-message"',
  '"data-testid":"agent-chat-scroll"',
  "`workspace-pane-${",
  "`workspace-tab-${",
])
  assert.ok(source.includes(marker), marker);
console.log(
  JSON.stringify(
    {
      bundle: bundlePath,
      semanticModules: ids,
      syncBrowserAndNavigation: true,
      nativeDOMMarkers: true,
      pureContractsLoaded: true,
    },
    null,
    2,
  ),
);
