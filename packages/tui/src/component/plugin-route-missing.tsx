import { useTheme } from "../context/theme"

export function PluginRouteMissing(props: { id: string; name: string; onHome: () => void }) {
  const theme = useTheme()

  return (
    <box width="100%" height="100%" alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
      <text fg={theme.text.feedback.warning.base}>
        未知插件路由：{props.id}/{props.name}
      </text>
      <box
        onMouseUp={props.onHome}
        backgroundColor={theme.background.action.primary.hovered}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.text.action.primary.hovered}>返回首页</text>
      </box>
    </box>
  )
}
