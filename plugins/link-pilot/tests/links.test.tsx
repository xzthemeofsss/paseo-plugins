import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createHost, resolveModuleIds, type BrowserHost } from "../client/host";
import { install } from "../client/web";
import { valuesSchema, type LinkPreferences } from "../shared/preferences";
import { ids, nativeLinkRenderer, nativePureModules, source } from "../scripts/native";

const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', {
  url: "https://paseo.test/",
});
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLAnchorElement",
  "MouseEvent",
] as const)
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
Object.defineProperty(dom.window.Element.prototype, "getClientRects", {
  value() {
    return this.closest("[data-invisible]") ? [] : [{ width: 100, height: 20 }];
  },
});
const root = createRoot(document.getElementById("root")!);
const pure = nativePureModules();
const NativeLink = nativeLinkRenderer();
const serverId = "remote host";
const workspaceId = "/project/编码 workspace";
const workspaceKey = "directory-key";
const route = `/h/${encodeURIComponent(serverId)}/workspace/b64_${Buffer.from(workspaceId).toString("base64url")}`;
let externalCalls = 0;
let settings = valuesSchema.parse({});
let settingsReader: () => Promise<LinkPreferences> = async () => settings;
const openedExternal: string[] = [];
function controller(discover: (signal: AbortSignal) => Promise<BrowserHost>) {
  return install({
    isWeb: true,
    discover,
    readPreferences: () => settingsReader(),
    openExternal: async (url) => {
      openedExternal.push(url);
    },
    errorText: () => ({ failure: "Link opening failed", dismiss: "Dismiss" }),
  });
}
let dispose = () => {};
let cleanup: (() => void)[] = [];
const oldError = console.error;
const oldWarn = console.warn;
const diagnostics: unknown[][] = [];
console.error = (...args: unknown[]) => {
  diagnostics.push(args);
};
console.warn = (...args: unknown[]) => {
  diagnostics.push(args);
};

