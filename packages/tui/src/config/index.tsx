export * as Config from "."

import { createBindingLookup } from "@opentui/keymap/extras"
import { Vcs } from "@opencode/schema/vcs"
import { Schema } from "effect"
import { createContext, onCleanup, type JSX, useContext } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { watch } from "fs"
import path from "path"
import { TuiKeybind } from "./keybind"

export interface Interface {
  readonly path?: string
  readonly get: () => Promise<Info>
  readonly update: (update: (draft: any) => void) => Promise<Info>
}

export const AttentionSoundName = Schema.Literals([
  "default",
  "question",
  "permission",
  "error",
  "done",
  "subagent_done",
])
export type AttentionSoundName = Schema.Schema.Type<typeof AttentionSoundName>
export type AttentionSoundPaths = Partial<Record<AttentionSoundName, string>>

export const MiniWorkSpinner = Schema.Literals([
  "block-soft-slide",
  "block-soft-sweep",
  "block-low-comet",
  "block-low-duet",
  "block-shuttle",
  "block-bridge",
  "block-squeeze",
  "small-toggle",
  "square-toggle",
  "grow-shrink",
  "quadrant-orbit",
  "crosshatch",
  "density-wave",
  "seed",
])
export type MiniWorkSpinner = Schema.Schema.Type<typeof MiniWorkSpinner>

export const Plugin = Schema.Union([
  Schema.String,
  Schema.Struct({
    package: Schema.String.annotate({ description: "插件包名或路径" }),
    options: Schema.optional(Schema.Record(Schema.String, Schema.Any)).annotate({
      description: "传递给插件的选项",
    }),
  }),
])

export const DiffSource = Schema.Union([Vcs.Mode, Schema.Literal("turn")])
export type DiffSource = Schema.Schema.Type<typeof DiffSource>

export const Cursor = Schema.Struct({
  style: Schema.optional(Schema.Literals(["block", "underline", "line", "default"])).annotate({
    description: "光标形状。使用 'default' 以保留终端设置",
  }),
  blinking: Schema.optional(Schema.Boolean).annotate({
    description: "光标是否闪烁。当 style 为 'default' 时无效",
  }),
}).annotate({ description: "终端光标设置" })

