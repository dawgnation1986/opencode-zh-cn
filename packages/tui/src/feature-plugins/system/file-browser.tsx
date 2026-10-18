/** @jsxImportSource @opentui/solid */
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { LocationRef } from "@opencode/client"
import { Plugin } from "@opencode/plugin/tui"
import type { KeymapCommand, PanelInput, Route } from "@opencode/plugin/tui/context"
import {
  getTreeSitterClient,
  MouseButton,
  TextAttributes,
  type ScrollBoxRenderable,
  type TextareaRenderable,
} from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { DialogHeader, DialogLayout } from "../../ui/dialog"
import { useTheme, useThemes } from "../../context/theme"
import { useConfig } from "../../config"
import { detectExternalEditor, openFilePath } from "../../editor"
import { errorMessage } from "../../util/error"
import { filetype } from "../../util/filetype"
import { stringWidth } from "../../util/string-width"

const ROUTE = "files"
// Files above this size keep their leading bytes only: terminals cannot render an unbounded buffer.
const MAX_PREVIEW_BYTES = 256 * 1024
// A NUL byte in the leading window marks the file as binary, which the text renderer cannot show.
const BINARY_PROBE_BYTES = 8 * 1024

type PreviewState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "binary" }
  | { readonly kind: "empty" }
  | { readonly kind: "text"; readonly text: string; readonly truncated: boolean }

function entryName(path: string) {
  const trimmed = path.replace(/[\\/]+$/, "")
  const segment = trimmed.split(/[\\/]/).filter(Boolean).pop()
  return segment ?? trimmed
}

function parentDirectory(path: string) {
  const trimmed = path.replace(/[\\/]+$/, "")
  const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"))
  return separator === -1 ? "" : trimmed.slice(0, separator)
}

function joinPath(directory: string, name: string) {
  return directory === "" ? name : `${directory.replace(/[\\/]+$/, "")}/${name}`
}

function decode(bytes: Uint8Array): PreviewState {
  if (bytes.length === 0) return { kind: "empty" }
  if (bytes.subarray(0, BINARY_PROBE_BYTES).includes(0)) return { kind: "binary" }
  const slice = bytes.subarray(0, MAX_PREVIEW_BYTES)
  return { kind: "text", text: new TextDecoder().decode(slice), truncated: bytes.length > MAX_PREVIEW_BYTES }
}

