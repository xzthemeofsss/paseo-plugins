import { z } from "zod";
import type { LinkPreferences } from "../shared/preferences";
import {
  BrowserOpenError,
  createHost,
  resolveModuleIds,
  type BrowserHost,
  type ChatLink,
} from "./host";

// DOM types stay local so native compilation never needs lib.dom.
declare class URL {
  constructor(url: string, base?: string | URL);
  href: string;
  hostname: string;
  host: string;
  protocol: string;
}
declare class Node {
  parentElement: Element | null;
}
declare class Element extends Node {
  isConnected: boolean;
  textContent: string | null;
  closest(selector: string): Element | null;
  contains(node: Node): boolean;
  getClientRects(): ArrayLike<unknown>;
  querySelector(selector: string): Element | null;
  querySelectorAll(selector: string): ArrayLike<Element>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}
declare class HTMLAnchorElement extends Element {}
interface AlertElement {
  textContent: string | null;
  style: Record<string, string>;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: () => void, options: { once: boolean }): void;
  append(child: AlertElement): void;
  remove(): void;
}
interface MouseEvent {
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  target: unknown;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}
declare const document: {
  scripts: ArrayLike<{ src: string }>;
  body: { append(child: AlertElement): void };
  createElement(tag: "div" | "button"): AlertElement;
  addEventListener(type: "click", listener: (event: MouseEvent) => void, capture: boolean): void;
  removeEventListener(type: "click", listener: (event: MouseEvent) => void, capture: boolean): void;
};
declare const location: { href: string; pathname: string };
const callable = z.custom<(...args: unknown[]) => unknown>((value) => typeof value === "function");

const PANE = '[data-testid^="workspace-pane-"]';
const CHAT = '[data-testid="agent-chat-scroll"]';
const ASSISTANT = '[data-testid="assistant-message"]';
const OWNER = Symbol.for("paseo.plugin.in-app-links.owner");
function visible(element: Element): boolean {
  return (
    element.isConnected &&
    !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    element.getClientRects().length > 0
  );
}
function clickedLink(event: MouseEvent): ChatLink | null {
  const target =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Node
        ? event.target.parentElement
        : null;
  const anchor = target?.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return null;
  const assistant = anchor.closest(ASSISTANT);
  const chat = anchor.closest(CHAT);
  const pane = anchor.closest(PANE);
  if (
    !assistant ||
    !chat ||
    !pane ||
    !chat.contains(assistant) ||
    !pane.contains(chat) ||
    !visible(assistant) ||
    !visible(chat) ||
    !visible(pane)
  )
    return null;
  const raw = anchor.getAttribute("href") ?? "";
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!url.hostname || !["http:", "https:"].includes(url.protocol)) return null;
    const tabs = Array.from(
      pane.querySelectorAll('[data-testid^="workspace-tab-agent_"][aria-selected="true"]'),
    ).filter(visible);
    if (tabs.length !== 1) return null;
    const paneId = pane.getAttribute("data-testid")?.slice("workspace-pane-".length);
    const agentId = tabs[0].getAttribute("data-testid")?.slice("workspace-tab-agent_".length);
    if (!paneId || !agentId) return null;
    return {
      url: raw,
      text: anchor.textContent ?? "",
      unwrap:
        anchor.getAttribute("data-paseo-markdown-unwrap") === "true" ||
        anchor.querySelector("code") !== null,
      paneId,
      agentId,
    };
  } catch {
    return null;
  }
}

interface LinkControllerOptions {
  isWeb: boolean;
  readPreferences(): Promise<LinkPreferences>;
  openExternal(url: string): Promise<void>;
  errorText(): { failure: string; dismiss: string };
  discover?: (signal: AbortSignal) => Promise<BrowserHost>;
}

