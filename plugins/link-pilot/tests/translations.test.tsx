import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "@getpaseo/plugin/client";
import { PluginTranslationProvider, PluginTranslationRuntime } from "@getpaseo/plugin/client/host";
import { resources } from "../client/locales";
import { messages } from "../client/messages";

const locales = ["ar", "en", "es", "fr", "ja", "ko", "pt-BR", "ru", "zh-CN"];

test("every supported Paseo locale has complete nonempty resources", () => {
  assert.deepEqual(Object.keys(resources).sort(), locales);
  const keys = Object.keys(resources.en).sort();
  for (const [locale, copy] of Object.entries(resources)) {
    assert.equal(Intl.getCanonicalLocales(locale)[0], locale);
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const [key, text] of Object.entries(copy)) assert.ok(text.trim(), `${locale}.${key}`);
  }
});

test("mounted settings copy, registered labels and transient errors follow live app language", async () => {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>');
  for (const key of ["window", "document"] as const)
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  let locale = "en";
  const listeners = new Set<() => void>();
  const runtime = new PluginTranslationRuntime({
    getLocale: () => locale,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  const root = createRoot(document.getElementById("root")!);
  const title = messages.message("title");
  const command = messages.message("command");
  const errorText = () => runtime.t(messages, "failure");
  let mounts = 0;
  let unmounts = 0;
  function Probe() {
    const { t } = useTranslation(messages);
    useEffect(() => {
      mounts++;
      return () => {
        unmounts++;
      };
    }, []);
    return (
      <span>
        {t("click")} / {t("external")} / {t("unsaved")}
      </span>
    );
  }
  try {
    await act(async () =>
      root.render(
        <PluginTranslationProvider runtime={runtime}>
          <Probe />
        </PluginTranslationProvider>,
      ),
    );
    for (const [nextLocale, copy] of Object.entries(resources)) {
      act(() => {
        locale = nextLocale;
        listeners.forEach((listener) => listener());
      });
      assert.equal(document.body.textContent, `${copy.click} / ${copy.external} / ${copy.unsaved}`);
      assert.equal(runtime.resolve(title), copy.title);
      assert.equal(runtime.resolve(command), copy.command);
      assert.equal(errorText(), copy.failure);
    }
    act(() => {
      locale = "de";
      listeners.forEach((listener) => listener());
    });
    assert.equal(runtime.resolve(title), resources.en.title);
    assert.equal(errorText(), resources.en.failure);
    assert.equal(mounts, 1);
    assert.equal(unmounts, 0);
  } finally {
    act(() => root.unmount());
    runtime.dispose();
    assert.equal(listeners.size, 0);
    dom.window.close();
  }
});
