import type { CliRenderer } from "@opentui/core"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import type { Stream } from "node:stream"
import { resolveZedDbPath, resolveZedSelection } from "./editor-zed"

export { normalizePromptContent } from "./prompt/content"

type EditorStdio = "inherit" | "pipe" | "ignore" | number | Stream

/**
 * GUI editors detach immediately unless told to wait, which would make the composer return before the
 * user finishes editing; these flags keep the session open until the file is closed.
 */
const EDITOR_WAIT_FLAGS: Record<string, string> = {
  code: "--wait",
  "code-insiders": "--wait",
  cursor: "--wait",
  windsurf: "--wait",
  subl: "--wait",
  trae: "--wait",
  "trae-cn": "--wait",
}

/** Editors probed on PATH when the user has not configured one, so external editing works on first run. */
const EDITOR_CANDIDATES = [
  "code",
  "cursor",
  "trae",
  "trae-cn",
  "windsurf",
  "zed",
  "subl",
  "notepad++",
  "nvim",
  "vim",
  "hx",
  "micro",
  "nano",
  "notepad",
]

/**
 * Name hints for editors found by scanning install directories, where the binary is not on PATH
 * (GUI-first installs). Also used to decide which install folders are worth descending into.
 */
const EDITOR_NAME_HINTS = /code|cursor|trae|windsurf|zed|sublime|subl|notepad|neovim|nvim|vim|helix|hx|micro|emacs|idea|webstorm|pycharm|goland|atom|brackets|textmate/i

/** Windows executable/shortcut extensions that can be launched as an editor. */
const EDITOR_EXTENSIONS = [".exe", ".lnk", ".cmd", ".bat"]

/**
 * Picks an editor command for the composer. $VISUAL then $EDITOR win, then the first known editor found
 * on PATH. Returns undefined when nothing is available.
 */
export function detectExternalEditor() {
  return process.env.VISUAL?.trim() || process.env.EDITOR?.trim() || EDITOR_CANDIDATES.find((c) => Bun.which(c))
}

/**
 * Desktop directory for the current platform, when it exists; used to find `.lnk` editor shortcuts.
 * Windows often redirects the desktop into OneDrive, so both locations are probed.
 */
export function desktopDirectory() {
  const home = os.homedir()
  const candidates =
    process.platform === "win32"
      ? [
          process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Desktop") : undefined,
          process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "OneDrive", "Desktop") : undefined,
          path.join(home, "Desktop"),
        ]
      : [path.join(home, "Desktop"), "/Applications"]
  return candidates.find((dir): dir is string => Boolean(dir) && existsSync(dir!))
}

/** Lists one directory level, directories first, for the editor file picker. Throws on unreadable paths. */
export function listDirectory(directory: string) {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => ({ name: entry.name, path: path.join(directory, entry.name), directory: entry.isDirectory() }))
    .sort((left, right) =>
      left.directory === right.directory ? left.name.localeCompare(right.name) : left.directory ? -1 : 1,
    )
}

/**
 * Install directories to scan when PATH lookup misses an editor. GUI installers put binaries under
 * Program Files / the user's Programs folder, and desktop shortcuts surface editors installed elsewhere.
 */
function editorSearchDirectories() {
  const home = os.homedir()
  const candidates = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs") : undefined,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Desktop") : undefined,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "OneDrive", "Desktop") : undefined,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local", "Programs") : undefined,
    path.join(home, "Desktop"),
    "/Applications",
  ]
  return [...new Set(candidates.filter((dir): dir is string => Boolean(dir) && existsSync(dir!)))]
}

/** True when a directory entry is a launchable editor (by extension) and matches the editor name hints. */
function isEditorFile(name: string, matchAll: boolean) {
  if (process.platform === "win32" && !EDITOR_EXTENSIONS.includes(path.extname(name).toLowerCase())) return false
  return matchAll || EDITOR_NAME_HINTS.test(name)
}

/**
 * Finds editors installed off-PATH by scanning Program Files, the user's Programs folder and the
 * desktop. Desktop shortcuts are offered even without a known name, so a user can pick the `.lnk`
 * they actually launch.
 */