function fixture(
  options: {
    href?: string;
    text?: string;
    unwrap?: boolean;
    download?: boolean;
    assistant?: boolean;
    invisible?: boolean;
    selectedAgent?: string;
    legacy?: boolean;
    inlineCode?: boolean;
  } = {},
) {
  const text = options.text ?? "Open docs";
  const onLinkPress = () => {
    externalCalls++;
  };
  const link = options.legacy ? (
    <a
      href={options.href ?? "https://example.com/docs"}
      style={{ display: "contents" }}
      data-paseo-markdown-unwrap={options.unwrap ? "true" : undefined}
      download={options.download ? "" : undefined}
      onClickCapture={(event) => event.preventDefault()}
    >
      <span
        role="link"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          if (!event.altKey) onLinkPress();
        }}
      >
        {text}
      </span>
    </a>
  ) : (
    <span>
      <NativeLink
        node={{
          attributes: {
            url: options.href ?? "https://example.com/docs",
            ...(options.unwrap ? { recognizedLink: "true" } : {}),
          },
          children: [{ type: options.inlineCode ? "Code" : "Text" }],
        }}
        style={{}}
        callbacks={{ onLinkPress }}
        capabilities={{
          renderers: {
            link: ({
              anchorProps,
              children,
            }: {
              anchorProps: React.ComponentProps<"a">;
              children: React.ReactNode;
            }) => (
              <a {...anchorProps} download={options.download ? "" : undefined}>
                {children}
              </a>
            ),
          },
        }}
        renderChildren={() => (options.inlineCode ? <code>{text}</code> : text)}
      />
    </span>
  );
  function pane(id: string, agentId: string, content: React.ReactNode) {
    return (
      <div data-testid={`workspace-pane-${id}`}>
        <button data-testid={`workspace-tab-agent_${agentId}`} aria-selected="true">
          Chat
        </button>
        <div
          data-testid="agent-chat-scroll"
          data-invisible={options.invisible ? "true" : undefined}
        >
          <div data-history-row-id="row" data-message-id="message">
            <div>
              <div data-testid={options.assistant === false ? "user-message" : "assistant-message"}>
                {content}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  act(() =>
    root.render(
      <>
        {pane("left", options.selectedAgent ?? "agent-left", link)}
        {pane("right", "agent-right", <span>Another chat</span>)}
      </>,
    ),
  );
}
function runtime(mac = true) {
  const panes = new Map(
    ["left", "right"].map((id) => [
      id,
      {
        id,
        focusedTabId: `tab-${id}`,
        tabs: [{ tabId: `tab-${id}`, target: { kind: "agent", agentId: `agent-${id}` } }],
      },
    ]),
  );
  const workspaces = new Map([
    [workspaceKey, { id: workspaceId, workspaceDirectory: "/project/root" }],
  ]);
  const agents = new Map(
    ["left", "right"].map((id) => [`agent-${id}`, { id: `agent-${id}`, workspaceId }]),
  );
  const directory = {
    workspaces,
    agents,
    hasHydratedWorkspaces: true,
    hasWorkspaceDirectorySnapshot: true,
  };
  const state = {
    layoutByWorkspace: { [`${serverId}:${workspaceKey}`]: { root: panes, focusedPaneId: "right" } },
  };
  const records = new Map<string, unknown>();
  const calls: unknown[] = [];
  let hydrated = true;
  let failure: "none" | "create" | "navigate" | "placement" = "none";
  const modules = new Map(pure);
  modules.set(ids.platform, { getIsElectron: () => true, getIsElectronMac: () => mac });
  modules.set(ids.sessions, {
    useSessionStore: { getState: () => ({ sessions: { [serverId]: directory } }) },
  });
  modules.set(ids.layout, {
    useWorkspaceLayoutStore: { getState: () => state, persist: { hasHydrated: () => hydrated } },
    findPaneById: (root: Map<string, unknown>, id: string) => root.get(id),
  });
  modules.set(ids.browser, {
    createWorkspaceBrowser: ({ initialUrl }: { initialUrl: string }) => {
      calls.push({ create: initialUrl });
      if (failure === "create") throw new Error("create failed");
      const record = { browserId: `created-${records.size}`, url: initialUrl };
      records.set(record.browserId, record);
      return record;
    },
    getBrowserRecord: (id: string) => records.get(id),
  });
  modules.set(ids.navigation, {
    navigateToWorkspace: (request: {
      serverId: string;
      workspaceId: string;
      target: { kind: "browser"; browserId: string };
      placement: { mode: string; paneId: string };
    }) => {
      calls.push(request);
      if (failure === "navigate") throw new Error("navigation failed");
      if (failure !== "placement") {
        assert.equal(request.serverId, serverId);
        assert.equal(request.workspaceId, workspaceKey);
        assert.deepEqual(request.placement, { mode: "pane", paneId: "left" });
        const selected = panes.get(request.placement.paneId)!;
        Object.assign(selected, {
          focusedTabId: request.target.browserId,
          tabs: [{ tabId: request.target.browserId, target: request.target }],
        });
      }
    },
  });
  return {
    host: createHost((id) => modules.get(id), ids),
    calls,
    directory,
    panes,
    records,
    setFailure: (value: typeof failure) => {
      failure = value;
    },
    unhydrate: () => {
      hydrated = false;
    },
  };
}
async function start(host: BrowserHost) {
  dispose = controller(async () => host);
  await Promise.resolve();
}
async function click(options: MouseEventInit = {}) {
  const target = document.querySelector('a code, a [role="link"], a')!;
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...options });
  act(() => {
    target.dispatchEvent(event);
  });
  await new Promise((resolve) => setImmediate(resolve));
  return event;
}
beforeEach(() => {
  dispose();
  cleanup.forEach((fn) => fn());
  cleanup = [];
  externalCalls = 0;
  settings = valuesSchema.parse({});
  settingsReader = async () => settings;
  openedExternal.length = 0;
  diagnostics.length = 0;
  dom.window.history.replaceState({}, "", route);
  fixture();
});
after(() => {
  dispose();
  act(() => root.unmount());
  dom.window.close();
  console.error = oldError;
  console.warn = oldWarn;
});

