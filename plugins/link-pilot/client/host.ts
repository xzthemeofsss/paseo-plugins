import { z } from "zod";

const callable = z.custom<(...args: unknown[]) => unknown>((value) => typeof value === "function");
const nonempty = z.string().min(1);
const serverId = nonempty.brand<"ServerId">();
const workspaceKey = nonempty.brand<"WorkspaceKey">();
const paneId = nonempty.brand<"PaneId">();
const agentId = nonempty.brand<"AgentId">();
const intentSchema = z.object({ url: nonempty, serverId, workspaceKey, paneId, agentId });
export type ChatBrowserIntent = z.infer<typeof intentSchema>;
export interface ChatLink {
  url: string;
  text: string;
  unwrap: boolean;
  paneId: string;
  agentId: string;
}
export interface BrowserHost {
  modifierKey: "meta" | "ctrl";
  prepare(link: ChatLink, pathname: string): ChatBrowserIntent | null;
  open(intent: ChatBrowserIntent): void;
}
export class BrowserOpenError extends Error {
  constructor(
    readonly browserId: string | null,
    options: ErrorOptions,
  ) {
    super("Workspace browser opening was not confirmed", options);
  }
}
const store = z.preprocess(
  (value) => {
    if ((typeof value === "object" && value !== null) || typeof value === "function") {
      return { getState: Reflect.get(value, "getState"), persist: Reflect.get(value, "persist") };
    }
    return value;
  },
  z.object({ getState: callable, persist: z.unknown().optional() }),
);
const sessionState = z.object({ sessions: z.record(z.string(), z.unknown()) });
const session = z.object({ workspaces: z.map(z.string(), z.unknown()) });
const workspace = z.object({ id: nonempty, workspaceDirectory: nonempty });
const route = z.object({ serverId, workspaceId: nonempty });
const layoutState = z.object({ layoutByWorkspace: z.record(z.string(), z.unknown()) });
const layout = z.object({ root: z.unknown() });
const target = z.union([
  z.object({ kind: z.literal("agent"), agentId }),
  z.object({ kind: z.literal("browser"), browserId: nonempty }),
  z.object({ kind: z.string() }),
]);
const pane = z.object({
  id: paneId,
  hidden: z.boolean().optional(),
  focusedTabId: nonempty.nullable(),
  tabs: z.array(z.object({ tabId: nonempty, target })),
});
const browser = z.object({ browserId: nonempty, url: nonempty });
const external = z.object({
  kind: z.literal("resolved"),
  value: z.object({ kind: z.literal("external"), url: nonempty }),
});

export const signatures = {
  browser: ["createWorkspaceBrowser", "getBrowserRecord", "useBrowserStore"],
  navigation: ["navigateToWorkspace", "useActiveWorkspaceSelection", "getLastWorkspaceSelection"],
  identity: ["normalizeWorkspaceOpaqueId", "resolveWorkspaceMapKeyByIdentity"],
  route: [
    "parseHostWorkspaceRouteFromPathname",
    "decodeWorkspaceIdFromPathSegment",
    "buildHostWorkspaceRoute",
  ],
  keys: ["buildWorkspaceTabPersistenceKey"],
  layout: ["useWorkspaceLayoutStore", "findPaneById", "collectAllTabs"],
  sessions: ["useSessionStore", "normalizeWorkspaceDescriptor"],
  files: ["classifyForResolution", "getAssistantFileLinkToken"],
  platform: ["getIsElectron", "getIsElectronMac"],
} satisfies Record<string, string[]>;
export type ModuleIds = Record<keyof typeof signatures, number>;
const idsSchema = z.object(
  Object.fromEntries(Object.keys(signatures).map((key) => [key, z.number().int().nonnegative()])),
);

export function resolveModuleIds(source: string): ModuleIds {
  const chunks = source.split(/(?=__d\(function\()/);
  const entries = Object.entries(signatures).map(([name, names]) => {
    const matches = chunks.flatMap((chunk) => {
      if (
        !chunk.startsWith("__d(function(") ||
        !names.every((entry) =>
          new RegExp(`(?:Object\\.defineProperty\\([^,]+,["']${entry}["']|\\.${entry}\\s*=)`).test(
            chunk,
          ),
        )
      )
        return [];
      const match = chunk.match(/\},(\d+),\[[\d,]*\]\);/);
      return match ? [Number(match[1])] : [];
    });
    if (matches.length !== 1) throw new Error(`Ambiguous Paseo exports: ${name}`);
    return [name, matches[0]];
  });
  return idsSchema.parse(Object.fromEntries(entries)) as ModuleIds;
}