export const Info = Schema.Struct({
  theme: Schema.optional(
    Schema.Struct({
      name: Schema.optional(Schema.String).annotate({ description: "主题名称" }),
      mode: Schema.optional(Schema.Literals(["system", "dark", "light"])).annotate({
        description: "颜色模式；'system' 跟随终端",
      }),
    }),
  ).annotate({ description: "颜色主题设置" }),
  keybinds: Schema.optional(TuiKeybind.KeybindOverrides).annotate({ description: "自定义按键绑定" }),
  plugins: Schema.optional(Schema.Array(Plugin)).annotate({
    description: "有序的插件启用指令和外部包声明",
  }),
  leader: Schema.optional(
    Schema.Struct({
      timeout: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))).annotate({
        description: "按下 leader 键后等待按键的时间（毫秒）",
      }),
    }),
  ).annotate({ description: "Leader 键行为" }),
  scroll: Schema.optional(
    Schema.Struct({
      speed: Schema.optional(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0.001))).annotate({
        description: "每次输入滚动事件的滚动距离",
      }),
      acceleration: Schema.optional(Schema.Boolean).annotate({
        description: "根据重复输入加速滚动",
      }),
    }),
  ).annotate({ description: "滚动行为" }),
  attention: Schema.optional(
    Schema.Struct({
      notifications: Schema.optional(Schema.Boolean).annotate({ description: "显示系统通知" }),
      sound: Schema.optional(Schema.Boolean).annotate({ description: "播放提醒声音" }),
      volume: Schema.optional(
        Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)),
      ).annotate({ description: "提醒声音音量，范围 0 到 1" }),
      sound_pack: Schema.optional(Schema.String).annotate({ description: "当前启用的提醒声音包 ID" }),
      sounds: Schema.optional(Schema.Record(AttentionSoundName, Schema.optionalKey(Schema.String))).annotate({
        description: "按提醒事件覆盖声音文件",
      }),
    }),
  ).annotate({ description: "系统通知和声音设置" }),
  diffs: Schema.optional(
    Schema.Struct({
      source: Schema.optional(DiffSource).annotate({
        description:
          "初始 diff 来源；默认为 'branch'（分支和未提交的更改）。'turn' 显示会话的最后一轮，在会话外则回退到 'branch'",
      }),
      wrap: Schema.optional(Schema.Literals(["word", "none"])).annotate({
        description: "diff 输出中的换行行为",
      }),
      tree: Schema.optional(Schema.Boolean).annotate({ description: "显示 diff 文件树" }),
      single: Schema.optional(Schema.Boolean).annotate({ description: "仅显示所选文件的补丁" }),
      fullscreen: Schema.optional(Schema.Boolean).annotate({
        description: "以全屏打开 diff 侧边面板；记住上次的全屏切换状态",
      }),
      view: Schema.optional(Schema.Literals(["auto", "split", "unified"])).annotate({
        description: "Diff 布局；'auto' 根据可用宽度选择布局",
      }),
    }),
  ).annotate({ description: "Diff 展示设置" }),
  terminal: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.Boolean).annotate({ description: "更新终端窗口标题" }),
      copy: Schema.optional(Schema.Literals(["manual", "select"])).annotate({
        description: "手动复制文本，或在选中后立即复制",
      }),
    }),
  ).annotate({ description: "终端集成设置" }),
  prompt: Schema.optional(
    Schema.Struct({
      editor: Schema.optional(Schema.Boolean).annotate({
        description: "将当前编辑器文件或选中内容作为提示上下文",
      }),
      paste: Schema.optional(Schema.Literals(["compact", "full"])).annotate({
        description: "将大段粘贴内容显示为紧凑占位符或完整文本",
      }),
      image_preview: Schema.optional(Schema.Boolean).annotate({
        description: "在提示输入框上方显示图片附件预览",
      }),
    }),
  ).annotate({ description: "提示输入行为" }),
  session: Schema.optional(
    Schema.Struct({
      sidebar: Schema.optional(Schema.Literals(["auto", "hide"])).annotate({
        description: "会话侧边栏可见性；'auto' 在空间允许时显示",
      }),
      scrollbar: Schema.optional(Schema.Boolean).annotate({ description: "显示会话记录滚动条" }),
      thinking: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "默认显示或隐藏模型推理",
      }),
      grouping: Schema.optional(Schema.Literals(["auto", "none"])).annotate({
        description: "自动分组相关的记录项，或分别渲染每一项",
      }),
      verbosity: Schema.optional(Schema.Literals(["low", "medium", "high"])).annotate({
        description:
          "记录详细程度：low 会汇总每组工具和思考，high 会展开探索和指令分组",
      }),
      image_preview: Schema.optional(Schema.Boolean).annotate({
        description: "在会话记录中显示用户附件和工具结果的图片",
      }),
      tps: Schema.optional(Schema.Boolean).annotate({
        description: "显示平均每秒 token 数",
      }),
      markdown: Schema.optional(Schema.Literals(["source", "rendered"])).annotate({
        description: "显示 Markdown 语法标记，或在渲染的记录内容中隐藏它们",
      }),
      new_location: Schema.optional(Schema.Literals(["launch", "inherit"])).annotate({
        description: "在 TUI 启动目录中开始新会话，或继承当前会话的位置",
      }),
      permissions: Schema.optional(Schema.Literals(["prompt", "autoaccept"])).annotate({
        description: "对权限请求进行提示，或自动接受",
      }),
    }),
  ).annotate({ description: "会话记录展示设置" }),
  tabs: Schema.optional(
    Schema.Struct({
      mode: Schema.optional(Schema.Literals(["auto", "on", "off"])).annotate({
        description: "始终使用会话标签页、从不使用，或当终端环境支持时使用",
      }),
      enabled: Schema.optional(Schema.Boolean).annotate({
        description: "旧版标签页开关；请改用 mode",
      }),
      scope: Schema.optional(Schema.Literals(["global", "cwd"])).annotate({
        description: "全局共享标签页，或为每个工作目录保留单独的一组",
      }),
      layout: Schema.optional(Schema.Literals(["horizontal", "vertical"])).annotate({
        description: "以水平条或垂直侧边栏显示标签页",
      }),
      indicators: Schema.optional(Schema.Literals(["status", "numbers"])).annotate({
        description: "显示状态图标，或始终显示标签页编号",
      }),
    }),
  ).annotate({ description: "标签栏设置" }),
  mini: Schema.optional(
    Schema.Struct({
      thinking: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "显示或隐藏模型推理",
      }),
      tools: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "显示或隐藏工具调用及紧随其前的助手文本",
      }),
      shell_output: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "显示或隐藏原始 shell 工具输出",
      }),
      turn_summary: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "在滚动缓冲区中显示或隐藏 agent、模型和耗时摘要",
      }),
      footer: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "在页脚中显示或隐藏常驻的活动、模型、用量和上下文详情",
      }),
      splash: Schema.optional(Schema.Literals(["show", "hide"])).annotate({
        description: "显示或隐藏进入和退出时的启动横幅",
      }),
      work_spinner: Schema.optional(MiniWorkSpinner).annotate({
        description: "Mini 页脚中的工作加载动画（默认：block-soft-slide）",
      }),
      mono: Schema.optional(Schema.Boolean).annotate({
        description: "使用单色 ASCII 输出",
      }),
      replay: Schema.optional(Schema.Boolean).annotate({
        description: "在恢复会话和调整终端大小时还原会话历史",
      }),
      replay_limit: Schema.optional(Schema.Int.check(Schema.isGreaterThan(0))).annotate({
        description: "回放时还原的最新消息最大数量",
      }),
    }),
  ).annotate({ description: "Mini 记录展示设置" }),
  debug: Schema.optional(
    Schema.Struct({
      devtools: Schema.optional(Schema.Boolean).annotate({ description: "显示 DevTools 调试栏" }),
      timing: Schema.optional(Schema.Boolean).annotate({ description: "显示首帧绘制耗时诊断信息" }),
      turn_tokens: Schema.optional(Schema.Union([Schema.Boolean, Schema.Literal("verbose")])).annotate({
        description: "显示每轮 token 用量诊断信息，可选包含工具调用输入",
      }),
    }),
  ).annotate({ description: "调试设置" }),
  experimental: Schema.optional(Schema.Record(Schema.String, Schema.Boolean)).annotate({
    description: "可能随时变更或移除的实验性功能",
  }),
  animations: Schema.optional(Schema.Boolean).annotate({ description: "启用界面动画" }),
  highlights: Schema.optional(Schema.Boolean).annotate({
    description: "OpenCode 更新后显示一次版本亮点",
  }),
  mouse: Schema.optional(Schema.Boolean).annotate({ description: "启用终端鼠标捕获" }),
  cursor: Schema.optional(Cursor),
})
export type Info = Schema.Schema.Type<typeof Info>