export function scanInstalledEditors() {
  const found: { command: string; label: string }[] = []
  const seen = new Set<string>()
  const add = (full: string, name: string) => {
    if (seen.has(full)) return
    seen.add(full)
    found.push({ command: full, label: path.basename(name, path.extname(name)) })
  }
  for (const directory of editorSearchDirectories()) {
    const matchAll = /desktop$/i.test(directory)
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if (entry.isFile()) {
        if (isEditorFile(entry.name, matchAll)) add(full, entry.name)
        continue
      }
      // Editors install into a product folder (e.g. "Microsoft VS Code"); descend one level into
      // folders whose name matches and pick up the launchable binary inside.
      if (!entry.isDirectory() || !EDITOR_NAME_HINTS.test(entry.name)) continue
      let inner
      try {
        inner = readdirSync(full, { withFileTypes: true })
      } catch {
        continue
      }
      for (const child of inner) {
        if (child.isFile() && isEditorFile(child.name, true)) add(path.join(full, child.name), child.name)
      }
    }
  }
  return found.sort((left, right) => left.label.localeCompare(right.label))
}

/**
 * Splits an editor command line. Quoted segments are honoured, and a plain path that exists on disk wins
 * over splitting, so `C:\Program Files\Microsoft VS Code\Code.exe` stays one command instead of two.
 */
export function splitEditorCommand(editor: string) {
  const value = editor.trim()
  if (!value) return { command: "", args: [] as string[] }
  if (value.includes('"') || value.includes("'")) {
    const parts = value.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
    const cleaned = parts.map((part) => part.replace(/^["']|["']$/g, ""))
    return { command: cleaned[0] ?? "", args: cleaned.slice(1) }
  }
  if (existsSync(value)) return { command: value, args: [] as string[] }
  const parts = value.split(/\s+/).filter(Boolean)
  return { command: parts[0] ?? "", args: parts.slice(1) }
}

/** Command name without directory or extension, so `Code.exe` matches the `code` wait flag. */
function editorName(command: string) {
  return path.basename(command).replace(/\.[^.]+$/, "").toLowerCase()
}

/**
 * Splits an editor command and appends its wait flag plus the target file. A concrete path is spawned
 * directly so spaces and quoting survive; a bare name goes through the shell so Windows `*.cmd` shims
 * resolve. Windows shortcuts run through `start`, which launches the shortcut target and waits.
 */
function editorInvocation(editor: string, target: string) {
  const { command, args } = splitEditorCommand(editor)
  if (process.platform === "win32" && /\.lnk$/i.test(command)) {
    return { command: "cmd", args: ["/c", "start", "/wait", "", command, target], shell: false }
  }
  const wait = EDITOR_WAIT_FLAGS[editorName(command)]
  const finalArgs = [...args]
  if (wait && !finalArgs.includes(wait)) finalArgs.push(wait)
  finalArgs.push(target)
  const isPath = path.isAbsolute(command) || existsSync(command)
  return { command, args: finalArgs, shell: process.platform === "win32" && !isPath }
}

/**
 * Opens an existing file path in the user's external editor without copying it through a temp buffer.
 * Without a configured editor it falls back to the platform default application, so external editing
 * works out of the box; the returned mode tells the caller which path was taken.
 */
export async function openFilePath(input: {
  path: string
  renderer: CliRenderer
  cwd?: string
  /** Explicit editor command from config; falls back to $VISUAL/$EDITOR when absent. */
  editor?: string
}): Promise<"editor" | "system"> {
  const editor = input.editor?.trim() || process.env.VISUAL || process.env.EDITOR
  // Nothing to suspend for a detached default application: hand the file over and keep the TUI running.
  if (!editor) {
    await openWithSystem(input.path, input.cwd)
    return "system"
  }
  input.renderer.suspend()
  input.renderer.currentRenderBuffer.clear()
  try {
    await new Promise<void>((resolve, reject) => {
      const { command, args, shell } = editorInvocation(editor, input.path)
      const child = spawn(command, args, {
        cwd: input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd(),
        stdio: "inherit",
        shell,
      })
      child.on("error", reject)
      child.on("exit", (code, signal) => {
        if (code === 0) return resolve()
        reject(new Error(`Editor exited with ${signal ? `signal ${signal}` : `code ${code}`}`))
      })
    })
  } finally {
    input.renderer.currentRenderBuffer.clear()
    input.renderer.resume()
    input.renderer.requestRender()
  }
  return "editor"
}

/**
 * Launches the file with the platform default handler in a detached process, so the TUI regains
 * control immediately. Resolves once the process has spawned and only rejects when it cannot start.
 */
function openWithSystem(target: string, cwd?: string) {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open"
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target]
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd && existsSync(cwd) ? cwd : process.cwd(),
      stdio: "ignore",
      detached: true,
    })
    child.on("error", reject)
    child.on("spawn", () => {
      child.unref()
      resolve()
    })
  })
}

