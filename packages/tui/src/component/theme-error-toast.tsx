import { onCleanup } from "solid-js"
import { useThemes } from "../context/theme"
import { useToast } from "../ui/toast"

export function ThemeErrorToast() {
  const themes = useThemes()
  const toast = useToast()

  onCleanup(
    themes.onError(({ name, error }) =>
      toast.show({
        variant: "error",
        title: `主题加载失败：${name}`,
        message: error.message,
      }),
    ),
  )

  return null
}