export function install(options: LinkControllerOptions) {
  if (!options.isWeb || typeof document === "undefined") return () => {};
  const previous: unknown = Reflect.get(document, OWNER);
  if (typeof previous === "function") previous();
  const lifetime = new AbortController();
  let host: BrowserHost | null = null;
  let alert: AlertElement | null = null;
  function clearAlert() {
    alert?.remove();
    alert = null;
  }
  function showError(error: unknown) {
    if (lifetime.signal.aborted) return;
    console.error("[link-pilot] Link opening failed", {
      browserId: error instanceof BrowserOpenError ? error.browserId : null,
      error,
    });
    clearAlert();
    const copy = options.errorText();
    alert = document.createElement("div");
    alert.setAttribute("role", "alert");
    alert.textContent = copy.failure + " ";
    Object.assign(alert.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      maxWidth: "360px",
      zIndex: "2147483647",
      background: "Canvas",
      color: "CanvasText",
      border: "1px solid ButtonBorder",
      padding: "12px",
      borderRadius: "8px",
    });
    const dismiss = document.createElement("button");
    dismiss.textContent = copy.dismiss;
    dismiss.addEventListener("click", clearAlert, { once: true });
    alert.append(dismiss);
    document.body.append(alert);
  }
  function onClick(event: MouseEvent) {
    if (!host || event.defaultPrevented || event.button !== 0 || event.shiftKey || event.altKey)
      return;
    // macOS Ctrl-click opens a context menu; only the platform's primary modifier is ours.
    if (host.modifierKey === "meta" ? event.ctrlKey : event.metaKey) return;
    const modified = host.modifierKey === "meta" ? event.metaKey : event.ctrlKey;
    const link = clickedLink(event);
    if (!link) return;
    const pathname = location.pathname;
    const intent = host.prepare(link, pathname);
    if (!intent) return;
    const openingHost = host;
    event.preventDefault();
    event.stopImmediatePropagation();
    void options
      .readPreferences()
      .then(async (values) => {
        if (lifetime.signal.aborted) return;
        const current = openingHost.prepare(link, location.pathname);
        if (
          pathname !== location.pathname ||
          !current ||
          current.serverId !== intent.serverId ||
          current.workspaceKey !== intent.workspaceKey
        )
          throw new Error("Source chat changed while reading settings");
        if (values[modified ? "modifiedClick" : "click"] === "external")
          await options.openExternal(link.url);
        else openingHost.open(current);
        if (!lifetime.signal.aborted) clearAlert();
      })
      .catch(showError);
  }
  function dispose() {
    lifetime.abort();
    document.removeEventListener("click", onClick, true);
    host = null;
    clearAlert();
    if (Reflect.get(document, OWNER) === dispose) Reflect.deleteProperty(document, OWNER);
  }
  Reflect.set(document, OWNER, dispose);
  void (options.discover ?? discoverHost)(lifetime.signal)
    .then((ready) => {
      if (lifetime.signal.aborted) return;
      host = ready;
      document.addEventListener("click", onClick, true);
    })
    .catch((error: unknown) => {
      if (!lifetime.signal.aborted)
        console.warn("[link-pilot] Native link handling retained", error);
    });
  return dispose;
}

async function discoverHost(signal: AbortSignal): Promise<BrowserHost> {
  const runtime = z.object({ __r: callable }).parse(globalThis);
  const base = new URL(location.href);
  const urls = new Set(
    Array.from(document.scripts).flatMap((script) => {
      if (!script.src) return [];
      const url = new URL(script.src, base);
      return url.protocol === base.protocol && url.host === base.host ? [url.href] : [];
    }),
  );
  for (const url of urls) {
    const response = await fetch(url, { signal });
    if (!response.ok) continue;
    const source = await response.text();
    if (signal.aborted) throw new Error("Plugin stopped");
    if (!source.includes("createWorkspaceBrowser")) continue;
    return createHost((id) => runtime.__r(id), resolveModuleIds(source));
  }
  throw new Error("Paseo browser exports unavailable");
}