export type Resolved = Omit<Info, "attention" | "cursor" | "keybinds" | "leader" | "mouse" | "session" | "tabs"> & {
  attention: {
    notifications: boolean
    sound: boolean
    volume: number
    sound_pack: string
    sounds: AttentionSoundPaths
  }
  keybinds: TuiKeybind.BindingLookupView
  leader: { timeout: number }
  mouse: boolean
  cursor?: {
    style: "block" | "underline" | "line" | "default"
    blinking: boolean
  }
  session: Omit<NonNullable<Info["session"]>, "new_location" | "permissions" | "tps"> & {
    new_location: "launch" | "inherit"
    permissions: "prompt" | "autoaccept"
    tps: boolean
  }
  tabs: {
    mode: "auto" | "on" | "off"
    enabled: boolean
    scope: "global" | "cwd"
    layout: "horizontal" | "vertical"
    indicators: "status" | "numbers"
  }
}

export function resolve(
  input: Info,
  options: { terminalSuspend: boolean; environment?: Readonly<Record<string, string | undefined>> },
): Resolved {
  const tabsMode = input.tabs?.mode ?? (input.tabs?.enabled === undefined ? "auto" : input.tabs.enabled ? "on" : "off")
  const keybinds: TuiKeybind.KeybindOverrides = { ...input.keybinds }
  if (!options.terminalSuspend) {
    keybinds["terminal.suspend"] = "none"
    if (keybinds["input.undo"] === undefined) {
      const inputUndo = TuiKeybind.defaultValue("input.undo")
      keybinds["input.undo"] = ["ctrl+z", ...(typeof inputUndo === "string" ? inputUndo.split(",") : [])]
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(",")
    }
  }

  return {
    ...input,
    attention: {
      notifications: input.attention?.notifications ?? false,
      sound: input.attention?.sound ?? false,
      volume: input.attention?.volume ?? 0.4,
      sound_pack: input.attention?.sound_pack ?? "opencode.default",
      sounds: input.attention?.sounds ?? {},
    },
    keybinds: createBindingLookup(TuiKeybind.toBindingConfig(TuiKeybind.parse(keybinds)), {
      bindingDefaults: TuiKeybind.bindingDefaults(),
    }),
    leader: { timeout: input.leader?.timeout ?? 2000 },
    mouse: input.mouse ?? true,
    cursor: input.cursor
      ? {
          style: input.cursor.style ?? "block",
          blinking: input.cursor.blinking ?? true,
        }
      : undefined,
    session: {
      ...input.session,
      new_location: input.session?.new_location ?? "launch",
      permissions: input.session?.permissions ?? "prompt",
      tps: input.session?.tps ?? true,
    },
    tabs: {
      ...input.tabs,
      mode: tabsMode,
      enabled: tabsMode === "on" || (tabsMode === "auto" && (options.environment ?? process.env).HERDR_ENV !== "1"),
      scope: input.tabs?.scope ?? "cwd",
      layout: input.tabs?.layout ?? "horizontal",
      indicators: input.tabs?.indicators ?? "status",
    },
  }
}

