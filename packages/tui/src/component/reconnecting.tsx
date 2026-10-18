import { RGBA } from "@opentui/core"
import { useTheme } from "../context/theme"
import { Spinner } from "./spinner"

export function Reconnecting(props: { managed?: boolean }) {
  const theme = useTheme()

  return (
    <box
      position="absolute"
      zIndex={10_000}
      top={0}
      right={0}
      bottom={0}
      left={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
      alignItems="center"
      justifyContent="center"
    >
      <box
        width={48}
        maxWidth="90%"
        flexDirection="column"
        backgroundColor={theme.background.raised.base}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        gap={1}
      >
        <Spinner color={theme.text.base}>{props.managed ? "正在重启服务…" : "连接已断开…"}</Spinner>
        <text fg={theme.text.muted}>
          {props.managed
            ? "你的会话将自动恢复。"
            : "正在自动重新连接服务器。"}
        </text>
      </box>
    </box>
  )
}