export async function openEditor(input: {
  value: string
  renderer: CliRenderer
  cwd?: string
  stdin?: EditorStdio
  /** Explicit editor command from config; falls back to $VISUAL/$EDITOR when absent. */
  editor?: string
}) {
  const editor = input.editor?.trim() || detectExternalEditor()
  if (!editor) throw new Error("未配置外部编辑器：请运行 /set-editor 设置，或设置 $VISUAL/$EDITOR 环境变量")
  const file = path.join(os.tmpdir(), `${Date.now()}.md`)
  await writeFile(file, input.value)
  input.renderer.suspend()
  input.renderer.currentRenderBuffer.clear()
  try {
    await new Promise<void>((resolve, reject) => {
      const { command, args, shell } = editorInvocation(editor, file)
      const child = spawn(command, args, {
        cwd: input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd(),
        stdio: [input.stdin ?? "inherit", "inherit", "inherit"],
        shell,
      })
      child.on("error", reject)
      child.on("exit", (code, signal) => {
        if (code === 0) return resolve()
        reject(new Error(`Editor exited with ${signal ? `signal ${signal}` : `code ${code}`}`))
      })
    })
    return (await readFile(file, "utf8")) || undefined
  } finally {
    await rm(file, { force: true }).catch(() => {})
    input.renderer.currentRenderBuffer.clear()
    input.renderer.resume()
    input.renderer.requestRender()
  }
}

export function discoverEditorConnection(directory: string) {
  const root = path.join(os.homedir(), ".claude", "ide")
  const contains = (parent: string) => {
    const resolved = path.resolve(parent)
    const relative = path.relative(resolved, path.resolve(directory))
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)) ? resolved.length : 0
  }
  try {
    return readdirSync(root)
      .filter((entry) => entry.endsWith(".lock"))
      .flatMap((entry) => {
        const file = path.join(root, entry)
        const port = Number.parseInt(path.basename(file, ".lock"), 10)
        if (!Number.isInteger(port) || port <= 0 || port > 65535) return []
        try {
          const value = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>
          if (value.transport !== undefined && value.transport !== "ws") return []
          const folders = Array.isArray(value.workspaceFolders)
            ? value.workspaceFolders.filter((item): item is string => typeof item === "string")
            : []
          const score = Math.max(0, ...folders.map(contains))
          if (!score) return []
          return [
            {
              url: `ws://127.0.0.1:${port}`,
              authToken: typeof value.authToken === "string" ? value.authToken : undefined,
              source: `lock:${port}`,
              score,
              mtime: statSync(file).mtimeMs,
            },
          ]
        } catch {
          return []
        }
      })
      .sort((left, right) => right.score - left.score || right.mtime - left.mtime)
      .map(({ url, authToken, source }) => ({ url, authToken, source }))[0]
  } catch {
    return undefined
  }
}

export const editorIntegration = {
  connection: discoverEditorConnection,
  selection: (directory: string) => resolveZedSelection(resolveZedDbPath() ?? "", directory),
}