test("native export discovery is unique and rejects missing/ambiguous contracts", () => {
  assert.deepEqual(resolveModuleIds(source), ids);
  assert.throws(() => resolveModuleIds(""));
  assert.throws(() => resolveModuleIds(source + source));
  assert.throws(() => createHost(() => ({}), ids));
});
for (const detail of [1, 0])
  test(`normal/keyboard click detail=${detail} consumes before React capture and PressResponder`, async () => {
    const app = runtime();
    await start(app.host);
    assert.equal((await click({ detail })).defaultPrevented, true);
    assert.equal(app.calls.length, 2);
    assert.equal(externalCalls, 0);
    assert.equal(app.records.size, 1);
    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.equal(app.panes.get("right")?.focusedTabId, "tab-right");
  });
for (const options of [{ ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])
  test(`native modifier/middle behavior ${JSON.stringify(options)}`, async () => {
    const app = runtime();
    await start(app.host);
    await click(options);
    assert.equal(app.calls.length, 0);
    assert.equal(externalCalls, 1);
  });
for (const options of [
  { href: "/workspace/path" },
  { href: "../docs" },
  { href: "#heading" },
  { href: "file:///tmp/test.ts" },
  { href: "mailto:hello@example.com" },
  { href: "paseo://open/test" },
  { href: "https://example.com", download: true },
  { href: "https://src/config.ts", text: "src/config.ts", unwrap: true, inlineCode: true },
  { assistant: false },
  { invisible: true },
])
  test(`unsupported link retains native handling ${JSON.stringify(options)}`, async () => {
    fixture(options);
    const app = runtime();
    await start(app.host);
    await click();
    assert.equal(app.calls.length, 0);
    assert.equal(externalCalls, 1);
  });
test("bare HTTPS auto-link remains external under the real native file classifier", async () => {
  fixture({ text: "https://example.com/docs", unwrap: true });
  const app = runtime();
  await start(app.host);
  await click();
  assert.equal(app.calls.length, 2);
  assert.equal(externalCalls, 0);
});
for (const missing of ["workspace", "pane", "hydration", "route", "selected tab"])
  test(`missing context (${missing}) leaves native handling`, async () => {
    const app = runtime();
    if (missing === "workspace") app.directory.workspaces.clear();
    if (missing === "pane") app.panes.delete("left");
    if (missing === "hydration") app.unhydrate();
    if (missing === "route") dom.window.history.replaceState({}, "", "/settings");
    if (missing === "selected tab") fixture({ selectedAgent: "other" });
    await start(app.host);
    await click();
    assert.equal(app.calls.length, 0);
    assert.equal(externalCalls, 1);
  });
for (const failure of ["create", "navigate", "placement"] as const)
  test(`${failure} failure is visible without external fallback`, async () => {
    const app = runtime();
    app.setFailure(failure);
    await start(app.host);
    await click();
    assert.equal(externalCalls, 0);
    assert.ok(document.querySelector('[role="alert"]'));
    assert.equal(app.records.size, failure === "create" ? 0 : 1);
    assert.equal(
      document.querySelector('[role="alert"]')?.textContent?.includes("created-0"),
      false,
    );
    assert.ok(diagnostics.length > 0);
    act(() => {
      document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    });
    assert.equal(document.querySelector('[role="alert"]'), null);
  });
test("duplicate install, old disposal and pending reload own exactly one listener", async () => {
  const app = runtime();
  let signal: AbortSignal | undefined;
  const oldDispose = controller(async (value) => {
    signal = value;
    return app.host;
  });
  await start(app.host);
  oldDispose();
  assert.equal(signal?.aborted, true);
  await click();
  assert.equal(app.calls.length, 2);
  assert.equal(externalCalls, 0);
  dispose();
  fixture();
  await click();
  assert.equal(externalCalls, 1);
});
test("disposal before discovery resolves and discovery failure leave native handling", async () => {
  const app = runtime();
  let resolve: ((host: BrowserHost) => void) | undefined;
  dispose = controller(
    () =>
      new Promise((ready) => {
        resolve = ready;
      }),
  );
  dispose();
  resolve?.(app.host);
  await Promise.resolve();
  await click();
  assert.equal(app.calls.length, 0);
  assert.equal(externalCalls, 1);
  dispose = controller(async () => {
    throw new Error("unknown exports");
  });
  await Promise.resolve();
  await Promise.resolve();
  await click();
  assert.equal(externalCalls, 2);
});

test("cached workspace and displayed agent tab work without live directory hydration", async () => {
  const app = runtime();
  app.directory.agents.clear();
  app.directory.hasHydratedWorkspaces = false;
  app.directory.hasWorkspaceDirectorySnapshot = false;
  await start(app.host);
  await click();
  assert.equal(app.calls.length, 2);
  assert.equal(externalCalls, 0);
});

test("legacy Pressable-wrapped anchors still open in their source pane", async () => {
  fixture({ legacy: true });
  const app = runtime();
  await start(app.host);
  await click();
  assert.equal(app.calls.length, 2);
  assert.equal(externalCalls, 0);
});

for (const mac of [true, false])
  for (const destination of ["in-app", "external"] as const)
    for (const modified of [true, false])
      test(`configured destination=${destination} modified=${modified} mac=${mac}`, async () => {
        settings = { click: destination, modifiedClick: destination };
        const app = runtime(mac);
        await start(app.host);
        const event = await click(modified ? (mac ? { metaKey: true } : { ctrlKey: true }) : {});
        assert.equal(event.defaultPrevented, true);
        assert.equal(app.records.size, destination === "in-app" ? 1 : 0);
        assert.deepEqual(
          openedExternal,
          destination === "external" ? ["https://example.com/docs"] : [],
        );
        assert.equal(externalCalls, 0);
      });
test("Command-click defaults to the system browser", async () => {
  const app = runtime();
  await start(app.host);
  await click({ metaKey: true });
  assert.deepEqual(openedExternal, ["https://example.com/docs"]);
  assert.equal(app.records.size, 0);
  assert.equal(externalCalls, 0);
});
test("a settings change takes effect on the next click without reloading", async () => {
  const app = runtime();
  await start(app.host);
  settings = { click: "external", modifiedClick: "in-app" };
  await click();
  assert.equal(openedExternal.length, 1);
  await click({ metaKey: true });
  assert.equal(app.records.size, 1);
});
test("settings failure shows an error and never opens another destination", async () => {
  settingsReader = async () => {
    throw new Error("offline");
  };
  const app = runtime();
  await start(app.host);
  await click();
  assert.ok(document.querySelector('[role="alert"]'));
  assert.equal(app.records.size, 0);
  assert.equal(openedExternal.length, 0);
  assert.equal(externalCalls, 0);
});
for (const change of ["dispose", "route", "pane"])
  test(`pending settings read cannot open after ${change}`, async () => {
    let resolve: ((values: LinkPreferences) => void) | undefined;
    settingsReader = () =>
      new Promise((ready) => {
        resolve = ready;
      });
    const app = runtime();
    await start(app.host);
    await click();
    if (change === "dispose") dispose();
    if (change === "route") dom.window.history.replaceState({}, "", "/settings");
    if (change === "pane") app.panes.delete("left");
    resolve?.(settings);
    await new Promise((ready) => setImmediate(ready));
    assert.equal(app.records.size, 0);
    assert.equal(openedExternal.length, 0);
    assert.equal(Boolean(document.querySelector('[role="alert"]')), change !== "dispose");
  });
test("external opener rejection is visible without an in-app fallback", async () => {
  const app = runtime();
  dispose = install({
    isWeb: true,
    discover: async () => app.host,
    readPreferences: async () => settings,
    openExternal: async () => {
      throw new Error("open denied");
    },
    errorText: () => ({ failure: "Open failed", dismiss: "Dismiss" }),
  });
  await Promise.resolve();
  await click({ metaKey: true });
  assert.ok(document.querySelector('[role="alert"]'));
  assert.equal(app.records.size, 0);
});
test("native platform is a no-op without reading DOM or discovering host", () => {
  const stop = install({
    isWeb: false,
    discover: async () => {
      throw new Error("must not discover");
    },
    readPreferences: async () => settings,
    openExternal: async () => {},
    errorText: () => ({ failure: "", dismiss: "" }),
  });
  stop();
});
