export const ZH_CN_RELEASE_REPO = "dawgnation1986/opencode-zh-cn"
export const ZH_CN_RELEASES_URL = `https://github.com/${ZH_CN_RELEASE_REPO}/releases`
export const ZH_CN_LATEST_API = `https://api.github.com/repos/${ZH_CN_RELEASE_REPO}/releases/latest`

export const ZH_CN_FLAVOR = "zh-cn-v1.1.4"
export const ZH_CN_BASE = "OpenCode 2.0（官方包版本 2.0.32）"
export const ZH_CN_UPSTREAM = "63c1a27（2026-10-17）"

export type UpdateChannel = "official" | "zh-cn"

/** Numeric parts of a zh-cn flavor tag, e.g. "zh-cn-v1.1.0" -> [1, 1, 0]. */
export function zhCnFlavorParts(tag: string): readonly number[] | undefined {
  const match = /zh-cn-v(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(tag.trim())
  if (!match) return undefined
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

/** Whether `candidate` is a strictly newer zh-cn flavor than `current`. */
export function zhCnIsNewer(candidate: string, current: string): boolean {
  const next = zhCnFlavorParts(candidate)
  const base = zhCnFlavorParts(current)
  if (!next || !base) return false
  for (let index = 0; index < 3; index++) {
    if (next[index] !== base[index]) return next[index] > base[index]
  }
  return false
}
