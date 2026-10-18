export * as TuiKeybind from "./keybind"

import type { KeyEvent, Renderable } from "@opentui/core"
import type { Binding } from "@opentui/keymap"
import type { BindingCommandMap, BindingConfig, BindingDefaults } from "@opentui/keymap/extras"
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
])
export type BindingValueSchema = Schema.Schema.Type<typeof BindingValueSchema>

type Definition = {
  default: BindingValueSchema
  description: string
}

export const LeaderDefault = "ctrl+x"

const keybind = (value: Definition["default"], description: string): Definition => ({ default: value, description })

export const Definitions = {
  leader: keybind(LeaderDefault, "按键绑定组合的 Leader 键"),

  app_exit: keybind("ctrl+c,ctrl+d,<leader>q", "退出应用"),
  app_debug: keybind("none", "切换调试面板"),
  app_console: keybind("none", "切换控制台"),
  app_heap_snapshot: keybind("none", "写入堆快照"),
  app_toggle_animations: keybind("none", "切换动画"),
  app_toggle_file_context: keybind("none", "切换文件上下文"),
  app_toggle_diffwrap: keybind("none", "切换 diff 换行"),
  app_toggle_paste_summary: keybind("none", "切换粘贴摘要"),
  command_list: keybind("ctrl+p", "列出可用命令"),
  help_show: keybind("none", "打开帮助对话框"),
  docs_open: keybind("none", "打开文档"),
  diff_open: keybind("none", "打开 diff 查看器"),
  diff_close: keybind("escape,q", "关闭 diff 查看器"),
  diff_toggle: keybind("enter,space", "切换 diff 查看器项"),
  diff_expand: keybind("right", "展开 diff 查看器项"),
  diff_expand_all: keybind("E", "展开所有 diff 查看器文件夹"),
  diff_collapse: keybind("left", "折叠 diff 查看器项"),
  diff_switch_focus: keybind("tab", "切换 diff 查看器焦点"),
  diff_next_hunk: keybind("]", "跳到下一个 diff 块"),
  diff_previous_hunk: keybind("[", "跳到上一个 diff 块"),
  diff_next_file: keybind("n", "跳到下一个 diff 文件"),
  diff_previous_file: keybind("p", "跳到上一个 diff 文件"),
  diff_toggle_file_tree: keybind("b", "切换 diff 查看器文件树"),
  diff_single_patch: keybind("s", "切换单补丁视图"),
  diff_switch_source: keybind("d", "切换 diff 查看器来源"),
  diff_toggle_view: keybind("v", "切换 diff 查看器的拆分或统一视图"),
  diff_help: keybind("?", "显示更多 diff 查看器快捷键"),

  editor_open: keybind("<leader>e", "打开外部编辑器"),
  theme_list: keybind("<leader>t", "列出可用主题"),
  theme_switch_mode: keybind("none", "在浅色和深色主题模式之间切换"),
  theme_mode_lock: keybind("none", "锁定或解锁主题模式"),
  sidebar_toggle: keybind("<leader>b", "切换侧边栏"),
  scrollbar_toggle: keybind("none", "切换会话滚动条"),
  status_view: keybind("<leader>s", "查看状态"),
  debug_view: keybind("none", "查看调试信息"),

  session_export: keybind("<leader>x", "将会话导出到编辑器"),
  session_copy: keybind("none", "复制会话记录"),
  session_move: keybind("none", "移动会话"),
  session_new: keybind("<leader>n", "创建新会话"),
  session_list: keybind("<leader>l", "列出所有会话"),
  open_menu: keybind("ctrl+o", "打开最近的会话和项目"),
  session_tab_next: keybind("ctrl+tab,alt+down", "切换到下一个打开的标签页"),
  session_tab_previous: keybind("ctrl+shift+tab,alt+up", "切换到上一个打开的标签页"),
  session_tab_next_unread: keybind("alt+shift+down", "切换到下一个未读标签页"),
  session_tab_previous_unread: keybind("alt+shift+up", "切换到上一个未读标签页"),
  session_tab_close: keybind("<leader>w", "关闭当前标签页"),
  session_tab_reopen: keybind("ctrl+shift+t", "重新打开上次关闭的标签页"),
  session_timeline: keybind("<leader>g", "显示会话时间线"),
  session_fork: keybind("none", "从消息分叉会话"),
  session_rename: keybind("ctrl+r", "重命名会话"),
  session_delete: keybind("ctrl+d", "删除会话"),
  session_share: keybind("none", "已弃用：会话共享已移除"),
  session_unshare: keybind("none", "已弃用：会话共享已移除"),
  session_interrupt: keybind("escape", "中断当前会话"),
  session_background: keybind("ctrl+b", "将阻塞的会话工具置于后台"),
  session_compact: keybind("<leader>c", "压缩会话"),
  session_queued_prompts: keybind("<leader>q", "查看排队的提示"),
  queued_prompt_delete: keybind("ctrl+d", "删除排队的提示"),
  session_child_first: keybind("down", "切换子 agent 选择器"),
  session_parent: keybind("up", "转到父会话"),
  session_pin_toggle: keybind("ctrl+f", "在会话列表中固定或取消固定会话"),
  session_quick_switch_1: keybind("<leader>1", "切换到快速槽位 1 中的会话"),
  session_quick_switch_2: keybind("<leader>2", "切换到快速槽位 2 中的会话"),
  session_quick_switch_3: keybind("<leader>3", "切换到快速槽位 3 中的会话"),
  session_quick_switch_4: keybind("<leader>4", "切换到快速槽位 4 中的会话"),
  session_quick_switch_5: keybind("<leader>5", "切换到快速槽位 5 中的会话"),
  session_quick_switch_6: keybind("<leader>6", "切换到快速槽位 6 中的会话"),
  session_quick_switch_7: keybind("<leader>7", "切换到快速槽位 7 中的会话"),
  session_quick_switch_8: keybind("<leader>8", "切换到快速槽位 8 中的会话"),
  session_quick_switch_9: keybind("<leader>9", "切换到快速槽位 9 中的会话"),
  session_tab_select_1: keybind("<leader>1,ctrl+1", "切换到标签页 1"),
  session_tab_select_2: keybind("<leader>2,ctrl+2", "切换到标签页 2"),
  session_tab_select_3: keybind("<leader>3,ctrl+3", "切换到标签页 3"),
  session_tab_select_4: keybind("<leader>4,ctrl+4", "切换到标签页 4"),
  session_tab_select_5: keybind("<leader>5,ctrl+5", "切换到标签页 5"),
  session_tab_select_6: keybind("<leader>6,ctrl+6", "切换到标签页 6"),
  session_tab_select_7: keybind("<leader>7,ctrl+7", "切换到标签页 7"),
  session_tab_select_8: keybind("<leader>8,ctrl+8", "切换到标签页 8"),
  session_tab_select_9: keybind("<leader>9,ctrl+9", "切换到标签页 9"),
  session_tab_select_10: keybind("<leader>0,ctrl+0", "切换到标签页 10"),

  stash_delete: keybind("ctrl+d", "删除暂存条目"),
  model_provider_list: keybind("ctrl+a", "从模型对话框打开提供商列表"),
  model_favorite_toggle: keybind("ctrl+f", "切换模型收藏状态"),
  model_list: keybind("<leader>m", "列出可用模型"),
  model_cycle_recent: keybind("f2", "下一个最近使用的模型"),
  model_cycle_recent_reverse: keybind("shift+f2", "上一个最近使用的模型"),
  model_cycle_favorite: keybind("none", "下一个收藏的模型"),
  model_cycle_favorite_reverse: keybind("none", "上一个收藏的模型"),
  mcp_list: keybind("none", "列出 MCP 服务器"),
  provider_connect: keybind("none", "连接一个集成"),
  agent_list: keybind("<leader>a", "列出 agent"),
  agent_cycle: keybind("shift+tab", "下一个 agent"),
  agent_cycle_reverse: keybind("none", "上一个 agent"),
  variant_cycle: keybind("ctrl+t", "循环切换模型变体"),
  variant_list: keybind("none", "列出模型变体"),

  messages_page_up: keybind("pageup,ctrl+alt+b", "向上滚动一页消息"),
  messages_page_down: keybind("pagedown,ctrl+alt+f", "向下滚动一页消息"),
  messages_line_up: keybind("ctrl+alt+y", "向上滚动一行消息"),
  messages_line_down: keybind("ctrl+alt+e", "向下滚动一行消息"),
  messages_half_page_up: keybind("ctrl+alt+u", "向上滚动半页消息"),
  messages_half_page_down: keybind("ctrl+alt+d", "向下滚动半页消息"),
  messages_first: keybind("ctrl+g,home,alt+home", "跳到第一条消息"),
  messages_last: keybind("ctrl+alt+g,end", "跳到最后一条消息"),
  messages_next: keybind("none", "跳到下一条消息"),
  messages_previous: keybind("none", "跳到上一条消息"),
  messages_next_user: keybind("none", "跳到下一条用户消息"),
  messages_previous_user: keybind("none", "跳到上一条用户消息"),
  messages_last_user: keybind("alt+end", "跳到最后一条用户消息"),
  messages_copy: keybind("<leader>y", "复制消息"),
  messages_undo: keybind("<leader>u", "撤销消息"),
  messages_redo: keybind("<leader>r", "重做消息"),
  display_thinking: keybind("none", "切换思考块的可见性"),

  prompt_submit: keybind("none", "提交提示"),
  prompt_queue: keybind("<leader>return", "将提示加入队列"),
  prompt_editor_context_clear: keybind("none", "清除编辑器上下文"),
  prompt_images_view: keybind("<leader>i", "查看图片附件"),
  prompt_skills: keybind("none", "打开技能选择器"),
  prompt_stash: keybind("none", "暂存提示"),
  prompt_stash_pop: keybind("none", "弹出暂存的提示"),
  prompt_stash_list: keybind("none", "列出暂存的提示"),

  input_clear: keybind("ctrl+c", "清空输入框"),
  input_paste: keybind({ key: "ctrl+v", preventDefault: false }, "从剪贴板粘贴"),
  input_submit: keybind("return", "提交输入"),
  input_newline: keybind("shift+return,ctrl+return,alt+return,ctrl+j", "在输入中插入换行"),
  input_move_left: keybind("left,ctrl+b", "在输入中左移光标"),
  input_move_right: keybind("right,ctrl+f", "在输入中右移光标"),
  input_move_up: keybind("up", "在输入中上移光标"),
  input_move_down: keybind("down", "在输入中下移光标"),
  input_select_left: keybind("shift+left", "在输入中向左选择"),
  input_select_right: keybind("shift+right", "在输入中向右选择"),
  input_select_up: keybind("shift+up", "在输入中向上选择"),
  input_select_down: keybind("shift+down", "在输入中向下选择"),
  input_line_home: keybind("ctrl+a", "在输入中移到行首"),
  input_line_end: keybind("ctrl+e", "在输入中移到行尾"),
  input_select_line_home: keybind("ctrl+shift+a", "在输入中选择到行首"),
  input_select_line_end: keybind("ctrl+shift+e", "在输入中选择到行尾"),
  input_visual_line_home: keybind("alt+a", "在输入中移到可视行首"),
  input_visual_line_end: keybind("alt+e", "在输入中移到可视行尾"),
  input_select_visual_line_home: keybind("alt+shift+a", "在输入中选择到可视行首"),
  input_select_visual_line_end: keybind("alt+shift+e", "在输入中选择到可视行尾"),
  input_buffer_home: keybind("none", "在输入中移到缓冲区开头"),
  input_buffer_end: keybind("none", "在输入中移到缓冲区末尾"),
  input_select_buffer_home: keybind("shift+home", "在输入中选择到缓冲区开头"),
  input_select_buffer_end: keybind("shift+end", "在输入中选择到缓冲区末尾"),
  input_delete_line: keybind("ctrl+shift+d", "在输入中删除整行"),
  input_delete_to_line_end: keybind("ctrl+k", "在输入中删除到行尾"),
  input_delete_to_line_start: keybind("ctrl+u", "在输入中删除到行首"),
  input_backspace: keybind("backspace,shift+backspace", "在输入中退格"),
  input_delete: keybind("ctrl+d,delete,shift+delete", "在输入中删除字符"),
  input_undo: keybind("ctrl+-,super+z", "在输入中撤销"),
  input_redo: keybind("ctrl+.,super+shift+z", "在输入中重做"),
  input_word_forward: keybind("alt+f,alt+right,ctrl+right", "在输入中向前移动一个词"),
  input_word_backward: keybind("alt+b,alt+left,ctrl+left", "在输入中向后移动一个词"),
  input_select_word_forward: keybind("alt+shift+f,alt+shift+right", "在输入中向前选择词"),
  input_select_word_backward: keybind("alt+shift+b,alt+shift+left", "在输入中向后选择词"),
  input_delete_word_forward: keybind("alt+d,alt+delete,ctrl+delete", "在输入中向前删除词"),
  input_delete_word_backward: keybind("ctrl+w,ctrl+backspace,alt+backspace", "在输入中向后删除词"),
  input_select_all: keybind("super+a", "在输入中全选"),
  history_previous: keybind("up", "上一个历史条目"),
  history_next: keybind("down", "下一个历史条目"),

  "dialog.select.prev": keybind("up,ctrl+p", "移到上一个对话框项"),
  "dialog.select.next": keybind("down,ctrl+n", "移到下一个对话框项"),
  "dialog.select.page_up": keybind("pageup", "在对话框中向上翻一页"),
  "dialog.select.page_down": keybind("pagedown", "在对话框中向下翻一页"),
  "dialog.select.home": keybind("home", "移到第一个对话框项"),
  "dialog.select.end": keybind("end", "移到最后一个对话框项"),
  "dialog.select.submit": keybind("return", "提交所选的对话框项"),
  "dialog.prompt.submit": keybind("return", "提交对话框提示"),
  "dialog.project_copy.generate": keybind("tab", "生成项目副本名称"),
  "dialog.move_session.new": keybind("ctrl+m", "新建项目副本"),
  "dialog.move_session.delete": keybind("ctrl+d", "删除项目副本"),
  "dialog.move_session.refresh": keybind("ctrl+r", "刷新项目副本"),
  "prompt.autocomplete.prev": keybind("up,ctrl+p", "移到上一个自动补全项"),
  "prompt.autocomplete.next": keybind("down,ctrl+n", "移到下一个自动补全项"),
  "prompt.autocomplete.hide": keybind("escape", "隐藏自动补全"),
  "prompt.autocomplete.select": keybind("return", "选择自动补全项"),
  "prompt.autocomplete.complete": keybind("tab", "补全自动补全项"),
  "permission.prompt.fullscreen": keybind("ctrl+f", "切换权限提示全屏"),
  "plugins.toggle": keybind("return", "切换插件"),
  "dialog.mcp.toggle": keybind("space", "切换 MCP 服务器"),

  terminal_suspend: keybind("ctrl+z", "挂起终端"),
  terminal_title_toggle: keybind("none", "切换终端标题"),
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
export const CommandMap = {
  app_exit: "app.exit",
  app_debug: "app.debug",
  app_console: "app.console",
  app_heap_snapshot: "app.heap_snapshot",
  app_toggle_animations: "app.toggle.animations",
  app_toggle_file_context: "app.toggle.file_context",
  app_toggle_diffwrap: "app.toggle.diffwrap",
  app_toggle_paste_summary: "app.toggle.paste_summary",
  command_list: "command.palette.show",
  help_show: "help.show",
  docs_open: "docs.open",
  diff_open: "diff.open",
  diff_close: "diff.close",
  diff_toggle: "diff.toggle",
  diff_expand: "diff.expand",
  diff_expand_all: "diff.expand_all",
  diff_collapse: "diff.collapse",
  diff_switch_focus: "diff.switch_focus",
  diff_next_hunk: "diff.next_hunk",
  diff_previous_hunk: "diff.previous_hunk",
  diff_next_file: "diff.next_file",
  diff_previous_file: "diff.previous_file",
  diff_toggle_file_tree: "diff.toggle_file_tree",
  diff_single_patch: "diff.single_patch",
  diff_switch_source: "diff.switch_source",
  diff_toggle_view: "diff.toggle_view",
  diff_help: "diff.help",
  editor_open: "prompt.editor",
  theme_list: "theme.switch",
  theme_switch_mode: "theme.switch_mode",
  theme_mode_lock: "theme.mode.lock",
  sidebar_toggle: "session.sidebar.toggle",
  scrollbar_toggle: "session.toggle.scrollbar",
  status_view: "opencode.status",
  debug_view: "opencode.debug",
  session_export: "session.export",
  session_copy: "session.copy",
  session_move: "session.move",
  session_new: "session.new",
  session_list: "session.list",
  open_menu: "open.menu",
  session_tab_next: "session.tab.next",
  session_tab_previous: "session.tab.previous",
  session_tab_next_unread: "session.tab.next_unread",
  session_tab_previous_unread: "session.tab.previous_unread",
  session_tab_close: "session.tab.close",
  session_tab_reopen: "session.tab.reopen",
  session_timeline: "session.timeline",
  session_fork: "session.fork",
  session_rename: "session.rename",
  session_delete: "session.delete",
  session_share: "session.share",
  session_unshare: "session.unshare",
  session_interrupt: "session.interrupt",
  session_background: "session.background",
  session_compact: "session.compact",
  session_queued_prompts: "session.queued_prompts",
  queued_prompt_delete: "queued_prompt.delete",
  session_child_first: "session.child.first",
  session_parent: "session.parent",
  session_pin_toggle: "session.pin.toggle",
  session_quick_switch_1: "session.quick_switch.1",
  session_quick_switch_2: "session.quick_switch.2",
  session_quick_switch_3: "session.quick_switch.3",
  session_quick_switch_4: "session.quick_switch.4",
  session_quick_switch_5: "session.quick_switch.5",
  session_quick_switch_6: "session.quick_switch.6",
  session_quick_switch_7: "session.quick_switch.7",
  session_quick_switch_8: "session.quick_switch.8",
  session_quick_switch_9: "session.quick_switch.9",
  session_tab_select_1: "session.tab.select.1",
  session_tab_select_2: "session.tab.select.2",
  session_tab_select_3: "session.tab.select.3",
  session_tab_select_4: "session.tab.select.4",
  session_tab_select_5: "session.tab.select.5",
  session_tab_select_6: "session.tab.select.6",
  session_tab_select_7: "session.tab.select.7",
  session_tab_select_8: "session.tab.select.8",
  session_tab_select_9: "session.tab.select.9",
  session_tab_select_10: "session.tab.select.10",
  stash_delete: "stash.delete",
  model_provider_list: "model.dialog.provider",
  model_favorite_toggle: "model.dialog.favorite",
  model_list: "model.list",
  model_cycle_recent: "model.cycle_recent",
  model_cycle_recent_reverse: "model.cycle_recent_reverse",
  model_cycle_favorite: "model.cycle_favorite",
  model_cycle_favorite_reverse: "model.cycle_favorite_reverse",
  mcp_list: "mcp.list",
  provider_connect: "provider.connect",
  agent_list: "agent.list",
  agent_cycle: "agent.cycle",
  agent_cycle_reverse: "agent.cycle.reverse",
  variant_cycle: "variant.cycle",
  variant_list: "variant.list",
  messages_page_up: "session.page.up",
  messages_page_down: "session.page.down",
  messages_line_up: "session.line.up",
  messages_line_down: "session.line.down",
  messages_half_page_up: "session.half.page.up",
  messages_half_page_down: "session.half.page.down",
  messages_first: "session.first",
  messages_last: "session.last",
  messages_next: "session.message.next",
  messages_previous: "session.message.previous",
  messages_next_user: "session.message.user.next",
  messages_previous_user: "session.message.user.previous",
  messages_last_user: "session.messages_last_user",
  messages_copy: "messages.copy",
  messages_undo: "session.undo",
  messages_redo: "session.redo",
  display_thinking: "session.toggle.thinking",
  prompt_submit: "prompt.submit",
  prompt_queue: "prompt.queue",
  prompt_editor_context_clear: "prompt.editor_context.clear",
  prompt_images_view: "prompt.images.view",
  prompt_skills: "prompt.skills",
  prompt_stash: "prompt.stash",
  prompt_stash_pop: "prompt.stash.pop",
  prompt_stash_list: "prompt.stash.list",
  input_clear: "prompt.clear",
  input_paste: "prompt.paste",
  input_submit: "input.submit",
  input_newline: "input.newline",
  input_move_left: "input.move.left",
  input_move_right: "input.move.right",
  input_move_up: "input.move.up",
  input_move_down: "input.move.down",
  input_select_left: "input.select.left",
  input_select_right: "input.select.right",
  input_select_up: "input.select.up",
  input_select_down: "input.select.down",
  input_line_home: "input.line.home",
  input_line_end: "input.line.end",
  input_select_line_home: "input.select.line.home",
  input_select_line_end: "input.select.line.end",
  input_visual_line_home: "input.visual.line.home",
  input_visual_line_end: "input.visual.line.end",
  input_select_visual_line_home: "input.select.visual.line.home",
  input_select_visual_line_end: "input.select.visual.line.end",
  input_buffer_home: "input.buffer.home",
  input_buffer_end: "input.buffer.end",
  input_select_buffer_home: "input.select.buffer.home",
  input_select_buffer_end: "input.select.buffer.end",
  input_delete_line: "input.delete.line",
  input_delete_to_line_end: "input.delete.to.line.end",
  input_delete_to_line_start: "input.delete.to.line.start",
  input_backspace: "input.backspace",
  input_delete: "input.delete",
  input_undo: "input.undo",
  input_redo: "input.redo",
  input_word_forward: "input.word.forward",
  input_word_backward: "input.word.backward",
  input_select_word_forward: "input.select.word.forward",
  input_select_word_backward: "input.select.word.backward",
  input_delete_word_forward: "input.delete.word.forward",
  input_delete_word_backward: "input.delete.word.backward",
  input_select_all: "input.select.all",
  history_previous: "prompt.history.previous",
  history_next: "prompt.history.next",
  terminal_suspend: "terminal.suspend",
  terminal_title_toggle: "terminal.title.toggle",
} satisfies BindingCommandMap
const CommandDescriptions = Object.fromEntries(
  Object.entries(Definitions).map(([name, item]) => [
    CommandMap[name as keyof typeof CommandMap] ?? name,
    item.description,
  ]),
) as Record<string, string>

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
    return { desc: CommandDescriptions[command] }
  }
}
