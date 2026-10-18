import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js"
import { openUrl } from "@opencode/util/open"
import { createSimpleContext } from "./helper"
import { useLog } from "./log"
import { useStorage } from "./storage"
import { useEvent } from "./event"
import { errorMessage } from "../util/error"
import { useExit } from "./exit"
import { useDialog } from "../ui/dialog"
import { DialogUpdate } from "../component/dialog-update"
import { DialogConfirm } from "../ui/dialog-confirm"
import { DialogSelect } from "../ui/dialog-select"
import {
  type UpdateChannel,
  ZH_CN_FLAVOR,
  ZH_CN_LATEST_API,
  ZH_CN_RELEASE_REPO,
  ZH_CN_RELEASES_URL,
  zhCnIsNewer,
} from "../util/zh-cn"

type ClientNotice = { readonly type: "available" | "installed"; readonly version: string }
type Notice = ClientNotice & ({ readonly source: "client" } | { readonly source: "server"; readonly remote: boolean })
export type UpdateState =
  | ClientNotice
  | { readonly type: "installing"; readonly version: string }
  | { readonly type: "failed"; readonly message: string }

export type UpdateSource = {
  readonly remote: boolean
  readonly subscribe: (notify: (notice: ClientNotice) => void) => () => void
  readonly check: (
    signal: AbortSignal,
    onInstall: (version: string) => void,
  ) => Promise<ClientNotice | { readonly type: "unavailable"; readonly message: string } | undefined>
  readonly apply: (version: string) => Promise<void>
}

