export * as TuiKeybind from "./keybind"

import type { KeyEvent, Renderable } from "@opentui/core"
import type { Binding } from "@opentui/keymap"
import type { BindingConfig, BindingDefaults } from "@opentui/keymap/extras"
import { Schema } from "effect"

const KeyStroke = Schema.Struct({
  name: Schema.String,
  ctrl: Schema.optional(Schema.Boolean),
  shift: Schema.optional(Schema.Boolean),
  meta: Schema.optional(Schema.Boolean),
  super: Schema.optional(Schema.Boolean),
  hyper: Schema.optional(Schema.Boolean),
})

const BindingObject = Schema.StructWithRest(
  Schema.Struct({
    key: Schema.Union([Schema.String, KeyStroke]),
    event: Schema.optional(Schema.Literals(["press", "release"])),
    preventDefault: Schema.optional(Schema.Boolean),
    fallthrough: Schema.optional(Schema.Boolean),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

const BindingItem = Schema.Union([Schema.String, KeyStroke, BindingObject])
export const BindingValueSchema = Schema.Union([
  Schema.Literal(false),
  Schema.Literal("none"),
  BindingItem,
  Schema.Array(BindingItem),
]).annotate({ identifier: "TuiKeybind.BindingValue" })
export type BindingValueSchema = Schema.Schema.Type<typeof BindingValueSchema>

type Definition = {
  default: BindingValueSchema
  description: string
}

export const LeaderDefault = "ctrl+x"

const keybind = (value: Definition["default"], description: string): Definition => ({ default: value, description })

export const Definitions = {
  leader: keybind(LeaderDefault, "按键绑定组合的 Leader 键"),

  "app.exit": keybind("ctrl+c,ctrl+d,<leader>q", "退出应用"),
  "app.clear": keybind("ctrl+l", "在 mini 中清屏"),
  "app.debug": keybind("none", "切换调试面板"),
  "app.console": keybind("none", "切换控制台"),
  "app.scrap": keybind("none", "打开草稿界面"),
  "app.toggle.animations": keybind("none", "切换动画"),
  "app.toggle.file_context": keybind("none", "切换文件上下文"),
  "app.toggle.diffwrap": keybind("none", "切换 diff 换行"),
  "app.toggle.paste_summary": keybind("none", "切换粘贴摘要"),
  "command.palette.show": keybind("ctrl+p", "列出可用命令"),
  "help.show": keybind("none", "打开帮助对话框"),
  "docs.open": keybind("none", "打开文档"),
  "opencode.settings": keybind("none", "打开设置"),
  "server.pair": keybind("none", "配对设备"),
  "service.restart": keybind("none", "重启服务"),
  "location.reload": keybind("none", "重新加载配置"),
  "diff.open": keybind("none", "打开 diff 查看器"),
  "diff.close": keybind("escape,q", "关闭 diff 查看器"),
  "diff.down": keybind("j,down", "在 diff 查看器中下移"),
  "diff.up": keybind("k,up", "在 diff 查看器中上移"),
  "diff.page.down": keybind("pagedown,ctrl+f", "diff 查看器向下翻页"),
  "diff.page.up": keybind("pageup,ctrl+b", "diff 查看器向上翻页"),
  "diff.half_page.down": keybind("ctrl+d", "diff 查看器向下滚动半页"),
  "diff.half_page.up": keybind("ctrl+u", "diff 查看器向上滚动半页"),
  "diff.first": keybind("gg,home", "跳到 diff 开头"),
  "diff.last": keybind("shift+g,end", "跳到 diff 末尾"),
  // Retain shipped configuration names without registering the removed tree navigation commands.
  "diff.toggle": keybind("none", "已弃用：文件树由鼠标控制"),
  "diff.expand": keybind("none", "已弃用：文件树由鼠标控制"),
  "diff.expand_all": keybind("none", "已弃用：文件树由鼠标控制"),
  "diff.collapse": keybind("none", "已弃用：文件树由鼠标控制"),
  "diff.switch_focus": keybind("none", "已弃用：键盘导航始终控制 diff"),
  "diff.next_hunk": keybind("]", "跳到下一个 diff 块"),
  "diff.previous_hunk": keybind("[", "跳到上一个 diff 块"),
  "diff.next_file": keybind("n,alt+down", "跳到下一个 diff 文件"),
  "diff.previous_file": keybind("p,alt+up", "跳到上一个 diff 文件"),
  "diff.toggle_file_tree": keybind("b", "切换 diff 查看器文件树"),
  "diff.single_patch": keybind("s", "切换单补丁视图"),
  "diff.switch_source": keybind("d", "切换 diff 查看器来源"),
  "diff.toggle_view": keybind("v", "切换 diff 查看器的拆分或统一视图"),
  "diff.toggle_fullscreen": keybind("f", "切换 diff 查看器全屏"),
  "diff.mark_reviewed": keybind("m", "切换所选 diff 文件的已审阅状态"),
  "diff.help": keybind("?,shift+?,shift+/", "显示更多 diff 查看器快捷键"),

  "files.open": keybind("shift+f", "打开文件浏览器"),
  "files.close": keybind("escape", "关闭文件浏览器"),
  "files.parent": keybind("backspace,left", "返回上一级文件或目录"),
  "files.edit": keybind("e", "在内部编辑当前文件"),
  "files.external": keybind("ctrl+f", "用外部编辑器打开当前文件"),
  "files.save": keybind("ctrl+s", "保存当前文件"),
  "files.up": keybind("k,up", "向上移动文件选择"),
  "files.down": keybind("j,down", "向下移动文件选择"),
  "files.page_up": keybind("pageup,ctrl+b", "向上翻页文件列表"),
  "files.page_down": keybind("pagedown", "向下翻页文件列表"),
  "files.home": keybind("gg,home", "跳到文件列表开头"),
  "files.end": keybind("shift+g,end", "跳到文件列表结尾"),
  "files.select": keybind("return", "打开所选文件或目录"),
  "files.refresh": keybind("r", "刷新文件列表"),

  "prompt.editor": keybind("<leader>e", "打开外部编辑器"),
  "theme.switch": keybind("none", "列出可用主题"),
  "theme.switch_mode": keybind("none", "在浅色和深色主题模式之间切换"),
  "theme.mode.lock": keybind("none", "锁定或解锁主题模式"),
  "session.sidebar.toggle": keybind("<leader>b", "切换侧边栏"),
  "pane.focus.left": keybind("<leader>left", "聚焦会话面板"),
  "pane.focus.right": keybind("<leader>right", "聚焦右侧面板"),
  "terminal.select": keybind("<leader>down", "选择终端"),
  "terminal.toggle": keybind("<leader>t", "切换终端面板"),
  "terminal.close": keybind("<leader>up", "关闭终端面板"),
  "session.toggle.scrollbar": keybind("none", "切换会话滚动条"),
  "opencode.status": keybind("<leader>s", "查看状态"),
  "opencode.debug": keybind("none", "查看调试信息"),

  "session.export": keybind("<leader>x", "将会话导出到编辑器"),
  "session.copy": keybind("none", "复制会话记录"),
  "session.copy.id": keybind("none", "复制会话 ID"),
  "session.move": keybind("none", "管理工作区"),
  "session.new": keybind("<leader>n", "创建新会话"),
  "session.list": keybind("<leader>l", "列出所有会话"),
  "open.menu": keybind("ctrl+o", "打开最近的会话和项目"),
  "session.tab.next": keybind("ctrl+tab,alt+down", "切换到下一个打开的会话标签页"),
  "session.tab.previous": keybind("ctrl+shift+tab,alt+up", "切换到上一个打开的会话标签页"),
  "session.tab.history.back": keybind("none", "在会话标签页历史中后退"),
  "session.tab.history.forward": keybind("ctrl+i", "在会话标签页历史中前进"),
  "session.tab.next_unread": keybind("alt+shift+down", "切换到下一个未读会话标签页"),
  "session.tab.previous_unread": keybind("alt+shift+up", "切换到上一个未读会话标签页"),
  "session.tab.close": keybind("<leader>w", "关闭当前会话标签页"),
  "session.tab.reopen": keybind("ctrl+shift+t", "重新打开上次关闭的会话标签页"),
  "session.timeline": keybind("<leader>g", "显示会话时间线"),
  "session.fork": keybind("none", "从消息分叉会话"),
  "session.rename": keybind("ctrl+r", "重命名会话"),
  "session.delete": keybind("ctrl+d", "删除会话"),
  // Retain shipped configuration names; session sharing was removed.
  "session.share": keybind("none", "已弃用：会话共享已移除"),
  "session.unshare": keybind("none", "已弃用：会话共享已移除"),
  "session.interrupt": keybind("escape", "中断当前会话"),
  "session.background": keybind("ctrl+b", "将阻塞的会话工具置于后台"),
  "session.compact": keybind("<leader>c", "压缩会话"),
  "session.aside": keybind("none", "提出附带问题"),
  "session.cd": keybind("none", "更改工作目录"),
  "session.queued_prompts": keybind("<leader>q", "管理排队的提示"),
  "queued_prompt.undo": keybind("ctrl+u", "撤销排队的提示"),
  "queued_prompt.delete": keybind("ctrl+d", "删除排队的提示"),
  "session.toggle.exploration_grouping": keybind("none", "切换相关工具调用分组"),
  "session.verbosity.cycle": keybind("none", "循环切换记录详细程度"),
  "session.child.first": keybind("down", "切换子 agent 选择器"),
  "session.child.next": keybind("right", "转到下一个子会话"),
  "session.child.previous": keybind("left", "转到上一个子会话"),
  "session.parent": keybind("up", "转到父会话"),
  "session.pin.toggle": keybind("ctrl+f", "在会话列表中固定或取消固定会话"),
  "session.quick_switch.1": keybind("<leader>1", "切换到快速槽位 1 中的会话"),
  "session.quick_switch.2": keybind("<leader>2", "切换到快速槽位 2 中的会话"),
  "session.quick_switch.3": keybind("<leader>3", "切换到快速槽位 3 中的会话"),
  "session.quick_switch.4": keybind("<leader>4", "切换到快速槽位 4 中的会话"),
  "session.quick_switch.5": keybind("<leader>5", "切换到快速槽位 5 中的会话"),
  "session.quick_switch.6": keybind("<leader>6", "切换到快速槽位 6 中的会话"),
  "session.quick_switch.7": keybind("<leader>7", "切换到快速槽位 7 中的会话"),
  "session.quick_switch.8": keybind("<leader>8", "切换到快速槽位 8 中的会话"),
  "session.quick_switch.9": keybind("<leader>9", "切换到快速槽位 9 中的会话"),
  "session.tab.select.1": keybind("<leader>1,ctrl+1", "切换到会话标签页 1"),
  "session.tab.select.2": keybind("<leader>2,ctrl+2", "切换到会话标签页 2"),
  "session.tab.select.3": keybind("<leader>3,ctrl+3", "切换到会话标签页 3"),
  "session.tab.select.4": keybind("<leader>4,ctrl+4", "切换到会话标签页 4"),
  "session.tab.select.5": keybind("<leader>5,ctrl+5", "切换到会话标签页 5"),
  "session.tab.select.6": keybind("<leader>6,ctrl+6", "切换到会话标签页 6"),
  "session.tab.select.7": keybind("<leader>7,ctrl+7", "切换到会话标签页 7"),
  "session.tab.select.8": keybind("<leader>8,ctrl+8", "切换到会话标签页 8"),
  "session.tab.select.9": keybind("<leader>9,ctrl+9", "切换到会话标签页 9"),
  "session.tab.select.10": keybind("<leader>0,ctrl+0", "切换到会话标签页 10"),

  "stash.delete": keybind("ctrl+d", "删除暂存条目"),
  "model.dialog.provider": keybind("ctrl+a", "从模型对话框打开提供商列表"),
  "model.dialog.favorite": keybind("ctrl+f", "切换模型收藏状态"),
  "model.list": keybind("<leader>m", "列出可用模型"),
  "model.cycle_recent": keybind("f2", "下一个最近使用的模型"),
  "model.cycle_recent_reverse": keybind("shift+f2", "上一个最近使用的模型"),
  "model.cycle_favorite": keybind("none", "下一个收藏的模型"),
  "model.cycle_favorite_reverse": keybind("none", "上一个收藏的模型"),
  "mcp.list": keybind("none", "列出 MCP 服务器"),
  "provider.connect": keybind("none", "连接集成"),
  "agent.list": keybind("<leader>a", "列出 agent"),
  "agent.cycle": keybind("shift+tab", "下一个 agent"),
  "agent.cycle.reverse": keybind("none", "上一个 agent"),
  "variant.cycle": keybind("ctrl+t", "循环切换模型变体"),
  "variant.list": keybind("none", "列出模型变体"),

  "session.page.up": keybind("pageup,ctrl+alt+b", "向上滚动一页消息"),
  "session.page.down": keybind("pagedown,ctrl+alt+f", "向下滚动一页消息"),
  "session.line.up": keybind("ctrl+alt+y", "向上滚动一行消息"),
  "session.line.down": keybind("ctrl+alt+e", "向下滚动一行消息"),
  "session.half.page.up": keybind("ctrl+alt+u", "向上滚动半页消息"),
  "session.half.page.down": keybind("ctrl+alt+d", "向下滚动半页消息"),
  "session.first": keybind("ctrl+g,home,alt+home", "跳到第一条消息"),
  "session.last": keybind("ctrl+alt+g,end", "跳到最后一条消息"),
  "session.message.next": keybind("none", "跳到下一条消息"),
  "session.message.previous": keybind("none", "跳到上一条消息"),
  "session.message.user.next": keybind("none", "跳到下一条用户消息"),
  "session.message.user.previous": keybind("none", "跳到上一条用户消息"),
  "session.messages_last_user": keybind("alt+end", "跳到最后一条用户消息"),
  "messages.copy": keybind("<leader>y", "复制消息"),
  "session.undo": keybind("<leader>u", "撤销消息"),
  "session.redo": keybind("<leader>r", "重做消息"),
  "session.toggle.thinking": keybind("none", "切换思考块的可见性"),

  "prompt.submit": keybind("none", "提交提示"),
  "prompt.queue": keybind("<leader>return", "将提示加入队列"),
  "prompt.editor_context.clear": keybind("none", "清除编辑器上下文"),
  "prompt.images.view": keybind("<leader>i", "查看图片附件"),
  "prompt.skills": keybind("none", "打开技能选择器"),
  "prompt.stash": keybind("none", "暂存提示"),
  "prompt.stash.pop": keybind("none", "弹出暂存的提示"),
  "prompt.stash.list": keybind("none", "列出暂存的提示"),

  "prompt.clear": keybind("ctrl+c", "清空输入框"),
  "prompt.paste": keybind({ key: "ctrl+v", preventDefault: false }, "从剪贴板粘贴"),
  "input.submit": keybind("return", "提交输入"),
  "input.newline": keybind("shift+return,ctrl+return,alt+return,ctrl+j", "在输入中插入换行"),
  "input.move.left": keybind("left,ctrl+b", "在输入中左移光标"),
  "input.move.right": keybind("right,ctrl+f", "在输入中右移光标"),
  "input.move.up": keybind("up", "在输入中上移光标"),
  "input.move.down": keybind("down", "在输入中下移光标"),
  "input.select.left": keybind("shift+left", "在输入中向左选择"),
  "input.select.right": keybind("shift+right", "在输入中向右选择"),
  "input.select.up": keybind("shift+up", "在输入中向上选择"),
  "input.select.down": keybind("shift+down", "在输入中向下选择"),
  "input.line.home": keybind("ctrl+a", "在输入中移到行首"),
  "input.line.end": keybind("ctrl+e", "在输入中移到行尾"),
  "input.select.line.home": keybind("ctrl+shift+a", "在输入中选择到行首"),
  "input.select.line.end": keybind("ctrl+shift+e", "在输入中选择到行尾"),
  "input.visual.line.home": keybind("alt+a", "在输入中移到可视行首"),
  "input.visual.line.end": keybind("alt+e", "在输入中移到可视行尾"),
  "input.select.visual.line.home": keybind("alt+shift+a", "在输入中选择到可视行首"),
  "input.select.visual.line.end": keybind("alt+shift+e", "在输入中选择到可视行尾"),
  "input.buffer.home": keybind("none", "在输入中移到缓冲区开头"),
  "input.buffer.end": keybind("none", "在输入中移到缓冲区末尾"),
  "input.select.buffer.home": keybind("shift+home", "在输入中选择到缓冲区开头"),
  "input.select.buffer.end": keybind("shift+end", "在输入中选择到缓冲区末尾"),
  "input.delete.line": keybind("ctrl+shift+d", "在输入中删除整行"),
  "input.delete.to.line.end": keybind("ctrl+k", "在输入中删除到行尾"),
  "input.delete.to.line.start": keybind("ctrl+u", "在输入中删除到行首"),
  "input.backspace": keybind("backspace,shift+backspace", "在输入中退格"),
  "input.delete": keybind("ctrl+d,delete,shift+delete", "在输入中删除字符"),
  "input.undo": keybind("ctrl+-,super+z", "在输入中撤销"),
  "input.redo": keybind("ctrl+.,super+shift+z", "在输入中重做"),
  "input.word.forward": keybind("alt+f,alt+right,ctrl+right", "在输入中向前移动一个词"),
  "input.word.backward": keybind("alt+b,alt+left,ctrl+left", "在输入中向后移动一个词"),
  "input.select.word.forward": keybind("alt+shift+f,alt+shift+right", "在输入中向前选择词"),
  "input.select.word.backward": keybind("alt+shift+b,alt+shift+left", "在输入中向后选择词"),
  "input.delete.word.forward": keybind("alt+d,alt+delete,ctrl+delete", "在输入中向前删除词"),
  "input.delete.word.backward": keybind("ctrl+w,ctrl+backspace,alt+backspace", "在输入中向后删除词"),
  "input.select.all": keybind("super+a", "在输入中全选"),
  "prompt.history.previous": keybind("up", "上一个历史条目"),
  "prompt.history.next": keybind("down", "下一个历史条目"),

  "composer.subagent.up": keybind("up", "上一个子 agent"),
  "composer.subagent.down": keybind("down", "下一个子 agent"),
  "composer.subagent.select": keybind("return", "跳转到子 agent"),
  "composer.subagent.interrupt": keybind("ctrl+d", "中断子 agent"),
  "composer.shell.up": keybind("up", "上一个 shell"),
  "composer.shell.down": keybind("down", "下一个 shell"),
  "composer.shell.select": keybind("return", "查看 shell 输出"),
  "composer.shell.kill": keybind("ctrl+d", "终止 shell 命令"),
  "composer.terminal.up": keybind("up,k", "上一个终端"),
  "composer.terminal.down": keybind("down,j", "下一个终端"),
  "composer.terminal.select": keybind("return", "选择终端"),

  "dialog.select.prev": keybind("up,ctrl+p", "移到上一个对话框项"),
  "dialog.select.next": keybind("down,ctrl+n", "移到下一个对话框项"),
  "dialog.select.page_up": keybind("pageup", "在对话框中向上翻一页"),
  "dialog.select.page_down": keybind("pagedown", "在对话框中向下翻一页"),
  "dialog.select.home": keybind("home", "移到第一个对话框项"),
  "dialog.select.end": keybind("end", "移到最后一个对话框项"),
  "dialog.select.submit": keybind("return", "提交所选的对话框项"),
  "dialog.prompt.submit": keybind("return", "提交对话框提示"),
  "dialog.integration.rename": keybind("ctrl+r", "重命名集成账号"),
  "dialog.integration.delete": keybind("ctrl+d", "删除集成账号"),
  "dialog.worktree.generate": keybind("tab", "生成工作树名称"),
  "dialog.move_session.new": keybind("ctrl+a", "新建工作树"),
  "dialog.move_session.move": keybind("ctrl+m", "将会话移到工作树"),
  "dialog.move_session.delete": keybind("ctrl+d", "删除工作树"),
  "dialog.move_session.refresh": keybind("ctrl+r", "刷新工作树"),
  "prompt.autocomplete.prev": keybind("up,ctrl+p", "移到上一个自动补全项"),
  "prompt.autocomplete.next": keybind("down,ctrl+n", "移到下一个自动补全项"),
  "prompt.autocomplete.hide": keybind("escape", "隐藏自动补全"),
  "prompt.autocomplete.select": keybind("return", "选择自动补全项"),
  "prompt.autocomplete.complete": keybind("tab", "补全自动补全项"),
  "permission.prompt.fullscreen": keybind("ctrl+f", "切换权限提示全屏"),
  "plugins.toggle": keybind("return", "切换插件"),
  "dialog.mcp.toggle": keybind("space", "切换 MCP 服务器"),
  "dialog.plugins.error": keybind("space", "查看插件错误"),
  "dialog.plugins.update": keybind("ctrl+u", "从插件对话框更新插件"),
  "dialog.plugins.check": keybind("ctrl+r", "从插件对话框检查插件更新"),

  "terminal.suspend": keybind("ctrl+z", "挂起终端"),
  "terminal.title.toggle": keybind("none", "切换终端标题"),
  "plugins.list": keybind("none", "打开插件管理器对话框"),

  "which-key.toggle": keybind("ctrl+alt+k", "切换 which-key 面板"),
  "which-key.layout.toggle": keybind("ctrl+alt+shift+k", "切换 which-key 布局"),
  "which-key.pending.toggle": keybind("ctrl+alt+shift+p", "切换 which-key 待定预览"),
  "which-key.group.previous": keybind("ctrl+alt+left,ctrl+alt+[", "上一个 which-key 分组"),
  "which-key.group.next": keybind("ctrl+alt+right,ctrl+alt+]", "下一个 which-key 分组"),
  "which-key.scroll.up": keybind("ctrl+alt+up,ctrl+alt+p", "向上滚动 which-key"),
  "which-key.scroll.down": keybind("ctrl+alt+down,ctrl+alt+n", "向下滚动 which-key"),
  "which-key.page.up": keybind("ctrl+alt+pageup", "which-key 向上翻页"),
  "which-key.page.down": keybind("ctrl+alt+pagedown", "which-key 向下翻页"),
  "which-key.home": keybind("ctrl+alt+home", "跳到第一个 which-key 绑定"),
  "which-key.end": keybind("ctrl+alt+end", "跳到最后一个 which-key 绑定"),
} satisfies Record<string, Definition>

type KeybindName = keyof typeof Definitions
const KeybindNames = new Set<string>(Object.keys(Definitions))

export const KeybindOverrides = Schema.Struct(
  Object.fromEntries(
    Object.entries(Definitions).map(([name, item]) => [
      name,
      Schema.optional(BindingValueSchema).annotate({ description: item.description }),
    ]),
  ),
).annotate({ description: "TUI 按键绑定覆盖项" })
export const Descriptions = Object.fromEntries(
  Object.entries(Definitions).map(([name, item]) => [name, item.description]),
) as Record<KeybindName, string>

export type Keybinds = { [K in KeybindName]: BindingValueSchema }
export type KeybindOverrides = Partial<Keybinds>
export type BindingLookupView = {
  readonly bindings: readonly Binding<Renderable, KeyEvent>[]
  get(command: string): readonly Binding<Renderable, KeyEvent>[]
  has(command: string): boolean
  gather(name: string, commands: readonly string[]): readonly Binding<Renderable, KeyEvent>[]
  pick(name: string, commands: readonly string[]): Binding<Renderable, KeyEvent>[]
  omit(name: string, commands: readonly string[]): Binding<Renderable, KeyEvent>[]
}

export function toBindingConfig(keybinds: Keybinds): BindingConfig<Renderable, KeyEvent> {
  return Object.fromEntries(Object.entries(keybinds)) as BindingConfig<Renderable, KeyEvent>
}

const decodeBindingValue = Schema.decodeUnknownSync(BindingValueSchema)

export function defaultValue(name: KeybindName) {
  return Definitions[name].default
}

export function parse(keybinds: KeybindOverrides): Keybinds {
  const invalid = unknownKeys(keybinds)
  if (invalid.length) throw new Error(`Unrecognized keybind${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`)
  return Object.fromEntries(
    Object.entries(Definitions).map(([name, item]) => [
      name,
      decodeBindingValue(keybinds[name as KeybindName] ?? item.default),
    ]),
  ) as Keybinds
}

export function unknownKeys(input: object) {
  return Object.keys(input).filter((key) => !KeybindNames.has(key))
}

export function bindingDefaults(): BindingDefaults<Renderable, KeyEvent> {
  return ({ command, binding }) => {
    if (binding.desc !== undefined) return
    return { desc: Descriptions[command as KeybindName] }
  }
}
