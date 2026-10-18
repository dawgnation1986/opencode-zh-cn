import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog } from "./dialog"

export function DialogHelp() {
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const shortcuts = Keymap.useShortcuts()

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      { bind: "return", title: "关闭帮助", group: "Dialog", run: () => dialog.clear() },
      { bind: "escape", title: "关闭帮助", group: "Dialog", run: () => dialog.clear() },
    ],
  }))

  return (
    <DialogLayout
      header={<DialogHeader title="帮助" closeLabel="ESC/Enter 关闭" />}
      footer={{ actions: { primary: [{ title: "确定", key: "enter", onTrigger: () => dialog.clear() }] } }}
      legacyFooter={
        <box flexDirection="row" justifyContent="flex-end">
          <box
            paddingLeft={3}
            paddingRight={3}
            backgroundColor={theme.background.action.primary.focused}
            onMouseUp={() => dialog.clear()}
          >
            <text fg={theme.text.action.primary.focused}>确定</text>
          </box>
        </box>
      }
    >
      <text fg={theme.text.muted}>
        按 {shortcuts.get("command.palette.show")} 可在任意场景查看所有可用操作和命令。
      </text>
    </DialogLayout>
  )
}