export const { use: useUpdateNotification, provider: UpdateNotificationProvider } = createSimpleContext({
  name: "UpdateNotification",
  init: (props: { updater?: UpdateSource }) => {
    const event = useEvent()
    const exit = useExit()
    const dialog = useDialog()
    const log = useLog({ component: "update-notification" })
    const [state, setState] = createSignal<UpdateState>()
    const [notification, setNotification] = createSignal<Notice>()
    const [notifications, markNotification] = useStorage().store<{ versions: string[] }>("update-notifications", {
      initial: { versions: [] },
    })

    const notify = (notice: Notice) => {
      if (!props.updater) return
      if (
        notifications.versions.includes(`${notice.source}:${notice.version}`) ||
        (notice.source === "client" && notifications.versions.includes(notice.version))
      )
        return
      setNotification((current) => {
        if (notice.source === "server" && current?.source === "client") return current
        return notice
      })
    }

    const [preference, setPreference] = useStorage().store<{ channel: UpdateChannel }>("update-channel", {
      initial: { channel: "official" },
    })
    const channel = () => preference.channel
    const setChannel = (next: UpdateChannel) =>
      setPreference((draft) => {
        draft.channel = next
      }).catch((error) => log.error("failed to persist update channel", { error }))

    // The zh-cn channel only reads the localization repository's GitHub Releases.
    const zhCnLatest = async (signal: AbortSignal): Promise<string | undefined> => {
      const response = await fetch(ZH_CN_LATEST_API, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        headers: { accept: "application/vnd.github+json" },
      })
      if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}`)
      const data: { tag_name?: string } = await response.json()
      return data.tag_name
    }

    const notifyZhCn = (version: string) => {
      if (notifications.versions.includes(`client:${version}`) || notifications.versions.includes(version)) return
      setNotification((current) => {
        if (current?.source === "server") return current
        return { source: "client", type: "available", version }
      })
    }

    createEffect(
      on(channel, () => {
        if (channel() !== "zh-cn") return
        const controller = new AbortController()
        onCleanup(() => controller.abort())
        void zhCnLatest(controller.signal)
          .then((tag) => {
            if (tag && zhCnIsNewer(tag, ZH_CN_FLAVOR)) notifyZhCn(tag)
          })
          .catch((error) => {
            if (!controller.signal.aborted) log.error("failed to check zh-cn release", { error })
          })
      }),
    )

    const dismiss = () => {
      const current = notification()
      if (!current) return
      setNotification(undefined)
      // Only interactions with the automatic notification update its history.
      void markNotification((draft) => {
        draft.versions = [...draft.versions, `${current.source}:${current.version}`].slice(-100)
      }).catch((error) => log.error("failed to persist update notification", { error }))
    }

    const apply = async (version: string) => {
      const updater = props.updater
      if (!updater) return
      setState({ type: "installing", version })
      await updater.apply(version).then(
        () => setState({ type: "installed", version }),
        (error) => setState({ type: "failed", message: errorMessage(error) }),
      )
    }

    const install = async () => {
      const current = state()
      if (!current || current.type !== "available") return
      if (channel() === "zh-cn") return installZhCn()
      const updater = props.updater
      if (!updater) return
      dialog.replace(() => (
        <DialogConfirm
          title="更新将替换为官方英文版"
          message="当前为非官方简体中文汉化版本。更新完成后将被替换为官方英文版本，汉化将丢失。是否仍要继续更新？"
          label={{ confirm: "继续更新", cancel: "取消" }}
          onConfirm={() => {
            void apply(current.version)
            show()
          }}
          onCancel={show}
        />
      ))
    }

    const installZhCn = () => {
      dialog.replace(() => (
        <DialogConfirm
          title="前往下载汉化版更新"
          message={`汉化渠道不会自动覆盖当前程序。将打开 GitHub Releases 页面，请手动下载并替换为最新汉化版本。\n${ZH_CN_RELEASES_URL}`}
          label={{ confirm: "打开下载页", cancel: "取消" }}
          onConfirm={() => {
            void openUrl(ZH_CN_RELEASES_URL).catch((error) => log.error("failed to open releases page", { error }))
          }}
          onCancel={show}
        />
      ))
    }

    const check = async (signal: AbortSignal) => {
      if (channel() === "zh-cn") {
        const tag = await zhCnLatest(signal)
        if (tag && zhCnIsNewer(tag, ZH_CN_FLAVOR)) setState({ type: "available", version: tag })
        return
      }
      const updater = props.updater
      if (!updater || state()?.type === "installing") return
      const result = await updater
        .check(signal, (version) => {
          if (!signal.aborted) setState({ type: "installing", version })
        })
        .finally(() => {
          if (state()?.type === "installing") setState(undefined)
        })
      if (signal.aborted) return
      if (result?.type === "unavailable") return result.message
      setState(result)
    }

    const restart = () => {
      const current = state()
      if (current?.type !== "installed") return
      exit()
    }

    const show = () => {
      const status = state()?.type
      dialog.replace(() => (
        <DialogUpdate
          flavor={channel()}
          check={status === undefined || status === "failed" ? check : undefined}
          state={state}
          skip={dismiss}
          install={install}
          restart={restart}
        />
      ))
    }

    const openChannel = () => {
      dialog.replace(() => (
        <DialogSelect
          title="更新渠道"
          renderFilter={false}
          options={[
            {
              title: "官方渠道",
              value: "official",
              description: "检测 opencode.ai 官方更新，可自动安装",
              onSelect: (dialog) => {
                void setChannel("official")
                dialog.clear()
              },
            },
            {
              title: "汉化渠道",
              value: "zh-cn",
              description: `检测 ${ZH_CN_RELEASE_REPO} 的 GitHub Releases，仅提示下载`,
              onSelect: (dialog) => {
                void setChannel("zh-cn")
                dialog.clear()
              },
            },
          ]}
        />
      ))
    }

    const open = (origin: "manual" | "notification") => {
      if (!props.updater && channel() !== "zh-cn") return
      const current = notification()
      const known = current && (current.source === "client" || !current.remote) ? current : undefined
      if (origin === "notification" && !known) return
      const active = state()
      // The notification can predate an installation through /update.
      if (known && active?.type !== "installing" && !(active?.type === "installed" && active.version === known.version))
        setState({ type: known.type, version: known.version })
      show()
    }

    onMount(() => {
      if (!props.updater) return
      onCleanup(
        props.updater.subscribe((notice) => {
          if (channel() === "zh-cn") return
          notify({ ...notice, source: "client" })
        }),
      )
    })

    onCleanup(
      event.on("installation.update-available", (event) => {
        if (channel() === "zh-cn") return
        notify({
          source: "server",
          remote: props.updater?.remote ?? false,
          type: "available",
          version: event.data.version,
        })
      }),
    )
    onCleanup(
      event.on("installation.updated", (event) =>
        notify({
          source: "server",
          remote: props.updater?.remote ?? false,
          type: "installed",
          version: event.data.version,
        }),
      ),
    )

    return {
      notification,
      dismiss,
      channel,
      setChannel,
      openChannel,
      open: props.updater ? open : undefined,
    }
  },
})
