import { createSignal } from "solid-js"
import { openPath } from "@opencode/util/open"
import { useRenderer } from "@opentui/solid"
import { useClipboard } from "../context/clipboard"
import { useDialog } from "./dialog"
import { DialogSelect } from "./dialog-select"
import { useToast } from "./toast"

export function useWorkingDirectoryActions(input: { directory: () => string | undefined; onMove?: () => void }) {
  const clipboard = useClipboard()
  const dialog = useDialog()
  const renderer = useRenderer()
  const toast = useToast()
  const [hovered, setHovered] = createSignal(false)

  function openMenu() {
    if (renderer.getSelection()?.getSelectedText()) return
    const directory = input.directory()
    if (!directory) return
    dialog.replace(() => (
      <DialogSelect
        title="工作目录"
        renderFilter={false}
        options={[
          {
            title: "复制路径",
            value: "location.copy",
            description: directory,
            onSelect: (dialog) => {
              void clipboard.write(directory).then(() => {
                dialog.clear()
                toast.show({ message: "路径已复制到剪贴板", variant: "info" })
              }, toast.error)
            },
          },
          {
            title: "打开文件夹",
            value: "location.open",
            description: "在系统文件管理器中",
            onSelect: (dialog) => {
              dialog.clear()
              void openPath(directory).catch(toast.error)
            },
          },
          ...(input.onMove
            ? [
                {
                  title: "工作区",
                  value: "session.move",
                  description: "到另一个工作目录",
                  onSelect: () => void input.onMove?.(),
                },
              ]
            : []),
        ]}
      />
    ))
  }

  return {
    hovered,
    onMouseOver: () => setHovered(true),
    onMouseOut: () => setHovered(false),
    onMouseUp: openMenu,
  }
}
