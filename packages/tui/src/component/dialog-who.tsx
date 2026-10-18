import { For } from "solid-js"
import { useTheme } from "../context/theme"
import { DialogHeader, DialogLayout } from "../ui/dialog"

const FLAVOR = "zh-cn-v1.0.0"
const BASE = "OpenCode 2.0（官方包版本 2.0.32）"
const UPSTREAM = "63c1a27（2026-10-17）"

export function DialogWho(props: { version: string }) {
  const theme = useTheme().surface("dialog")
  const rows = () => [
    { label: "汉化版本", value: FLAVOR },
    { label: "程序版本", value: props.version },
    { label: "官方基线", value: BASE },
    { label: "上游提交", value: UPSTREAM },
    { label: "运行平台", value: `${process.platform}-${process.arch}` },
  ]
  return (
    <DialogLayout header={<DialogHeader title="版本信息" />}>
      <box gap={1}>
        <For each={rows()}>
          {(row) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.text.muted} flexShrink={0}>
                {row.label}
              </text>
              <text fg={theme.text.base} wrapMode="word">
                {row.value}
              </text>
            </box>
          )}
        </For>
      </box>
    </DialogLayout>
  )
}
