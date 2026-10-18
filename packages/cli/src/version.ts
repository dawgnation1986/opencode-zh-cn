import { Option, Schema } from "effect"
import { ZH_CN_FLAVOR } from "@opencode/tui/util/zh-cn"

declare const OPENCODE_VERSION: string
declare const OPENCODE_CHANNEL: string
declare const OPENCODE_ARTIFACT: string
declare const OPENCODE_RELEASE_HIGHLIGHTS: string

const version = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
// 程序版本 = 官方版本 + 汉化后缀（如 2.0.32+zh-cn-v1.1.5）。后缀直接从 ZH_CN_FLAVOR 派生，
// 每次发版只改一个常量即可，不会再出现“构建时忘了拼后缀/被 dev 占位版本顶掉”的情况。
const displayVersion = version.includes("+") ? version : `${version}+${ZH_CN_FLAVOR}`
const channel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
const artifact = typeof OPENCODE_ARTIFACT === "string" ? OPENCODE_ARTIFACT : "cli"
// Stable release builds embed the release notes' Highlights; every other build has none.
const highlights =
  typeof OPENCODE_RELEASE_HIGHLIGHTS === "string"
    ? Option.getOrElse(
        Schema.decodeUnknownOption(
          Schema.fromJsonString(Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String }))),
        )(OPENCODE_RELEASE_HIGHLIGHTS),
        () => [],
      )
    : []

export {
  version as OPENCODE_VERSION,
  displayVersion as OPENCODE_DISPLAY_VERSION,
  channel as OPENCODE_CHANNEL,
  artifact as OPENCODE_ARTIFACT,
  highlights as OPENCODE_HIGHLIGHTS,
}
export const OPENCODE_LOCAL = channel === "local"