export function createHost(requireModule: (id: number) => unknown, ids: ModuleIds): BrowserHost {
  const browsers = z
    .object({ createWorkspaceBrowser: callable, getBrowserRecord: callable })
    .parse(requireModule(ids.browser));
  const navigation = z
    .object({ navigateToWorkspace: callable })
    .parse(requireModule(ids.navigation));
  const identity = z
    .object({ resolveWorkspaceMapKeyByIdentity: callable })
    .parse(requireModule(ids.identity));
  const routes = z
    .object({ parseHostWorkspaceRouteFromPathname: callable })
    .parse(requireModule(ids.route));
  const keys = z
    .object({ buildWorkspaceTabPersistenceKey: callable })
    .parse(requireModule(ids.keys));
  const layouts = z
    .object({ useWorkspaceLayoutStore: store, findPaneById: callable })
    .parse(requireModule(ids.layout));
  const persistence = z
    .object({ hasHydrated: callable })
    .parse(layouts.useWorkspaceLayoutStore.persist);
  const sessions = z.object({ useSessionStore: store }).parse(requireModule(ids.sessions));
  const files = z.object({ classifyForResolution: callable }).parse(requireModule(ids.files));
  const platform = z
    .object({ getIsElectron: callable, getIsElectronMac: callable })
    .parse(requireModule(ids.platform));
  if (platform.getIsElectron() !== true) throw new Error("Desktop browser is unavailable");
  sessionState.parse(sessions.useSessionStore.getState());
  layoutState.parse(layouts.useWorkspaceLayoutStore.getState());
  function readPane(server: string, key: string, id: string) {
    const persistenceKey = nonempty.parse(
      keys.buildWorkspaceTabPersistenceKey({ serverId: server, workspaceId: key }),
    );
    const current = layout.parse(
      layoutState.parse(layouts.useWorkspaceLayoutStore.getState()).layoutByWorkspace[
        persistenceKey
      ],
    );
    const selected = pane.parse(layouts.findPaneById(current.root, id));
    if (selected.id !== id || selected.hidden) throw new Error("Source pane unavailable");
    return selected;
  }
  return {
    modifierKey: platform.getIsElectronMac() === true ? "meta" : "ctrl",
    prepare(link, pathname) {
      try {
        if (platform.getIsElectron() !== true || persistence.hasHydrated() !== true) return null;
        const current = route.parse(routes.parseHostWorkspaceRouteFromPathname(pathname));
        const directory = session.parse(
          sessionState.parse(sessions.useSessionStore.getState()).sessions[current.serverId],
        );
        const key = workspaceKey.parse(
          identity.resolveWorkspaceMapKeyByIdentity({
            workspaces: directory.workspaces,
            workspaceId: current.workspaceId,
          }),
        );
        const workspaceRecord = workspace.parse(directory.workspaces.get(key));
        const selected = readPane(current.serverId, key, link.paneId);
        const active = selected.tabs.find((tab) => tab.tabId === selected.focusedTabId)?.target;
        if (active?.kind !== "agent" || !("agentId" in active) || active.agentId !== link.agentId)
          return null;
        const classification = external.safeParse(
          files.classifyForResolution(
            { href: link.url, text: link.text, ...(link.unwrap ? { markup: "linkify" } : {}) },
            { workspaceRoot: workspaceRecord.workspaceDirectory },
          ),
        );
        if (
          !classification.success ||
          new URL(classification.data.value.url).href !== new URL(link.url).href
        )
          return null;
        return intentSchema.parse({
          url: link.url,
          serverId: current.serverId,
          workspaceKey: key,
          paneId: link.paneId,
          agentId: link.agentId,
        });
      } catch {
        return null;
      }
    },
    open(intent) {
      let browserId: string | null = null;
      try {
        const created = browser.parse(browsers.createWorkspaceBrowser({ initialUrl: intent.url }));
        browserId = created.browserId;
        if (new URL(created.url).href !== new URL(intent.url).href)
          throw new Error("Created browser URL differs");
        navigation.navigateToWorkspace({
          serverId: intent.serverId,
          workspaceId: intent.workspaceKey,
          target: { kind: "browser", browserId },
          placement: { mode: "pane", paneId: intent.paneId },
        });
        const record = browser.parse(browsers.getBrowserRecord(browserId));
        const selected = readPane(intent.serverId, intent.workspaceKey, intent.paneId);
        const active = selected.tabs.find((tab) => tab.tabId === selected.focusedTabId)?.target;
        if (
          record.browserId !== browserId ||
          new URL(record.url).href !== new URL(intent.url).href ||
          active?.kind !== "browser" ||
          !("browserId" in active) ||
          active.browserId !== browserId
        )
          throw new Error("Browser placement was not confirmed");
      } catch (cause) {
        throw new BrowserOpenError(browserId, { cause });
      }
    },
  };
}
