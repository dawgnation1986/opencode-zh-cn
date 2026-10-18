import { afterEach, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { listDirectory, normalizePromptContent, openEditor, splitEditorCommand } from "../src/editor"
import { tmpdir } from "./fixture/fixture"

const editor = process.env.EDITOR
const visual = process.env.VISUAL

afterEach(() => {
  process.env.EDITOR = editor
  process.env.VISUAL = visual
})

test("rejects when the external editor cannot start", async () => {
  delete process.env.VISUAL
  process.env.EDITOR = "opencode-editor-that-does-not-exist"
  const renderer = {
    suspend() {},
    resume() {},
    requestRender() {},
    currentRenderBuffer: { clear() {} },
  }

  await expect(openEditor({ value: "original", renderer: renderer as never })).rejects.toThrow()
})

test("says which variable to set when no external editor is configured", async () => {
  delete process.env.VISUAL
  delete process.env.EDITOR
  let suspended = false
  const renderer = {
    suspend() {
      suspended = true
    },
    resume() {},
    requestRender() {},
    currentRenderBuffer: { clear() {} },
  }

  await expect(openEditor({ value: "original", renderer: renderer as never })).rejects.toThrow("$EDITOR")
  expect(suspended).toBe(false)
})

test("normalizes a single trailing editor newline for one-line prompts", () => {
  expect(normalizePromptContent("hello\n")).toBe("hello")
  expect(normalizePromptContent("hello\r\n")).toBe("hello")
})

test("preserves multiline prompts that end with a newline", () => {
  expect(normalizePromptContent("hello\nworld\n")).toBe("hello\nworld\n")
})

test("keeps a quoted editor path with spaces as a single command", () => {
  expect(splitEditorCommand('"C:\\Program Files\\Microsoft VS Code\\Code.exe" --wait')).toEqual({
    command: "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    args: ["--wait"],
  })
})

test("treats an existing path as one command even without quotes", async () => {
  await using temporary = await tmpdir()
  const directory = path.join(temporary.path, "my editor")
  const binary = path.join(directory, "Code.exe")
  await mkdir(directory, { recursive: true })
  await writeFile(binary, "")
  expect(splitEditorCommand(binary)).toEqual({ command: binary, args: [] })
})

test("splits a bare command from its arguments and ignores blank input", () => {
  expect(splitEditorCommand("code --new-window")).toEqual({ command: "code", args: ["--new-window"] })
  expect(splitEditorCommand("   ")).toEqual({ command: "", args: [] })
})

test("lists subdirectories before files, each sorted by name", async () => {
  await using temporary = await tmpdir()
  await mkdir(path.join(temporary.path, "zdir"))
  await mkdir(path.join(temporary.path, "adir"))
  await writeFile(path.join(temporary.path, "b.txt"), "")
  await writeFile(path.join(temporary.path, "a.txt"), "")
  expect(listDirectory(temporary.path).map((entry) => entry.name)).toEqual(["adir", "zdir", "a.txt", "b.txt"])
  expect(listDirectory(temporary.path)[0]).toMatchObject({ directory: true, path: path.join(temporary.path, "adir") })
})
