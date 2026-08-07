export type Translate = (key: string, options?: Record<string, unknown>) => string

const SECONDS_IN_YEAR = 31536000
export const SECONDS_IN_DAY = 86400
const SECONDS_IN_HOUR = 3600
export const SECONDS_IN_MINUTE = 60

export const formatNumber = (value: number, digits: number): string =>
  Number.isFinite(value) ? String(Number(value.toFixed(digits))) : ""

export const formatPercent = (value: number, digits = 2): string => `${formatNumber(value, digits)}%`

export const shortenMiddle = (value: string, head: number, tail: number): string =>
  value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(value.length - tail)}`

export const formatDuration = (seconds: number, t: Translate): string => {
  if (!Number.isFinite(seconds) || seconds < SECONDS_IN_MINUTE) {
    return t("time.sec", { count: Math.max(0, Math.round(seconds || 0)) })
  }

  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE) % 60
  const hours = Math.floor(seconds / SECONDS_IN_HOUR) % 24
  const days = Math.floor(seconds / SECONDS_IN_DAY) % 365
  const years = Math.floor(seconds / SECONDS_IN_YEAR)

  if (years > 0) {
    const head = t("time.year", { count: years })
    return days ? `${head} ${t("time.days", { count: days })}` : head
  }

  if (seconds < SECONDS_IN_HOUR) {
    return t("time.min", { count: minutes })
  }

  if (seconds < SECONDS_IN_DAY) {
    const head = t("time.hr", { count: hours })
    return minutes ? `${head} ${t("time.min", { count: minutes })}` : head
  }

  const head = t("time.days", { count: days })
  return hours ? `${head} ${t("time.hr", { count: hours })}` : head
}

export const formatBytes = (bytes: number, t: Translate): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < 1024 ** 2) return `${formatNumber(bytes / 1024, 2)} ${t("units.kb")}`
  if (bytes < 1024 ** 3) return `${formatNumber(bytes / 1024 ** 2, 2)} ${t("units.mb")}`
  return `${formatNumber(bytes / 1024 ** 3, 2)} ${t("units.gb")}`
}

export const formatRangeBound = (value: number, integer: boolean): string =>
  integer ? String(Math.round(value)) : formatNumber(value, 2)

export const parseDecimal = (value: string): number | null => {
  const normalized = value.replace(",", ".").trim()
  if (normalized === "") return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const SPEED_UNITS: Record<string, number> = {
  B: 1,
  KB: 1e3,
  KIB: 1024,
  MB: 1e6,
  MIB: 1024 ** 2,
  GB: 1e9,
  GIB: 1024 ** 3,
}

export const parseSpeed = (value: string | null | undefined): number | null => {
  const match = value === null || value === undefined ? null : /^([\d.]+)\s*(B|[KMG]iB|[KMG]B)\/s$/i.exec(value)
  if (match === null) return null
  const amount = Number(match[1])
  const factor = SPEED_UNITS[match[2].toUpperCase()]
  return factor !== undefined && Number.isFinite(amount) ? amount * factor : null
}