const ConfigContext = createContext<{
  data: Resolved
  path?: string
  update: Interface["update"]
}>()

export function ConfigProvider(props: {
  config: Resolved
  service?: Interface
  options?: { terminalSuspend: boolean; environment?: Readonly<Record<string, string | undefined>> }
  children: JSX.Element
}) {
  const [config, setConfig] = createStore(props.config)
  const host = props.service
  const apply = (info: Info) => setConfig(reconcile(resolve(info, props.options ?? { terminalSuspend: true })))
  const update = async (update: (draft: any) => void) => {
    if (!host) throw new Error("Config updates are not available")
    const info = await host.update(update)
    apply(info)
    return info
  }
  let reload = Promise.resolve()
  const watcher = host?.path
    ? watch(path.dirname(host.path), () => {
        reload = reload
          .then(() => host.get())
          .then(apply)
          .catch(() => {})
      })
    : undefined
  onCleanup(() => watcher?.close())
  return (
    <ConfigContext.Provider value={{ data: config, path: host?.path, update }}>{props.children}</ConfigContext.Provider>
  )
}

export function useConfig() {
  const value = useContext(ConfigContext)
  if (!value) throw new Error("ConfigProvider is missing")
  return value
}

/** Reactive accessor for the temporary "new-designs" experiment. */
export function useNewDesigns() {
  const config = useConfig()
  return () => config.data.experimental?.["new-designs"] === true
}
