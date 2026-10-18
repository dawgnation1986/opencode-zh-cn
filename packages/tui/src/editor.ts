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
}

/** Editors probed on PATH when the user has not configured one, so external editing works on first run. */
const EDITOR_CANDIDATES = [
  "code",
  "cursor",
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
 * Picks an editor command for the composer. $VISUAL then $EDITOR win, then the first known editor found
 * on PATH. Returns undefined when nothing is available.
 */
export function detectExternalEditor() {
  return process.env.VISUAL?.trim() || process.env.EDITOR?.trim() || EDITOR_CANDIDATES.find((c) => Bun.which(c))
}

/** Splits an editor command and appends its wait flag plus the target file. */
function editorInvocation(editor: string, target: string) {
  const parts = editor.split(" ")
  const wait = EDITOR_WAIT_FLAGS[path.basename(parts[0]!)]
  const args = parts.slice(1)
  if (wait && !args.includes(wait)) args.push(wait)
  args.push(target)
  return { command: parts[0]!, args }
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
      const parts = editor.split(" ")
      const child = spawn(parts[0]!, [...parts.slice(1), input.path], {
        cwd: input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd(),
        stdio: "inherit",
        shell: process.platform === "win32",
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
      const { command, args } = editorInvocation(editor, file)
      const child = spawn(command, args, {
        cwd: input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd(),
        stdio: [input.stdin ?? "inherit", "inherit", "inherit"],
        shell: process.platform === "win32",
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
