import { createSignal } from "solid-js"
import { useNewDesigns } from "../config"
import { useClipboard } from "../context/clipboard"
import { Keymap } from "../context/keymap"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout, useDialog, type DialogContext } from "./dialog"
import { useToast } from "./toast"

export function DialogExportResult(props: { path: string; onClose?: () => void }) {
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const clipboard = useClipboard()
  const toast = useToast()
  const newDesigns = useNewDesigns()
  const [copied, setCopied] = createSignal(false)

  const close = () => {
    props.onClose?.()
    dialog.clear()
  }

  const copy = () => {
    void clipboard
      .write(props.path)
      .then(() => setCopied(true))
      .catch(toast.error)
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: "return",
        title: "关闭导出结果",
        group: "Dialog",
        run: close,
      },
    ],
  }))

  Keymap.createLayer(() => ({
    mode: "modal",
    enabled: newDesigns(),
    commands: [{ bind: "c", title: "复制导出路径", group: "Dialog", run: copy }],
  }))

  return (
    <DialogLayout
      header={<DialogHeader title="会话已导出" onClose={close} />}
      footer={{
        actions: {
          primary: [
            copied()
              ? { title: "✓ 已复制", color: theme.text.feedback.success.base, onTrigger: copy }
              : { title: "复制路径", key: "c", onTrigger: copy },
          ],
        },
      }}
      legacyFooter={
        <box flexDirection="row" justifyContent="flex-end" gap={1}>
          <box
            paddingLeft={3}
            paddingRight={3}
            backgroundColor={theme.background.action.primary.focused}
            onMouseUp={close}
          >
            <text fg={theme.text.action.primary.focused}>关闭</text>
          </box>
        </box>
      }
    >
      <text fg={theme.text.base}>{props.path}</text>
    </DialogLayout>
  )
}

DialogExportResult.show = (dialog: DialogContext, path: string) =>
  new Promise<void>((resolve) => {
    dialog.replace(() => <DialogExportResult path={path} onClose={resolve} />, resolve)
  })
