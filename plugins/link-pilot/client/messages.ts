import { defineTranslations } from "@getpaseo/plugin/client";

export const messages = defineTranslations({
  resources: {
    en: {
      title: "Link behavior",
      command: "Link Pilot settings",
      info: "Choose where assistant chat web links open. Changes are saved automatically for this host.",
      click: "Click",
      modifiedClick: "⌘ Command-click / Ctrl-click",
      modifiedHint: "Use Command on macOS and Ctrl on Windows or Linux.",
      inApp: "In Paseo",
      inAppHint: "Open a browser tab in the pane containing the chat.",
      external: "System browser",
      loading: "Loading settings…",
      unavailable: "Settings unavailable",
      unsaved: "Settings were not saved",
      refresh: "Refresh settings",
      refreshAction: "Refresh",
      reset: "Restore defaults",
      resetAction: "Reset",
      scope: "Desktop app only",
      scopeHint:
        "File links, other modifiers and middle-click keep Paseo’s normal behavior. Browser web and mobile keep their normal link handling.",
      failure:
        "Could not open this link. Check the source chat and Link Pilot settings, then try again.",
      dismiss: "Dismiss",
    },
    "zh-CN": {
      title: "链接打开方式",
      command: "Link Pilot 设置",
      info: "分别选择助手聊天中网页链接的打开方式。更改后自动保存到当前主机。",
      click: "单击",
      modifiedClick: "⌘ 单击 / Ctrl 单击",
      modifiedHint: "macOS 使用 Command，Windows 和 Linux 使用 Ctrl。",
      inApp: "Paseo 内打开",
      inAppHint: "在聊天所在分屏中打开浏览器标签页。",
      external: "系统浏览器",
      loading: "正在读取设置…",
      unavailable: "设置不可用",
      unsaved: "设置尚未保存",
      refresh: "重新读取设置",
      refreshAction: "刷新",
      reset: "恢复默认设置",
      resetAction: "恢复默认",
      scope: "适用于桌面应用",
      scopeHint:
        "文件链接、其他组合键和中键保持 Paseo 原有行为。网页端和移动端沿用原有的链接处理方式。",
      failure: "链接打开失败。请检查来源聊天和 Link Pilot 设置后重试。",
      dismiss: "关闭",
    },
  },
});
