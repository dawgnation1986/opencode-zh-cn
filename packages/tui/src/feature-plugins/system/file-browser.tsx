/** @jsxImportSource @opentui/solid */
import type { LocationRef } from "@opencode/client"
import { Plugin } from "@opencode/plugin/tui"
import type { KeymapCommand, PanelInput, Route } from "@opencode/plugin/tui/context"
import { MouseButton, TextAttributes, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { useTheme } from "../../context/theme"
import { openFilePath } from "../../editor"
import { errorMessage } from "../../util/error"
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
  const dimensions = useTerminalDimensions()
  const [dir, setDir] = createSignal("")
  const [openFile, setOpenFile] = createSignal<string>()
  const [selected, setSelected] = createSignal(0)
  const [editing, setEditing] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
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

  createEffect(() => {
    // Every directory change starts the list at its first entry.
    void dir()
    setSelected(0)
  })
  createEffect(() => {
    const count = rows().length
    setSelected((current) => (count === 0 ? 0 : Math.min(current, count - 1)))
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
    void openFilePath({ path, renderer: props.context.renderer, cwd: location().directory })
      .then((mode) => {
        if (mode !== "system") return
        props.context.ui.toast.show({
          variant: "info",
          title: "文件",
          message: `已用系统默认程序打开 ${entryName(path)}（设置 EDITOR 环境变量可指定编辑器）`,
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

  const cancelEdit = () => setEditing(false)

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
      setEditing(false)
      props.context.ui.toast.show({ variant: "success", title: "文件", message: `已保存 ${entryName(path)}` })
      void refetchPreview()
    } catch (error) {
      props.context.ui.toast.show({ variant: "error", title: "文件", message: errorMessage(error) })
    } finally {
      setSaving(false)
    }
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
    <box width="100%" height="100%" flexDirection="column" backgroundColor={surface()}>
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
                        <text wrapMode="char" selectable={false}>
                          {(() => {
                            const state = previewState()
                            if (state.kind !== "text") return ""
                            return state.text + (state.truncated ? "\n…（文件过大，已截断预览）" : "")
                          })()}
                        </text>
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
            : `${shortcut("files.select")} 打开  ${shortcut("files.parent")} 返回  ${shortcut("files.edit")} 编辑  ${shortcut("files.external")} 外部  ${shortcut("files.close")} 关闭`}
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

function Commands(props: { context: Plugin.Context }) {
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
