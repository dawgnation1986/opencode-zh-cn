import { createMemo, createSignal } from "solid-js"
import { useConfig, useNewDesigns } from "../config"
import { useThemes } from "../context/theme"
import { DialogSelect } from "../ui/dialog-select"
import { useToast } from "../ui/toast"

type Setting = {
  title: string
  category: string
  path: string[]
  default: unknown
  values?: readonly unknown[]
  labels?: readonly string[]
  step?: number
  min?: number
  max?: number
  format?: (value: unknown) => string
  keywords?: readonly string[]
}

export const settings: Setting[] = [
  {
    title: "主题",
    category: "外观",
    path: ["theme", "name"],
    default: "opencode",
    keywords: ["color scheme", "colors"],
  },
  {
    title: "颜色模式",
    category: "外观",
    path: ["theme", "mode"],
    default: "system",
    values: ["system", "dark", "light"],
    keywords: ["dark mode", "light mode", "system theme"],
  },
  {
    title: "动画",
    category: "外观",
    path: ["animations"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["motion", "effects"],
  },
  {
    title: "侧边栏",
    category: "会话",
    path: ["session", "sidebar"],
    default: "auto",
    values: ["hide", "auto"],
    keywords: ["side panel"],
  },
  {
    title: "滚动条",
    category: "会话",
    path: ["session", "scrollbar"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["scroll bar"],
  },
  {
    title: "思考",
    category: "会话",
    path: ["session", "thinking"],
    default: "hide",
    values: ["hide", "show"],
    keywords: ["reasoning", "chain of thought"],
  },
  {
    title: "Markdown",
    category: "会话",
    path: ["session", "markdown"],
    default: "rendered",
    values: ["source", "rendered"],
    keywords: ["syntax", "concealment", "rendering"],
  },
  {
    title: "工具分组",
    category: "会话",
    path: ["session", "grouping"],
    default: "auto",
    values: ["none", "auto"],
    keywords: ["transcript", "messages", "reads", "searches"],
  },
  {
    title: "详细程度",
    category: "会话",
    path: ["session", "verbosity"],
    default: "medium",
    values: ["low", "medium", "high"],
    keywords: ["detail", "activity", "summary", "transcript"],
  },
  {
    title: "对话记录图片",
    category: "会话",
    path: ["session", "image_preview"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["attachments", "images", "tool output"],
  },
  {
    title: "TPS",
    category: "会话",
    path: ["session", "tps"],
    default: true,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["tokens per second", "throughput"],
  },
  {
    title: "新会话位置",
    category: "会话",
    path: ["session", "new_location"],
    default: "launch",
    values: ["launch", "inherit"],
    labels: ["启动目录", "当前会话"],
    keywords: ["directory", "cwd", "inherit"],
  },
  {
    title: "权限",
    category: "会话",
    path: ["session", "permissions"],
    default: "prompt",
    values: ["prompt", "autoaccept"],
    labels: ["询问", "自动接受"],
    keywords: ["approve", "accept", "permission requests"],
  },
  {
    title: "模式",
    category: "标签页",
    path: ["tabs", "mode"],
    default: "auto",
    values: ["off", "on", "auto"],
  },
  {
    title: "范围",
    category: "标签页",
    path: ["tabs", "scope"],
    default: "cwd",
    values: ["cwd", "global"],
    labels: ["当前目录", "全局"],
  },
  {
    title: "布局",
    category: "标签页",
    path: ["tabs", "layout"],
    default: "horizontal",
    values: ["horizontal", "vertical"],
    keywords: ["sidebar", "orientation", "left"],
  },
  {
    title: "指示器",
    category: "标签页",
    path: ["tabs", "indicators"],
    default: "status",
    values: ["status", "numbers"],
    labels: ["状态图标", "始终显示数字"],
    keywords: ["tab numbers", "number mode", "status icons"],
  },
  {
    title: "布局",
    category: "差异",
    path: ["diffs", "view"],
    default: "auto",
    values: ["auto", "split", "unified"],
    keywords: ["diff layout", "split diff", "unified diff"],
  },
  {
    title: "换行",
    category: "差异",
    path: ["diffs", "wrap"],
    default: "word",
    values: ["none", "word"],
    keywords: ["diff wrap", "word wrap", "line wrap"],
  },
  {
    title: "文件树",
    category: "差异",
    path: ["diffs", "tree"],
    default: true,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["diff files"],
  },
  {
    title: "单个补丁",
    category: "差异",
    path: ["diffs", "single"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["one file", "selected file"],
  },
  {
    title: "滚动速度",
    category: "输入",
    path: ["scroll", "speed"],
    default: 3,
    step: 0.25,
    min: 0.25,
    max: 10,
    format: (value) => Number(value).toFixed(2),
    keywords: ["scrolling"],
  },
  {
    title: "加速",
    category: "输入",
    path: ["scroll", "acceleration"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["scroll acceleration"],
  },
  {
    title: "鼠标",
    category: "输入",
    path: ["mouse"],
    default: true,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["mouse capture"],
  },
  {
    title: "编辑器上下文",
    category: "输入",
    path: ["prompt", "editor"],
    default: true,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["file context", "prompt context", "editor selection"],
  },
  {
    title: "大段粘贴",
    category: "输入",
    path: ["prompt", "paste"],
    default: "compact",
    values: ["compact", "full"],
    keywords: ["paste summary", "clipboard", "pasted content"],
  },
  {
    title: "图片预览",
    category: "输入",
    path: ["prompt", "image_preview"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["attachments", "clipboard", "images", "prompt"],
  },
  {
    title: "Leader 超时",
    category: "输入",
    path: ["leader", "timeout"],
    default: 2000,
    step: 250,
    min: 250,
    max: 10000,
    format: (value) => `${value} ms`,
    keywords: ["leader key", "shortcut timeout"],
  },
  {
    title: "通知",
    category: "提醒",
    path: ["attention", "notifications"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["system notifications", "desktop notifications", "alerts"],
  },
  {
    title: "声音",
    category: "提醒",
    path: ["attention", "sound"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["audio", "sound effects", "alerts"],
  },
  {
    title: "音量",
    category: "提醒",
    path: ["attention", "volume"],
    default: 0.4,
    step: 0.1,
    min: 0,
    max: 1,
    format: (value) => `${Math.round(Number(value) * 100)}%`,
    keywords: ["sound volume", "audio volume"],
  },
  {
    title: "版本更新内容",
    category: "提醒",
    path: ["highlights"],
    default: true,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["what's new", "changelog", "release notes"],
  },
  {
    title: "窗口标题",
    category: "终端",
    path: ["terminal", "title"],
    default: true,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["terminal title", "tab title"],
  },
  {
    title: "复制行为",
    category: "终端",
    path: ["terminal", "copy"],
    default: process.platform === "win32" ? "manual" : "select",
    values: ["manual", "select"],
    keywords: ["selection", "clipboard"],
  },
  {
    title: "开发者工具",
    category: "调试",
    path: ["debug", "devtools"],
    default: false,
    values: [false, true],
    labels: ["关闭", "开启"],
    keywords: ["debug bar", "developer tools"],
  },
]

export function settingID(setting: Setting) {
  return setting.path.join(".")
}

export function DialogConfig(props: { current?: string }) {
  const config = useConfig()
  const newDesigns = useNewDesigns()
  const toast = useToast()
  const themes = useThemes()
  const current = Math.max(
    0,
    settings.findIndex((setting) => settingID(setting) === props.current),
  )
  const [selected, setSelected] = createSignal(current)
  const [saving, setSaving] = createSignal(false)

  const value = (setting: Setting) => {
    const current = setting.path.reduce<unknown>((result, key) => {
      if (!result || typeof result !== "object") return undefined
      return (result as Record<string, unknown>)[key]
    }, config.data)
    if (setting.path.join(".") === "theme.name") return current ?? themes.selected
    return current ?? setting.default
  }
  const values = (setting: Setting) =>
    setting.path.join(".") === "theme.name"
      ? Object.keys(themes.all()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      : setting.values
  const display = (setting: Setting) => {
    const current = value(setting)
    if (setting.format) return setting.format(current)
    const index = setting.values?.indexOf(current)
    return index === undefined || index < 0 ? String(current) : (setting.labels?.[index] ?? String(current))
  }
  const options = createMemo(() =>
    settings.map((setting, index) => ({
      title: setting.title,
      category: setting.category,
      searchText: setting.keywords?.join(" "),
      footer: display(setting),
      value: index,
    })),
  )

  async function change(direction: number, index = selected()) {
    if (saving()) return
    const setting = settings[index]
    const current = value(setting)
    const choices = values(setting)
    const next = choices
      ? choices[(choices.indexOf(current) + direction + choices.length) % choices.length]
      : Math.min(setting.max!, Math.max(setting.min!, Number(current) + direction * setting.step!))
    if (next === current) return
    setSaving(true)
    await config
      .update((draft) => {
        const parent = setting.path.slice(0, -1).reduce<Record<string, unknown>>((result, key) => {
          if (!result[key] || typeof result[key] !== "object") result[key] = {}
          return result[key] as Record<string, unknown>
        }, draft)
        parent[setting.path.at(-1)!] = next
      })
      .catch(toast.error)
      .finally(() => setSaving(false))
  }

  return (
    <DialogSelect
      title="设置"
      searchInTitle
      titlePlaceholder="搜索设置"
      options={options()}
      current={current}
      filterThreshold={0.7}
      onMove={(option) => setSelected(option.value)}
      onSelect={(option) => void change(1, option.value)}
      footerHints={newDesigns() ? [] : [{ title: "更改", label: "←/→" }]}
      bindings={[
        {
          bind: "left",
          title: "上一个值",
          group: "Settings",
          run: () => void change(-1),
        },
        {
          bind: "right",
          title: "下一个值",
          group: "Settings",
          run: () => void change(1),
        },
      ]}
    />
  )
}
