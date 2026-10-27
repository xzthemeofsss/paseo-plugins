import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import { z } from "zod";
import { resolveModuleIds } from "../client/host";

const appDist = "/Applications/Paseo.app/Contents/Resources/app-dist";
function installedBundlePath() {
  const html = readFileSync(join(appDist, "index.html"), "utf8");
  const script = html.match(/<script[^>]+src="([^"]*\/index-[^"]+\.js)"/);
  if (!script) throw new Error("Installed Paseo entry script unavailable");
  return join(appDist, script[1]);
}
export const bundlePath = process.env.PASEO_BUNDLE ?? installedBundlePath();
export const source = readFileSync(bundlePath, "utf8");
export const ids = resolveModuleIds(source);
const chunks = new Map(
  source.split(/(?=__d\(function\()/).flatMap((text) => {
    const match = text.match(/\},(\d+),\[[\d,]*\]\);/);
    return text.startsWith("__d(function(") && match ? [[Number(match[1]), text] as const] : [];
  }),
);
export function chunk(id: number): string {
  const text = chunks.get(id);
  if (!text) throw new Error(`Missing installed module ${id}`);
  return text;
}
function moduleId(name: string): number {
  const pattern = new RegExp(`(?:Object\\.defineProperty\\([^,]+,["']${name}["']|\\.${name}\\s*=)`);
  const matches = [...chunks].filter(([, text]) => pattern.test(text));
  if (matches.length !== 1) throw new Error(`Ambiguous installed export ${name}`);
  return matches[0][0];
}
function evaluate(id: number, requireModule: (id: number) => unknown): unknown {
  const exports = {};
  vm.runInNewContext(chunk(id), {
    __d(factory: (...args: unknown[]) => void, _id: number, dependencies: number[]) {
      factory({}, requireModule, undefined, undefined, {}, exports, dependencies);
    },
    URL,
    URLSearchParams,
  });
  return exports;
}
function dependencies(id: number): number[] {
  const match = chunk(id).match(/\},\d+,\[([\d,]*)\]\);/);
  if (!match) throw new Error(`Missing dependencies for ${id}`);
  return match[1] ? match[1].split(",").map(Number) : [];
}
export function nativePureModules(): Map<number, unknown> {
  const [parseId, i18nId] = dependencies(ids.files);
  const allowed = new Set([
    ids.route,
    ids.identity,
    ids.keys,
    ids.files,
    moduleId("buildAgentDeepLink"),
    parseId,
    moduleId("ASSISTANT_FILE_EXTENSIONS"),
    moduleId("isAbsolutePath"),
  ]);
  const loaded = new Map<number, unknown>([
    [moduleId("Buffer"), { Buffer }],
    [i18nId, { i18n: { t: (key: string) => key } }],
  ]);
  function requireModule(id: number): unknown {
    if (loaded.has(id)) return loaded.get(id);
    if (!allowed.has(id)) throw new Error(`Unexpected pure-module dependency ${id}`);
    const exports = evaluate(id, requireModule);
    loaded.set(id, exports);
    return exports;
  }
  for (const id of [ids.route, ids.identity, ids.keys, ids.files]) requireModule(id);
  return loaded;
}

// Exercise the installed Markdown library's real anchor and click callback.
export function nativeLinkRenderer() {
  const rendererId = moduleId("inlineRenderers");
  const jsxId = dependencies(rendererId)[3];
  const exports = evaluate(rendererId, (id) => {
    const text = chunk(id);
    if (id === jsxId) return jsxRuntime;
    if (text.includes("linkStyleForUrl")) return { linkStyleForUrl: () => ({ color: "blue" }) };
    return {};
  });
  return z
    .object({
      inlineRenderers: z.object({
        Link: z.custom<
          (props: {
            node: {
              attributes: { url: string; recognizedLink?: string };
              children: { type: string }[];
            };
            style: Record<string, unknown>;
            callbacks: { onLinkPress: () => void };
            capabilities: Record<string, unknown>;
            renderChildren: () => React.ReactNode;
          }) => React.ReactNode
        >((value) => typeof value === "function"),
      }),
    })
    .parse(exports).inlineRenderers.Link;
}
