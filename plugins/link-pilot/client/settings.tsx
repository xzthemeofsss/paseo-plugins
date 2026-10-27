import { useSettings, useTranslation } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "@getpaseo/plugin/client/ui";
import { preferences, type Destination, type LinkPreferences } from "../shared/preferences";
import { messages } from "./messages";

export function LinkSettings() {
  const settings = useSettings(preferences);
  const { t } = useTranslation(messages);
  const options = [
    { value: "in-app", label: t("inApp") },
    { value: "external", label: t("external") },
  ] satisfies { value: Destination; label: string }[];
  function change(key: keyof LinkPreferences, value: Destination) {
    if (settings.status !== "ready" || settings.saving) return;
    void settings.save({ ...settings.values, [key]: value }, settings.revision);
  }
  return (
    <SettingsSection title={t("title")} info={t("info")}>
      <SettingsCard>
        {settings.status === "ready" ? (
          <>
            <SettingsSelect
              label={t("click")}
              hint={settings.values.click === "in-app" ? t("inAppHint") : undefined}
              value={settings.values.click}
              options={options}
              disabled={settings.saving}
              onValueChange={(value) => change("click", value)}
              testID="link-pilot-click"
            />
            <SettingsSelect
              label={t("modifiedClick")}
              hint={t("modifiedHint")}
              value={settings.values.modifiedClick}
              options={options}
              disabled={settings.saving}
              onValueChange={(value) => change("modifiedClick", value)}
              testID="link-pilot-modified-click"
            />
          </>
        ) : (
          <SettingsRow
            label={settings.status === "loading" ? t("loading") : t("unavailable")}
            error={settings.status === "loading" ? undefined : settings.error}
          />
        )}
        {settings.saveError ? (
          <SettingsRow label={t("unsaved")} error={settings.saveError} />
        ) : null}
        <SettingsAction
          label={t("refresh")}
          actionLabel={t("refreshAction")}
          disabled={settings.saving || settings.status === "loading"}
          onPress={() => {
            void settings.reload();
          }}
        />
        <SettingsAction
          label={t("reset")}
          actionLabel={t("resetAction")}
          disabled={
            settings.saving || (settings.status !== "ready" && settings.status !== "invalid")
          }
          onPress={() => {
            void settings.reset();
          }}
        />
        <SettingsRow label={t("scope")} hint={t("scopeHint")} />
      </SettingsCard>
    </SettingsSection>
  );
}