function FileBrowser(props: {
  context: Plugin.Context
  sessionID?: string
  panel?: PanelInput
  onClose: () => void
}) {
  const theme = useTheme()
  const currentSyntax = useThemes().currentSyntax
  const config = useConfig()
  const dimensions = useTerminalDimensions()
  const [dir, setDir] = createSignal("")
  const [openFile, setOpenFile] = createSignal<string>()
  const [selected, setSelected] = createSignal(0)
  const [editing, setEditing] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [search, setSearch] = createSignal<string>()
  const [matchIndex, setMatchIndex] = createSignal(0)
  let textarea: TextareaRenderable | undefined
  let scroll: ScrollBoxRenderable | undefined

  const location = createMemo<LocationRef>(() => {
    const id = props.sessionID
    return id
      ? (props.context.data.session.get(id)?.location ?? props.context.data.location.default())
      : props.context.data.location.default()
  })
  const docked = () => props.panel?.presentation === "panel"
  const surface = () => (docked() ? theme.background.raised.base : theme.background.base)
  const focused = () => !docked() || props.panel?.focused === true

  const [entries, { refetch }] = createResource(
    () => ({ location: location(), path: dir() }),
    (input) => props.context.client.file.list({ location: input.location, path: input.path }),
  )
  const rows = () => (entries.error ? [] : (entries()?.data ?? []))
  const [previewData, { refetch: refetchPreview }] = createResource(openFile, (path) =>
    props.context.client.file.read({ path, location: location() }).then(decode),
  )
  const previewState = (): PreviewState => {
    if (previewData.loading) return { kind: "loading" }
    const value = previewData()
    if (previewData.error || !value) return { kind: "error" }
    return value
  }

  const pathLabel = () => openFile() ?? (dir() === "" ? "项目根目录" : dir())
  const previewText = () => {
    const state = previewState()
    return state.kind === "text" ? state.text : ""
  }
  const previewTruncated = () => {
    const state = previewState()
    return state.kind === "text" && state.truncated
  }

  // The previewed file wins; otherwise the highlighted row is the active target.
  const activeEntry = (): { path: string; isDirectory: boolean } | undefined => {
    const previewed = openFile()
    if (previewed) return { path: previewed, isDirectory: false }
    const entry = rows()[selected()]
    if (!entry) return undefined
    return { path: entry.path, isDirectory: entry.type === "directory" }
  }

  const absolutePath = (target: string) => path.resolve(location().directory, target)

  // Line numbers (0-based) in the previewed file that contain the current search term.
  const matchLines = createMemo(() => {
    const query = search()?.toLowerCase()
    if (!query) return []
    return previewText()
      .split("\n")
      .flatMap((line, index) => (line.toLowerCase().includes(query) ? [index] : []))
  })

  const scrollToLine = (line: number) => {
    if (scroll && !scroll.isDestroyed) scroll.scrollTo(Math.max(0, line))
  }

  // A dialog steals focus, and a click outside can blur the panel; restore both on demand.
  const refocus = () => {
    props.panel?.focus()
    requestAnimationFrame(() => {
      if (editing() && textarea && !textarea.isDestroyed) textarea.focus()
    })
  }

  const findInFile = async () => {
    if (!openFile()) {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "请先打开一个文件再进行搜索" })
      return
    }
    const query = await props.context.ui.dialog.prompt({ title: "在文件中搜索", placeholder: "输入要查找的内容" })
    refocus()
    if (!query) return
    setSearch(query)
    setMatchIndex(0)
    requestAnimationFrame(() => {
      const lines = matchLines()
      if (lines.length === 0) {
        setSearch(undefined)
        props.context.ui.toast.show({ variant: "info", title: "文件", message: `未找到“${query}”` })
        return
      }
      scrollToLine(lines[0]!)
      props.context.ui.toast.show({
        variant: "info",
        title: "文件",
        message: `共 ${lines.length} 处匹配，第 ${lines[0]! + 1} 行`,
      })
    })
  }

  const cycleMatch = (delta: number) => {
    const lines = matchLines()
    if (lines.length === 0) return
    const next = (matchIndex() + delta + lines.length) % lines.length
    setMatchIndex(next)
    scrollToLine(lines[next]!)
    props.context.ui.toast.show({
      variant: "info",
      title: "文件",
      message: `第 ${next + 1}/${lines.length} 处匹配，第 ${lines[next]! + 1} 行`,
    })
  }

  const gotoLine = async () => {
    if (!openFile()) {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "请先打开一个文件再跳转" })
      return
    }
    const total = previewText().split("\n").length
    const value = await props.context.ui.dialog.prompt({
      title: "跳转到行",
      description: `当前文件共 ${total} 行`,
      placeholder: "输入行号",
    })
    refocus()
    if (!value) return
    const line = Number.parseInt(value, 10)
    if (!Number.isInteger(line) || line < 1) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: "行号无效" })
      return
    }
    scrollToLine(line - 1)
    props.context.ui.toast.show({ variant: "info", title: "文件", message: `已跳转到第 ${line} 行` })
  }

  const createFile = async () => {
    const name = await props.context.ui.dialog.prompt({
      title: "新建文件",
      description: `位置：${dir() || "项目根目录"}`,
      placeholder: "输入文件名，例如 index.ts",
    })
    refocus()
    if (!name) return
    try {
      await writeFile(absolutePath(joinPath(dir(), name)), "")
      props.context.ui.toast.show({ variant: "success", title: "文件", message: `已创建 ${name}` })
      void refetch()
    } catch (error) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) })
    }
  }

  const createDirectory = async () => {
    const name = await props.context.ui.dialog.prompt({
      title: "新建目录",
      description: `位置：${dir() || "项目根目录"}`,
      placeholder: "输入目录名",
    })
    refocus()
    if (!name) return
    try {
      await mkdir(absolutePath(joinPath(dir(), name)), { recursive: true })
      props.context.ui.toast.show({ variant: "success", title: "文件", message: `已创建目录 ${name}` })
      void refetch()
    } catch (error) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) })
    }
  }

  const renameEntry = async () => {
    const target = activeEntry()
    if (!target) {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "请先选择一个文件或目录" })
      return
    }
    const current = entryName(target.path)
    const name = await props.context.ui.dialog.prompt({
      title: "重命名",
      description: target.path,
      value: current,
      placeholder: current,
    })
    refocus()
    if (!name || name === current) return
    try {
      await rename(absolutePath(target.path), absolutePath(joinPath(parentDirectory(target.path), name)))
      if (openFile() === target.path) setOpenFile(undefined)
      props.context.ui.toast.show({ variant: "success", title: "文件", message: `已重命名为 ${name}` })
      void refetch()
    } catch (error) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) })
    }
  }

  const deleteEntry = async () => {
    const target = activeEntry()
    if (!target) {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "请先选择一个文件或目录" })
      return
    }
    const name = entryName(target.path)
    const confirmed = await props.context.ui.dialog.confirm({
      title: "删除",
      message: `确定删除${target.isDirectory ? "目录" : "文件"} “${name}” 吗？此操作不可撤销。`,
      label: { confirm: "删除", cancel: "取消" },
    })
    refocus()
    if (!confirmed) return
    try {
      await rm(absolutePath(target.path), { recursive: true, force: true })
      if (openFile() === target.path) setOpenFile(undefined)
      props.context.ui.toast.show({ variant: "success", title: "文件", message: `已删除 ${name}` })
      void refetch()
    } catch (error) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) })
    }
  }

  createEffect(() => {
    // Every directory change starts the list at its first entry.
    void dir()
    setSelected(0)
  })
  createEffect(() => {
    const count = rows().length
    setSelected((current) => (count === 0 ? 0 : Math.min(current, count - 1)))
  })
  createEffect(() => {
    // Opening a different file invalidates the previous search and matches.
    void openFile()
    setSearch(undefined)
  })

  // Live syntax highlighting for the built-in editor: re-tokenize the buffer and apply
  // per-range styles. TextareaRenderable has no native highlighting, so we drive it here.
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let highlightJob = 0
  const scheduleHighlight = () => {
    if (!editing()) return
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => void applyHighlight(), 120)
  }
  const applyHighlight = async () => {
    const element = textarea
    const path = openFile()
    if (!element || element.isDestroyed || !path) return
    const language = filetype(path)
    const style = currentSyntax()
    if (!language || !style) return
    const content = element.plainText
    const job = (highlightJob += 1)
    const result = await getTreeSitterClient().highlightOnce(content, language).catch(() => undefined)
    if (!result?.highlights || job !== highlightJob || element.isDestroyed) return
    element.clearAllHighlights()
    for (const [start, end, group] of result.highlights) {
      if (start === end) continue
      const styleId = style.getStyleId(group)
      if (styleId === null) continue
      element.addHighlightByCharRange({ start, end, styleId })
    }
  }
  onCleanup(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
  })

  const clearHighlight = () => {
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightJob += 1
    if (textarea && !textarea.isDestroyed) textarea.clearAllHighlights()
  }

  createEffect(() => {
    if (!editing()) return
    // Re-focus the editor whenever it starts or the panel regains focus after a click elsewhere.
    if (props.panel && !props.panel.focused) return
    requestAnimationFrame(() => {
      if (textarea && !textarea.isDestroyed) textarea.focus()
    })
    scheduleHighlight()
  })

  const scrollSelectedIntoView = () => {
    if (!scroll || scroll.isDestroyed || openFile()) return
    const top = selected()
    if (top < scroll.scrollTop) {
      scroll.scrollTo(top)
      return
    }
    if (top + 1 > scroll.scrollTop + scroll.viewport.height) scroll.scrollTo(top + 1 - scroll.viewport.height)
  }

  const move = (delta: number) => {
    if (openFile()) {
      if (scroll && !scroll.isDestroyed) scroll.scrollBy(delta)
      return
    }
    const count = rows().length
    if (count === 0) return
    setSelected((current) => Math.max(0, Math.min(count - 1, current + delta)))
    requestAnimationFrame(scrollSelectedIntoView)
  }

  const page = (direction: 1 | -1) => {
    if (openFile()) {
      if (scroll && !scroll.isDestroyed) scroll.scrollBy(direction * Math.max(1, Math.floor(scroll.viewport.height)))
      return
    }
    move(direction * Math.max(1, scroll?.viewport.height ?? 10))
  }

  const jump = (edge: "home" | "end") => {
    if (openFile()) {
      if (scroll && !scroll.isDestroyed) scroll.scrollTo(edge === "home" ? 0 : scroll.scrollHeight)
      return
    }
    const count = rows().length
    if (count === 0) return
    setSelected(edge === "home" ? 0 : count - 1)
    requestAnimationFrame(scrollSelectedIntoView)
  }

  const openEntry = (index: number) => {
    const entry = rows()[index]
    if (!entry) return
    if (entry.type === "directory") {
      setOpenFile(undefined)
      setDir(entry.path.replace(/[\\/]+$/, ""))
      return
    }
    setOpenFile(entry.path)
  }

  const back = () => {
    if (openFile()) {
      setOpenFile(undefined)
      return
    }
    if (dir() === "") return
    setDir(parentDirectory(dir()))
  }

  const close = () => {
    props.context.ui.dialog.clear()
    props.onClose()
  }

  // The previewed file wins; otherwise the highlighted row opens when it is a regular file.
  const editablePath = () => {
    const previewed = openFile()
    if (previewed) return previewed
    const entry = rows()[selected()]
    return entry && entry.type !== "directory" ? entry.path : undefined
  }

  const edit = () => {
    const path = editablePath()
    if (!path) return
    void openFilePath({
      path,
      renderer: props.context.renderer,
      cwd: location().directory,
      editor: config.data.editor || detectExternalEditor(),
    })
      .then((mode) => {
        if (mode !== "system") return
        props.context.ui.toast.show({
          variant: "info",
          title: "文件",
          message: `已用系统默认程序打开 ${entryName(path)}（可在 Ctrl+P 运行“设置外部编辑器”或输入 /set-editor）`,
        })
      })
      .catch((error) =>
        props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) }),
      )
  }

  const initialText = () => {
    const state = previewState()
    return state.kind === "text" ? state.text : ""
  }

  // In-place editing only makes sense for a fully loaded text file: binaries and
  // truncated previews would be written back incomplete.
  const startEdit = () => {
    if (!openFile()) {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "请先打开一个文件再进行编辑" })
      return
    }
    const state = previewState()
    if (state.kind === "loading") return
    if (state.kind === "binary") {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "二进制文件无法在内部编辑" })
      return
    }
    if (state.kind === "text" && state.truncated) {
      props.context.ui.toast.show({ variant: "info", title: "文件", message: "文件过大，请在外部编辑器中打开" })
      return
    }
    if (state.kind === "error") {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: "无法读取该文件" })
      return
    }
    setEditing(true)
  }

  const cancelEdit = () => {
    clearHighlight()
    setEditing(false)
  }

  const newline = () => {
    const element = textarea
    if (element && !element.isDestroyed) element.newLine()
  }

  const save = async () => {
    const path = openFile()
    const element = textarea
    if (!path || !element || element.isDestroyed || saving()) return
    setSaving(true)
    try {
      await props.context.client.file.write({
        location: location(),
        path,
        payload: new TextEncoder().encode(element.plainText),
      })
      clearHighlight()
      setEditing(false)
      props.context.ui.toast.show({ variant: "success", title: "文件", message: `已保存 ${entryName(path)}` })
      void refetchPreview()
    } catch (error) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const openHelp = () => {
    props.context.ui.dialog.show(() => <FilesHelpDialog context={props.context} />)
    props.context.ui.dialog.set({ size: "medium", centered: true })
  }

  const commands: KeymapCommand[] = [
    { id: "files.close", title: "关闭文件浏览器", group: "文件", run: close },
    { id: "files.parent", title: "返回上一级", group: "文件", run: back },
    { id: "files.edit", title: "在内部编辑", group: "文件", run: startEdit },
    { id: "files.external", title: "用外部编辑器打开", group: "文件", run: edit },
    { id: "files.up", title: "向上移动文件选择", group: "文件", run: () => move(-1) },
    { id: "files.down", title: "向下移动文件选择", group: "文件", run: () => move(1) },
    { id: "files.page_up", title: "向上翻页文件列表", group: "文件", run: () => page(-1) },
    { id: "files.page_down", title: "向下翻页文件列表", group: "文件", run: () => page(1) },
    { id: "files.home", title: "跳到文件列表开头", group: "文件", run: () => jump("home") },
    { id: "files.end", title: "跳到文件列表结尾", group: "文件", run: () => jump("end") },
    {
      id: "files.select",
      title: "打开所选文件或目录",
      group: "文件",
      run() {
        if (openFile()) return
        openEntry(selected())
      },
    },
    {
      id: "files.refresh",
      title: "刷新文件列表",
      group: "文件",
      run() {
        if (openFile()) void refetchPreview()
        else void refetch()
      },
    },
    { id: "files.search", title: "在文件中搜索内容", group: "文件", palette: true, run: () => void findInFile() },
    {
      id: "files.next_match",
      title: "跳到下一个匹配",
      group: "文件",
      enabled: () => matchLines().length > 0,
      run: () => cycleMatch(1),
    },
    {
      id: "files.prev_match",
      title: "跳到上一个匹配",
      group: "文件",
      enabled: () => matchLines().length > 0,
      run: () => cycleMatch(-1),
    },
    { id: "files.goto", title: "跳转到指定行", group: "文件", palette: true, run: () => void gotoLine() },
    { id: "files.new", title: "新建文件", group: "文件", palette: true, run: () => void createFile() },
    {
      id: "files.new_directory",
      title: "新建目录",
      group: "文件",
      palette: true,
      run: () => void createDirectory(),
    },
    { id: "files.rename", title: "重命名文件或目录", group: "文件", palette: true, run: () => void renameEntry() },
    { id: "files.delete", title: "删除文件或目录", group: "文件", palette: true, run: () => void deleteEntry() },
    { id: "files.help", title: "显示文件浏览器快捷键", group: "文件", run: openHelp },
    { id: "files.open_external", title: "用默认编辑器打开文件", group: "文件", palette: true, run: edit },
  ]

  // Listing/view bindings step aside while the editor owns the keys.
  props.context.keymap.layer(() => ({ enabled: () => !editing(), commands }))

  // Editing runs in its own input mode so the base layer's keys (and the session
  // interrupt bound to ESC) cannot fire while typing in the textarea.
  props.context.keymap.layer(() => ({
    mode: "files-edit",
    enabled: () => editing(),
    priority: 1,
    commands: [
      { id: "files.save", title: "保存当前文件", group: "文件", run: () => void save() },
      { bind: "return", title: "插入换行", group: "文件", run: newline },
      { bind: "escape", title: "退出编辑", group: "文件", run: cancelEdit },
    ],
  }))

  createEffect(() => {
    if (!editing()) return
    const popMode = props.context.keymap.mode.push("files-edit")
    onCleanup(popMode)
  })

  const shortcut = (id: string) => props.context.keymap.shortcuts(id)[0] ?? ""

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={surface()}
      onMouseDown={() => {
        if (editing() && textarea && !textarea.isDestroyed) textarea.focus()
      }}
    >
      <box
        id="files-header"
        flexShrink={0}
        flexDirection="row"
        gap={1}
        height={docked() ? 2 : 1}
        paddingLeft={2}
        paddingRight={1}
        paddingTop={docked() ? 1 : 0}
      >
        <text fg={theme.text.action.secondary.base} attributes={TextAttributes.BOLD} flexShrink={0} wrapMode="none">
          文件
        </text>
        <text fg={theme.text.muted} flexGrow={1} minWidth={0} wrapMode="none" truncate selectable={false}>
          {pathLabel()}
        </text>
        <text fg={theme.text.muted} flexShrink={0} wrapMode="none">
          {editing() ? (saving() ? "保存中…" : "编辑中") : openFile() ? "预览" : `${rows().length} 项`}
        </text>
      </box>
      <box flexGrow={1} minHeight={0}>
        <Switch>
          <Match when={openFile()}>
            <Switch>
              <Match when={editing()}>
                <box flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={1}>
                  <textarea
                    ref={(element: TextareaRenderable) => (textarea = element)}
                    flexGrow={1}
                    minHeight={1}
                    width="100%"
                    wrapMode="none"
                    initialValue={initialText()}
                    placeholder="在此编辑文件内容，Ctrl+S 保存，ESC 退出"
                    syntaxStyle={currentSyntax()}
                    onContentChange={() => scheduleHighlight()}
                    textColor={theme.text.formfield.base}
                    focusedTextColor={theme.text.formfield.base}
                    backgroundColor={surface()}
                    focusedBackgroundColor={theme.background.formfield.base}
                    cursorColor={theme.text.base}
                    focused
                  />
                </box>
              </Match>
              <Match when={!editing()}>
                <scrollbox
                  id="files-preview"
                  ref={(element: ScrollBoxRenderable) => (scroll = element)}
                  flexGrow={1}
                  minHeight={0}
                  verticalScrollbarOptions={{ visible: false }}
                  horizontalScrollbarOptions={{ visible: false }}
                >
                  <box paddingLeft={2} paddingRight={1} paddingBottom={1}>
                    <Switch>
                      <Match when={previewState().kind === "loading"}>
                        <text fg={theme.text.muted}>正在读取…</text>
                      </Match>
                      <Match when={previewState().kind === "error"}>
                        <text fg={theme.text.feedback.error.base}>无法读取该文件。</text>
                      </Match>
                      <Match when={previewState().kind === "binary"}>
                        <text fg={theme.text.muted}>二进制文件，无法以文本预览。</text>
                      </Match>
                      <Match when={previewState().kind === "empty"}>
                        <text fg={theme.text.muted}>（空文件）</text>
                      </Match>
                      <Match when={previewState().kind === "text"}>
                        <box flexDirection="column" width="100%" gap={1}>
                          <code
                            width="100%"
                            wrapMode="char"
                            selectable={false}
                            content={previewText()}
                            filetype={filetype(openFile())}
                            syntaxStyle={currentSyntax()}
                            fg={theme.text.base}
                          />
                          <Show when={previewTruncated()}>
                            <text fg={theme.text.muted}>…（文件过大，已截断预览）</text>
                          </Show>
                        </box>
                      </Match>
                    </Switch>
                  </box>
                </scrollbox>
              </Match>
            </Switch>
          </Match>
          <Match when={!openFile()}>
            <scrollbox
              id="files-list"
              ref={(element: ScrollBoxRenderable) => (scroll = element)}
              flexGrow={1}
              minHeight={0}
              verticalScrollbarOptions={{ visible: false }}
              horizontalScrollbarOptions={{ visible: false }}
            >
              <box flexDirection="column" width="100%" paddingLeft={1} paddingRight={1} paddingBottom={1}>
                <Show when={entries.loading}>
                  <text fg={theme.text.muted}>正在加载…</text>
                </Show>
                <Show when={!entries.loading && entries.error}>
                  <text fg={theme.text.feedback.error.base}>无法读取该目录，可能无权限或已被删除。</text>
                </Show>
                <Show when={!entries.loading && !entries.error && rows().length === 0}>
                  <text fg={theme.text.muted}>（空目录）</text>
                </Show>
                <For each={rows()}>
                  {(entry, index) => {
                    const [hovered, setHovered] = createSignal(false)
                    const isDirectory = () => entry.type === "directory"
                    const isSelected = () => index() === selected() && focused()
                    const nameWidth = () => Math.max(1, (props.panel?.width ?? dimensions().width) - 6)
                    const label = createMemo(() => {
                      const name = entryName(entry.path) + (isDirectory() ? "/" : "")
                      if (stringWidth(name) <= nameWidth()) return name
                      return name.slice(0, nameWidth() - 1) + "…"
                    })
                    const background = () =>
                      isSelected() || hovered() ? theme.background.raised.high : surface()
                    return (
                      <box
                        id={`files-row-${index()}`}
                        flexDirection="row"
                        width="100%"
                        height={1}
                        flexShrink={0}
                        backgroundColor={background()}
                        onMouseOver={() => setHovered(true)}
                        onMouseOut={() => setHovered(false)}
                        onMouseUp={(event) => {
                          if (event.button !== MouseButton.LEFT) return
                          event.stopPropagation()
                          setSelected(index())
                          openEntry(index())
                        }}
                      >
                        <text fg={theme.text.muted} flexShrink={0} wrapMode="none" selectable={false}>
                          <span style={{ fg: theme.text.muted }}>{isSelected() ? "› " : "  "}</span>
                          <span style={{ fg: isDirectory() ? theme.text.action.secondary.base : theme.text.base }}>
                            {label()}
                          </span>
                        </text>
                      </box>
                    )
                  }}
                </For>
              </box>
            </scrollbox>
          </Match>
        </Switch>
      </box>
      <box
        id="files-footer"
        flexShrink={0}
        height={1}
        flexDirection="row"
        paddingLeft={2}
        paddingRight={1}
        backgroundColor={surface()}
      >
        <text fg={theme.text.muted} flexGrow={1} minWidth={0} wrapMode="none" truncate selectable={false}>
          {editing()
            ? `${shortcut("files.save")} 保存  ESC 退出编辑`
            : `${shortcut("files.select")} 打开  ${shortcut("files.parent")} 返回  ${shortcut("files.edit")} 编辑  ${shortcut("files.external")} 外部  ${shortcut("files.help")} 帮助  ${shortcut("files.close")} 关闭`}
        </text>
      </box>
    </box>
  )
}

