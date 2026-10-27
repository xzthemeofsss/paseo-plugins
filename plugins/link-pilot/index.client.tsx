import { settingsRpc } from "@getpaseo/plugin";
import { openExternalUrl, type PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
import { messages } from "./client/messages";
import { LinkSettings } from "./client/settings";
import { install } from "./client/web";
import { preferences, valuesSchema } from "./shared/preferences";

export default function contribute(client: PluginClientContext) {
  const controller = install({
    isWeb: Platform.OS === "web",
    async readPreferences() {
      const result = await client.rpc(settingsRpc(preferences.id).read, {});
      if (result.status !== "ready") throw new Error(result.error);
      return valuesSchema.parse(result.values);
    },
    openExternal: openExternalUrl,
    errorText: () => ({
      failure: client.i18n.t(messages, "failure"),
      dismiss: client.i18n.t(messages, "dismiss"),
    }),
  });
  const removeSettings = client.addSettingsScreen({
    id: "links",
    title: messages.message("title"),
    icon: "Navigation",
    Component: LinkSettings,
  });
  const removeCommand = client.addCommandCenterItem({
    id: "settings",
    title: messages.message("command"),
    icon: "Navigation",
    context: "global",
    onSelect: ({ openSettings }) => openSettings("links"),
  });
  return () => {
    controller();
    removeCommand();
    removeSettings();
  };
}