function FileBrowserRoute(props: {
  context: Plugin.Context
  data?: { sessionID?: string; returnRoute?: Route }
}) {
  const dimensions = useTerminalDimensions()
  return (
    <box position="absolute" zIndex={2500} left={0} top={0} width={dimensions().width} height={dimensions().height}>
      <FileBrowser
        context={props.context}
        sessionID={props.data?.sessionID}
        onClose={() => props.context.ui.router.navigate(props.data?.returnRoute ?? { type: "home" })}
      />
    </box>
  )
}

function FilesHelpDialog(props: { context: Plugin.Context }) {
  const dimensions = useTerminalDimensions()
  const theme = props.context.theme.surface("dialog")
  const shortcut = (id: string) => props.context.keymap.shortcuts(id).join(" / ")
  const groups = [
    {
      title: "浏览",
      rows: [
        { shortcut: shortcut("files.down"), label: "下移 / 上移选择" },
        { shortcut: shortcut("files.home"), label: "跳到列表开头 / 结尾" },
        { shortcut: shortcut("files.select"), label: "打开所选文件或目录" },
        { shortcut: shortcut("files.parent"), label: "返回上一级" },
        { shortcut: shortcut("files.refresh"), label: "刷新文件列表" },
        { shortcut: shortcut("files.close"), label: "关闭文件浏览器" },
      ],
    },
    {
      title: "预览与搜索",
      rows: [
        { shortcut: shortcut("files.search"), label: "在文件中搜索内容" },
        { shortcut: shortcut("files.next_match"), label: "下一个 / 上一个匹配" },
        { shortcut: shortcut("files.goto"), label: "跳转到指定行" },
      ],
    },
    {
      title: "编辑",
      rows: [
        { shortcut: shortcut("files.edit"), label: "在 OpenCode 内部编辑" },
        { shortcut: shortcut("files.save"), label: "保存（编辑模式）" },
        { shortcut: shortcut("files.external"), label: "用外部编辑器打开" },
        { shortcut: "/set-editor", label: "设置外部编辑器命令" },
      ],
    },
    {
      title: "文件操作",
      rows: [
        { shortcut: shortcut("files.new"), label: "新建文件" },
        { shortcut: shortcut("files.new_directory"), label: "新建目录" },
        { shortcut: shortcut("files.rename"), label: "重命名" },
        { shortcut: shortcut("files.delete"), label: "删除" },
      ],
    },
  ]

  return (
    <DialogLayout
      header={
        <DialogHeader title="文件浏览器快捷键" closeLabel="ESC 关闭" onClose={() => props.context.ui.dialog.clear()} />
      }
    >
      <scrollbox
        id="files-help-scroll"
        focused
        height={Math.max(
          1,
          Math.min(
            dimensions().height - 6,
            groups.reduce((height, group) => height + group.rows.length + 2, -1),
          ),
        )}
        horizontalScrollbarOptions={{ visible: false }}
        verticalScrollbarOptions={{ visible: false }}
      >
        <box gap={1}>
          <For each={groups}>
            {(group) => (
              <box flexShrink={0}>
                <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
                  {group.title}
                </text>
                <For each={group.rows}>
                  {(row) => (
                    <box flexDirection="row" gap={2}>
                      <text fg={theme.text.base} width={17} flexShrink={0}>
                        {row.shortcut || "未绑定"}
                      </text>
                      <text fg={theme.text.muted} flexGrow={1} minWidth={0}>
                        {row.label}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
        </box>
      </scrollbox>
    </DialogLayout>
  )
}

const EDITOR_CANDIDATES: readonly { command: string; label: string }[] = [
  { command: "code", label: "VS Code" },
  { command: "code-insiders", label: "VS Code Insiders" },
  { command: "cursor", label: "Cursor" },
  { command: "windsurf", label: "Windsurf" },
  { command: "zed", label: "Zed" },
  { command: "subl", label: "Sublime Text" },
  { command: "notepad++", label: "Notepad++" },
  { command: "nvim", label: "Neovim" },
  { command: "vim", label: "Vim" },
  { command: "hx", label: "Helix" },
  { command: "micro", label: "Micro" },
  { command: "emacs", label: "Emacs" },
  { command: "nano", label: "nano" },
  { command: "idea", label: "IntelliJ IDEA" },
  { command: "webstorm", label: "WebStorm" },
  { command: "pycharm", label: "PyCharm" },
  { command: "notepad", label: "记事本" },
]

function Commands(props: { context: Plugin.Context }) {
  const config = useConfig()
  // Scans the PATH for known editors so the user can pick one instead of typing a command.
  const scanEditors = () => {
    const found: { title: string; value: string; footer: string; description?: string }[] = []
    const seen = new Set<string>()
    const add = (value: string, label: string) => {
      const binary = value.trim().split(" ")[0]!
      if (!binary || seen.has(binary) || !Bun.which(binary)) return
      seen.add(binary)
      found.push({ title: value, value, footer: label, description: Bun.which(binary) ?? undefined })
    }
    for (const value of [process.env.VISUAL, process.env.EDITOR]) {
      if (value?.trim()) add(value, "环境变量")
    }
    for (const item of EDITOR_CANDIDATES) add(item.command, item.label)
    return found
  }
  const setEditor = async () => {
    const CUSTOM = "\u0000custom"
    const requested = config.data.editor?.trim()
    const detected = scanEditors()
    const options = [
      { title: "手动输入…", value: CUSTOM, footer: "自定义", description: "输入任意编辑器命令，例如 code、nvim" },
      ...detected.map((item) =>
        // Mark the editor currently in use so it is highlighted when the dialog opens.
        requested && item.value.split(" ")[0] === requested.split(" ")[0] ? { ...item, footer: `${item.footer}（当前）` } : item,
      ),
      { title: "使用系统默认程序", value: "", footer: "清空设置", description: "不指定编辑器，交给系统默认程序打开" },
    ]
    const picked = await props.context.ui.dialog.select<string>({
      title: "自定义外部编辑器",
      placeholder: "选择或搜索已安装的编辑器",
      options,
      current: requested ?? "",
    })
    if (picked === undefined) return
    let editor = picked
    if (picked === CUSTOM) {
      const typed = await props.context.ui.dialog.prompt({
        title: "自定义外部编辑器",
        description: "输入打开文件时使用的编辑器命令（例如 code、nvim、notepad++）。",
        value: requested ?? "",
        placeholder: "code",
      })
      if (typed === undefined) return
      editor = typed
    }
    const value = editor.trim()
    await config
      .update((draft) => {
        draft.editor = value || undefined
      })
      .then(() =>
        props.context.ui.toast.show({
          variant: "success",
          title: "文件",
          message: value ? `外部编辑器已设为“${value}”` : "已改回系统默认程序",
        }),
      )
      .catch(() =>
        props.context.ui.toast.show({ variant: "error", title: "文件", message: "保存外部编辑器设置失败" }),
      )
    props.context.ui.dialog.clear()
  }
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "files.open",
        title: "打开文件浏览器",
        slash: { name: "files" },
        group: "文件",
        palette: true,
        run() {
          const route = props.context.ui.router.current()
          props.context.ui.dialog.clear()
          const current = props.context.ui.panel.current()
          if (current?.name === ROUTE) {
            props.context.ui.panel.close()
            return
          }
          if (props.context.ui.panel.open(ROUTE, { presentation: "panel" })) return
          // Outside a session there is no panel slot, so /files falls back to the full-screen route.
          const returnRoute: Route =
            route.type === "home"
              ? { type: "home" }
              : route.type === "session"
                ? { type: "session", sessionID: route.sessionID }
                : {
                    type: "plugin",
                    id: route.id,
                    name: route.name,
                    ...(route.data ? { data: { ...route.data } } : {}),
                  }
          props.context.ui.router.navigate({
            type: "plugin",
            name: ROUTE,
            data: {
              sessionID: route.type === "session" ? route.sessionID : undefined,
              returnRoute,
            },
          })
        },
      },
      {
        id: "files.set_editor",
        title: "设置外部编辑器",
        slash: { name: "set-editor" },
        group: "文件",
        palette: true,
        run() {
          void setEditor()
        },
      },
    ],
  }))
  return null
}

export default Plugin.define({
  id: "opencode.files",
  setup(context) {
    context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === ROUTE}>
          <FileBrowser context={context} sessionID={panel.sessionID} panel={panel} onClose={panel.close} />
        </Show>
      ),
    })
    context.ui.router.register({
      name: ROUTE,
      render: ({ data }) => <FileBrowserRoute context={context} data={data} />,
    })
    context.ui.slot({ append: "app", render: () => <Commands context={context} /> })
  },
})
